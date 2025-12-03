import { Beat, LayoutMode, OverlayType } from "../types";

export async function renderVideoToBlob(
  sourceUrl: string,
  beats: Beat[],
  layoutMode: LayoutMode,
  onProgress: (progress: number) => void
): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    // 1. Setup Off-screen Video
    const video = document.createElement("video");
    video.src = sourceUrl;
    video.crossOrigin = "anonymous";
    video.muted = false; // Must be unmuted to capture audio via context
    video.playsInline = true;
    
    video.onerror = () => reject(new Error("Video error during export"));

    await new Promise((r) => {
        video.onloadedmetadata = r;
        video.load();
    });

    // 2. Setup Canvas
    const canvas = document.createElement("canvas");
    const width = layoutMode === LayoutMode.PORTRAIT ? 1080 : 1920;
    const height = layoutMode === LayoutMode.PORTRAIT ? 1920 : 1080;
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    // 3. Setup Audio Graph (Capture video audio -> Destination)
    const CtxClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new CtxClass();
    const source = audioCtx.createMediaElementSource(video);
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);

    // 4. Setup MediaRecorder
    const canvasStream = canvas.captureStream(30); // Capture at 30 FPS
    const audioTrack = dest.stream.getAudioTracks()[0];
    if (audioTrack) {
      canvasStream.addTrack(audioTrack);
    }

    const mediaRecorder = new MediaRecorder(canvasStream, {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 8000000 // 8 Mbps high quality
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      
      // Cleanup
      source.disconnect();
      if(audioCtx.state !== 'closed') audioCtx.close();
      video.remove();
      canvas.remove();
      
      resolve(blob);
    };

    // Explicitly handle video end to prevent getting stuck at 99%
    // requestVideoFrameCallback stops firing when video ends, so we need this event.
    video.onended = () => {
        if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            onProgress(1);
        }
    };

    // 5. Pre-load B-Roll Images
    const imageCache: Record<string, HTMLImageElement> = {};
    const uniqueImages = Array.from(new Set(beats.map(b => b.bRollImage).filter(Boolean) as string[]));
    
    await Promise.all(uniqueImages.map(url => new Promise((res) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = res;
        img.onerror = res;
        img.src = url;
        imageCache[url] = img;
    })));

    // Helpers for drawing
    const drawContain = (
        src: HTMLVideoElement,
        targetX: number, targetY: number, targetW: number, targetH: number
    ) => {
        const videoRatio = src.videoWidth / src.videoHeight;
        const targetRatio = targetW / targetH;
        let dW, dH, dX, dY;
        
        if (videoRatio > targetRatio) {
            dW = targetW;
            dH = targetW / videoRatio;
            dX = targetX;
            dY = targetY + (targetH - dH) / 2;
        } else {
            dH = targetH;
            dW = targetH * videoRatio;
            dY = targetY;
            dX = targetX + (targetW - dW) / 2;
        }
        ctx.drawImage(src, 0, 0, src.videoWidth, src.videoHeight, dX, dY, dW, dH);
    };

    // 6. Render Loop
    mediaRecorder.start();
    
    try {
        await video.play();
    } catch (e: any) {
        reject(new Error("Export playback failed: " + e.message));
        return;
    }

    const renderFrame = () => {
        if (mediaRecorder.state === 'inactive') return;

        if (video.paused && !video.ended) {
            requestAnimationFrame(renderFrame);
            return;
        }

        const currentTime = video.currentTime;
        // Avoid division by zero
        if (video.duration > 0) {
            onProgress(Math.min(0.99, currentTime / video.duration));
        }

        // Background
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, width, height);

        // Identify Active Beat
        const currentBeat = beats.find(b => currentTime >= b.startTime && currentTime < b.endTime && b.isEnabled);
        const isSplit = currentBeat && currentBeat.overlayType === OverlayType.SPLIT;
        const splitHPercent = currentBeat?.bRollSettings?.height || 50;
        const splitPixelH = height * (splitHPercent / 100);
        const aRollOffsetY = currentBeat?.bRollSettings?.aRollOffsetY ?? 50;

        // --- Draw A-Roll (Bottom Layer) ---
        if (isSplit) {
             // Split Mode: A-Roll at bottom
             const aRollH = height - splitPixelH;
             
             // Apply Pan Logic manually for canvas
             // We want to simulate object-position: 50% {aRollOffsetY}%
             // This means we calculate the crop rectangle
             
             const videoRatio = video.videoWidth / video.videoHeight;
             const targetRatio = width / aRollH;
             
             let sW, sH, sX, sY;
             
             if (videoRatio > targetRatio) {
                 // Video is wider than target: Crop width (center)
                 sH = video.videoHeight;
                 sW = sH * targetRatio;
                 sY = 0;
                 sX = (video.videoWidth - sW) / 2;
             } else {
                 // Video is taller than target: Crop height (pan)
                 sW = video.videoWidth;
                 sH = sW / targetRatio;
                 sX = 0;
                 // Pan logic: 0% = top, 50% = center, 100% = bottom
                 sY = (video.videoHeight - sH) * (aRollOffsetY / 100);
             }
             
             ctx.drawImage(video, sX, sY, sW, sH, 0, splitPixelH, width, aRollH);
             
             // Divider
             ctx.fillStyle = "#1f2937";
             ctx.fillRect(0, splitPixelH - 2, width, 4);
        } else {
             // Full Mode: A-Roll Contained
             drawContain(video, 0, 0, width, height);
        }

        // --- Draw B-Roll (Top Layer) ---
        if (currentBeat && currentBeat.bRollImage) {
            const img = imageCache[currentBeat.bRollImage];
            if (img) {
                ctx.save();
                
                // Define B-Roll Area
                let areaX = 0, areaY = 0, areaW = width, areaH = height;
                if (isSplit) {
                    areaH = splitPixelH; // Top portion
                }

                // Clip
                ctx.beginPath();
                ctx.rect(areaX, areaY, areaW, areaH);
                ctx.clip();

                // Apply Transforms: Center -> Translate -> Scale
                const centerX = areaX + areaW / 2;
                const centerY = areaY + areaH / 2;
                
                // Pixel shift
                const tx = (currentBeat.bRollSettings.x / 100) * areaW;
                const ty = (currentBeat.bRollSettings.y / 100) * areaH;

                ctx.translate(centerX + tx, centerY + ty);
                ctx.scale(currentBeat.bRollSettings.scale, currentBeat.bRollSettings.scale);

                // Draw Image Centered
                let imgW = img.width;
                let imgH = img.height;
                const areaRatio = areaW / areaH;
                const imgRatio = imgW / imgH;
                
                let renderW, renderH;

                if (imgRatio > areaRatio) {
                    renderH = areaH;
                    renderW = areaH * imgRatio;
                    if (renderW < areaW) {
                         renderW = areaW;
                         renderH = areaW / imgRatio;
                    }
                } else {
                    renderW = areaW;
                    renderH = areaW / imgRatio;
                    if (renderH < areaH) {
                        renderH = areaH;
                        renderW = areaH * imgRatio;
                    }
                }

                ctx.drawImage(img, -renderW/2, -renderH/2, renderW, renderH);
                ctx.restore();
            }
        }

        // Loop
        if ('requestVideoFrameCallback' in video) {
             (video as any).requestVideoFrameCallback(renderFrame);
        } else {
             requestAnimationFrame(renderFrame);
        }
    };

    if ('requestVideoFrameCallback' in video) {
        (video as any).requestVideoFrameCallback(renderFrame);
    } else {
        requestAnimationFrame(renderFrame);
    }
  });
}
