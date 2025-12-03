
// Base64 decoding
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Convert Raw PCM to AudioBuffer
export async function decodeAudioData(
  base64Data: string,
  ctx: AudioContext,
  sampleRate = 24000,
  numChannels = 1
): Promise<AudioBuffer> {
  const bytes = decode(base64Data);
  const dataInt16 = new Int16Array(bytes.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert PCM 16-bit to Float32 [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Convert AudioBuffer to WAV Blob for playback/download
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArr = new ArrayBuffer(length);
  const view = new DataView(bufferArr);
  const channels = [];
  let i: number;
  let sample: number;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this example)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < buffer.length) {
    for (i = 0; i < numOfChan; i++) {
      // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(44 + offset, sample, true); // write 16-bit sample
      offset += 2;
    }
    pos++;
  }

  return new Blob([bufferArr], { type: "audio/wav" });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}

// Extract audio track from video File and return as Base64 WAV
export async function extractAudioFromVideo(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  // Use standard AudioContext, handling browser prefix if necessary
  const CtxClass = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new CtxClass();
  
  try {
    // decodeAudioData works on video containers (mp4, etc) in most modern browsers
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    
    // Convert to standard WAV
    const wavBlob = audioBufferToWav(audioBuffer);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Remove data URL prefix "data:audio/wav;base64,"
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(wavBlob);
    });
  } finally {
    // IMPORTANT: Close the context to prevent hitting browser limits (usually ~6 contexts)
    if (ctx.state !== 'closed') {
      await ctx.close();
    }
  }
}

// Merge multiple Audio Clips (Blob URLs) into a single Blob
export async function mergeAudioClips(audioUrls: string[]): Promise<Blob> {
    const CtxClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new CtxClass();

    try {
        const audioBuffers: AudioBuffer[] = [];
        
        // 1. Fetch and Decode all
        for (const url of audioUrls) {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            audioBuffers.push(audioBuffer);
        }

        if (audioBuffers.length === 0) throw new Error("No audio to merge");

        // 2. Calculate Total Length
        const totalLength = audioBuffers.reduce((acc, buff) => acc + buff.length, 0);
        const numberOfChannels = audioBuffers[0].numberOfChannels;
        const sampleRate = audioBuffers[0].sampleRate;

        // 3. Create Output Buffer
        const resultBuffer = ctx.createBuffer(numberOfChannels, totalLength, sampleRate);

        // 4. Copy Data
        let offset = 0;
        for (const buff of audioBuffers) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const inputData = buff.getChannelData(channel);
                const outputData = resultBuffer.getChannelData(channel);
                outputData.set(inputData, offset);
            }
            offset += buff.length;
        }

        // 5. Convert to Blob
        return audioBufferToWav(resultBuffer);

    } finally {
        if (ctx.state !== 'closed') {
            await ctx.close();
        }
    }
}
