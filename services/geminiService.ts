
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { decodeAudioData, audioBufferToWav } from "../utils/audioUtils";
import { Beat, OverlayType, ChatMessage } from "../types";

// Helper to get client (creates new instance to pick up latest key if changed)
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing");
  return new GoogleGenAI({ apiKey });
};

// Generic Retry Wrapper for 429 Errors
const runWithRetry = async <T>(fn: () => Promise<T>, retries = 5, delay = 4000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const isQuotaError = error.status === 429 || 
                         (error.message && error.message.includes("429")) || 
                         (error.toString().includes("quota") || error.toString().includes("RESOURCE_EXHAUSTED"));
    
    if (retries > 0 && isQuotaError) {
      console.warn(`Quota hit. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return runWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

// Helper to convert unsupported image types (like GIF) to PNG
const ensureSupportedImageFormat = async (base64Data: string): Promise<string> => {
  if (!base64Data) return base64Data;
  
  // Check mime type
  const mimeMatch = base64Data.match(/^data:([^;]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : '';
  
  // Gemini Vision models typically support PNG, JPEG, WEBP, HEIC, HEIF
  // GIF is NOT supported for input.
  if (['image/gif', 'image/bmp', 'image/tiff', 'image/svg+xml'].includes(mimeType)) {
      return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous"; // Safe handling
          img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  ctx.drawImage(img, 0, 0);
                  // Convert to PNG
                  resolve(canvas.toDataURL('image/png'));
              } else {
                  // Fallback if canvas fails
                  resolve(base64Data);
              }
          };
          img.onerror = () => {
              // Fallback if loading fails
              resolve(base64Data); 
          };
          img.src = base64Data;
      });
  }
  return base64Data;
};

// 1. Text to Speech
export const generateSpeech = async (text: string): Promise<Blob> => {
  return runWithRetry(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // 'Kore', 'Fenrir', 'Puck', 'Zephyr'
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data generated");

    // Decode PCM to AudioBuffer then to WAV Blob
    const CtxClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new CtxClass({ sampleRate: 24000 });
    
    try {
        const audioBuffer = await decodeAudioData(base64Audio, audioContext, 24000, 1);
        return audioBufferToWav(audioBuffer);
    } finally {
        if (audioContext.state !== 'closed') {
            await audioContext.close();
        }
    }
  });
};

// 2. Analyze Text for Beats (Segments)
export const analyzeBeats = async (fullText: string): Promise<Beat[]> => {
  return runWithRetry(async () => {
    const ai = getAiClient();
    const prompt = `
      Analyze the following video script transcript. 
      Break it down into logical visual "beats" or segments (approx 3-8 seconds each).
      For each beat, provide:
      1. The text segment.
      2. A high-quality, detailed, photorealistic image generation prompt describing a B-roll visual for this segment.
      3. A suggested layout ('full' or 'split').
      
      Return JSON.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${prompt}\n\nTRANSCRIPT:\n${fullText}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              textSegment: { type: Type.STRING },
              visualPrompt: { type: Type.STRING },
              overlayType: { type: Type.STRING, enum: [OverlayType.FULL, OverlayType.SPLIT] }
            }
          }
        }
      }
    });

    const json = JSON.parse(response.text || "[]");
    
    return json.map((item: any, index: number) => ({
      id: `beat-${Date.now()}-${index}`,
      startTime: 0, // Placeholder, will be calculated in UI
      endTime: 0,
      textSegment: item.textSegment,
      visualPrompt: item.visualPrompt,
      overlayType: item.overlayType as OverlayType,
      isEnabled: true, // Default to enabled
      bRollSettings: { x: 0, y: 0, scale: 1, height: 50 }, // Default settings
      bRollOptions: [] // Initialize empty gallery
    }));
  });
};

// 2.5 Analyze Audio for Beats (From Video Upload)
export const analyzeAudioContent = async (audioBase64: string): Promise<{ transcript: string, beats: Beat[] }> => {
  return runWithRetry(async () => {
    const ai = getAiClient();
    const prompt = `
      Listen to this audio.
      1. Generate a verbatim transcript.
      2. Break the content down into logical visual "beats" (segments).
      3. For each beat, provide the text segment, a detailed photorealistic visual prompt for B-roll, a layout preference, and the start/end timestamps in seconds.
      
      Return a JSON object containing 'transcript' and 'beats'.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "audio/wav",
              data: audioBase64
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: { type: Type.STRING },
            beats: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  textSegment: { type: Type.STRING },
                  visualPrompt: { type: Type.STRING },
                  overlayType: { type: Type.STRING, enum: [OverlayType.FULL, OverlayType.SPLIT] },
                  startTime: { type: Type.NUMBER },
                  endTime: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      }
    });

    const json = JSON.parse(response.text || "{}");
    
    const beats = (json.beats || []).map((item: any, index: number) => ({
      id: `beat-vid-${Date.now()}-${index}`,
      startTime: item.startTime || 0,
      endTime: item.endTime || 0,
      textSegment: item.textSegment,
      visualPrompt: item.visualPrompt,
      overlayType: item.overlayType as OverlayType,
      isEnabled: true,
      bRollSettings: { x: 0, y: 0, scale: 1, height: 50 }, // Default settings
      bRollOptions: []
    }));

    return {
      transcript: json.transcript || "",
      beats
    };
  });
};

// 3. Generate Image (B-Roll)
export const generateBRollImage = async (
  prompt: string, 
  ratio: string = "16:9",
  referenceImage?: string,
  themePrompt?: string,
  avatarImage?: string
): Promise<string> => {
  const ai = getAiClient();
  
  let finalPrompt = prompt;
  if (themePrompt && themePrompt.trim()) {
      finalPrompt = `${prompt}. Style/Theme details: ${themePrompt}`;
  }
  
  // Explicitly prompt for image generation to avoid text-only responses from multimodal models
  const imageRequestPrompt = `Generate a high quality, photorealistic image. ${finalPrompt}`;

  if (avatarImage) {
    finalPrompt = `${finalPrompt}. IMPORTANT: The image MUST contain the character/person from the provided avatar reference image. Maintain facial features and characteristics.`;
  }
  
  const validRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
  const aspectRatio = validRatios.includes(ratio) ? ratio : "16:9";

  // Strategy 1: If Reference Image OR Avatar provided, use Gemini 2.5 Flash Image (Multimodal)
  if (referenceImage || avatarImage) {
      // Validate/Convert images (fix for "Unsupported MIME type: image/gif")
      const processedRef = referenceImage ? await ensureSupportedImageFormat(referenceImage) : undefined;
      const processedAvatar = avatarImage ? await ensureSupportedImageFormat(avatarImage) : undefined;

      return runWithRetry(async () => {
          const parts: any[] = [];
          
          const addImagePart = (b64Data: string) => {
              const matches = b64Data.match(/^data:(.+);base64,(.+)$/);
              if (matches) {
                   parts.push({
                      inlineData: {
                        mimeType: matches[1],
                        data: matches[2]
                      }
                   });
              }
          };

          if (processedRef) addImagePart(processedRef);
          if (processedAvatar) addImagePart(processedAvatar);
          
          parts.push({ text: imageRequestPrompt });

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: {
                imageConfig: { aspectRatio: aspectRatio as any }
            }
          });

          for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            }
          }
           throw new Error("No image generated from reference.");
      });
  }

  // Strategy 2: Try Imagen 4.0 (High Quality) - Only for pure text prompts
  try {
    return await runWithRetry(async () => {
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: finalPrompt,
        config: {
          numberOfImages: 1,
          aspectRatio: aspectRatio as any,
          outputMimeType: 'image/jpeg',
        },
      });

      const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
      if (imageBytes) {
        return `data:image/jpeg;base64,${imageBytes}`;
      }
      throw new Error("No image data returned from Imagen");
    });
  } catch (error: any) {
    console.warn("Imagen generation failed, falling back to Flash Image model...", error);
  }

  // Strategy 3: Fallback to Gemini 2.5 Flash Image (General Purpose)
  return runWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: imageRequestPrompt }],
      },
      config: {
          imageConfig: { aspectRatio: aspectRatio as any }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
         return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Failed to generate image with fallback model");
  });
};

export interface VeoConfig {
  resolution: '720p' | '1080p';
  aspectRatio: '16:9' | '9:16';
  avatarImage?: string; // Base64 data string
}

// 4. Generate A-Roll Video (Veo)
export const generateVeoVideo = async (prompt: string, config?: VeoConfig): Promise<string> => {
  // Check if key is selected, if not prompt
  if ((window as any).aistudio && !await (window as any).aistudio.hasSelectedApiKey()) {
      await (window as any).aistudio.openSelectKey();
  }
  
  // We re-instantiate to ensure key is picked up if managed by the window helper
  let ai = getAiClient(); 
  
  const resolution = config?.resolution || '720p';
  const aspectRatio = config?.aspectRatio || '9:16';
  const avatarImage = config?.avatarImage;

  const generateRequest = async () => {
    // Basic config for generation
    const genConfig: any = {
        numberOfVideos: 1,
        resolution: resolution,
        aspectRatio: aspectRatio
    };
    
    // Construct the call parameters
    const params: any = {
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt.slice(0, 250), // Truncate for safety/speed
      config: genConfig
    };

    // If an avatar (start image) is provided, pass it
    if (avatarImage) {
        // Extract base64 and mimetype
        const matches = avatarImage.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
            params.image = {
                mimeType: matches[1],
                imageBytes: matches[2]
            };
        }
    }

    return await ai.models.generateVideos(params);
  };

  let operation;
  try {
    operation = await generateRequest();
  } catch (e: any) {
    // If entity not found, it likely means the project/key selection is invalid or missing capabilities
    // Retry logic as per strict guidelines
    if (e.toString().includes("Requested entity was not found") && (window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
        ai = getAiClient(); // Refresh client with potentially new key
        operation = await generateRequest(); // Retry once
    } else {
      throw e;
    }
  }

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
    operation = await ai.operations.getVideosOperation({operation});
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) throw new Error("Video generation failed");

  // Append API key to fetch the actual bytes
  const apiKey = process.env.API_KEY;
  return `${videoUri}&key=${apiKey}`;
};

// 5. Generate/Edit Script Content (AI Writer - Multi-Turn Chat)
export const sendChatMessage = async (
  history: ChatMessage[], 
  newMessage: string, 
  context?: string
): Promise<string> => {
  return runWithRetry(async () => {
    const ai = getAiClient();
    
    let systemInstruction = "You are an expert copywriter, script editor, and creative writing assistant.";
    if (context) {
        systemInstruction += `\n\nCURRENT SELECTED TEXT CONTEXT:\n"${context}"\n\nIf the user asks to rewrite or edit, use this context as the source.`;
    }

    // Convert internal history to Gemini API format
    const contents = history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
    }));

    // Add new user message
    contents.push({
        role: 'user',
        parts: [{ text: newMessage }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction
      }
    });
    
    return response.text || "";
  });
};

// Legacy Helper (Kept for compatibility if needed, but chat is preferred)
export const generateScriptContent = async (prompt: string, contextText?: string): Promise<string> => {
    return sendChatMessage([], prompt, contextText);
};
