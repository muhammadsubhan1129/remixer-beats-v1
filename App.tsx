
import React, { useState, useRef, useEffect } from 'react';
import { Mic, FileAudio, Video, Layers, Wand2, AlertCircle, Upload, FileText, Trash2, CheckCircle, Download, Loader2, Music, Settings, Play, MessageSquare, Sparkles, Sun, Moon, Merge } from 'lucide-react';
import { ProjectState, AudioClip, Beat, LayoutMode, OverlayType, StyleSettings, ScriptBlock, VideoComment, ChatSession } from './types';
import { generateSpeech, analyzeBeats, generateBRollImage, generateVeoVideo, analyzeAudioContent, VeoConfig } from './services/geminiService';
import { extractAudioFromVideo, mergeAudioClips } from './utils/audioUtils';
import { renderVideoToBlob } from './utils/renderUtils';
import { AudioPlayer } from './components/AudioPlayer';
import { VideoComposer } from './components/VideoComposer';
import { Timeline } from './components/Timeline';
import { CollaborationPanel } from './components/CollaborationPanel';
import { ScriptEditor, ScriptEditorRef } from './components/ScriptEditor';
import { ThemeTransition } from './components/ThemeTransition';
import { GenerateVideoModal } from './components/GenerateVideoModal';
import { AIEditorPanel } from './components/AIEditorPanel';

const INITIAL_TEXT = "Is code more important or is content more important for a 17 year old? I'm of the belief that if you can do it, learn how to code. Because see, content, you can always pick up even after you learn how to code.";

const INITIAL_STATE: ProjectState = {
  textContent: INITIAL_TEXT,
  scriptBlocks: [{ id: 'block-init', content: INITIAL_TEXT, align: 'left', type: 'p' }],
  videoTranscript: "",
  audioClips: [],
  selectedAudioIds: [],
  aRollVideoUrl: undefined,
  isGeneratingVideo: false,
  beats: [],
  layoutMode: LayoutMode.PORTRAIT,
  styleSettings: {
      themePrompt: "",
      imageCount: 1,
      referenceImage: undefined,
      avatarImage: undefined
  },
  videoComments: [],
  chatSessions: [{
      id: 'default-session',
      title: 'New Chat',
      messages: [],
      lastUpdated: Date.now()
  }],
  currentChatSessionId: 'default-session'
};

export const App: React.FC = () => {
  const [state, setState] = useState<ProjectState>(INITIAL_STATE);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isCollabOpen, setIsCollabOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  
  // AI Panel State (Collapsed by default)
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);

  // Script Editor Interaction State
  const [selectedScriptText, setSelectedScriptText] = useState("");
  const scriptEditorRef = useRef<ScriptEditorRef>(null);

  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isTransitioningTheme, setIsTransitioningTheme] = useState(false);
  const [targetTheme, setTargetTheme] = useState<'dark' | 'light'>('dark');

  // State to track if video was playing before user started scrubbing
  const [wasPlayingBeforeScrub, setWasPlayingBeforeScrub] = useState(false);

  // Lifted Video State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // --- Theme Handlers ---
  const handleThemeToggle = () => {
    if (isTransitioningTheme) return;
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTargetTheme(nextTheme);
    setIsTransitioningTheme(true);
  };

  const applyTheme = () => {
      setTheme(targetTheme);
      if (targetTheme === 'light') {
          document.body.classList.add('light-mode');
      } else {
          document.body.classList.remove('light-mode');
      }
  };

  // --- Helpers ---
  // Aggregate text from blocks for Analysis/TTS
  const getFullScriptText = () => {
      return state.scriptBlocks.map(b => b.content.replace(/<[^>]*>?/gm, '')).join('\n');
  };

  // --- Video Controls ---
  const handleTogglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVideoTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  const handleVideoDurationChange = (dur: number) => {
    setDuration(dur);
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time); // Immediate update for UI responsiveness
    }
  };

  const handleScrubStart = () => {
      if (isPlaying) {
          setWasPlayingBeforeScrub(true);
          if (videoRef.current) videoRef.current.pause();
          setIsPlaying(false);
      } else {
          setWasPlayingBeforeScrub(false);
      }
  };

  const handleScrubEnd = () => {
      if (wasPlayingBeforeScrub && videoRef.current) {
          videoRef.current.play();
          setIsPlaying(true);
      }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
  };

  // --- Video Comment Handlers ---
  const handleAddVideoComment = (timestamp: number, text: string) => {
      const newComment: VideoComment = {
          id: Date.now().toString(),
          videoTimestamp: timestamp,
          text,
          author: "You", // In a real app, this comes from auth
          createdAt: Date.now(),
          replies: []
      };
      setState(prev => ({
          ...prev,
          videoComments: [...prev.videoComments, newComment]
      }));
  };

  const handleDeleteVideoComment = (id: string) => {
      setState(prev => ({
          ...prev,
          videoComments: prev.videoComments.filter(c => c.id !== id)
      }));
  };

  const handleReplyVideoComment = (commentId: string, text: string) => {
      setState(prev => ({
          ...prev,
          videoComments: prev.videoComments.map(c => {
              if (c.id === commentId) {
                  return {
                      ...c,
                      replies: [...c.replies, {
                          id: Date.now().toString(),
                          text,
                          author: "You",
                          createdAt: Date.now()
                      }]
                  };
              }
              return c;
          })
      }));
  };

  const handleResolveVideoComment = (id: string) => {
      setState(prev => ({
          ...prev,
          videoComments: prev.videoComments.map(c => 
              c.id === id ? { ...c, isResolved: !c.isResolved } : c
          )
      }));
  };

  // --- Chat Session Handlers ---
  const handleNewSession = () => {
      const newId = `session-${Date.now()}`;
      const newSession: ChatSession = {
          id: newId,
          title: "New Chat",
          messages: [],
          lastUpdated: Date.now()
      };
      setState(prev => ({
          ...prev,
          chatSessions: [...prev.chatSessions, newSession],
          currentChatSessionId: newId
      }));
      // Auto open panel when new session is created
      setIsAiPanelOpen(true);
  };

  const handleUpdateSession = (session: ChatSession) => {
      setState(prev => ({
          ...prev,
          chatSessions: prev.chatSessions.map(s => s.id === session.id ? session : s)
      }));
  };

  const handleSwitchSession = (id: string) => {
      setState(prev => ({ ...prev, currentChatSessionId: id }));
  };

  const handleDeleteSession = (id: string) => {
      setState(prev => {
          const newSessions = prev.chatSessions.filter(s => s.id !== id);
          // If we deleted active session, switch to another or create new
          let newCurrentId = prev.currentChatSessionId;
          if (id === prev.currentChatSessionId) {
              newCurrentId = newSessions.length > 0 ? newSessions[0].id : null;
          }
          
          if (!newCurrentId && newSessions.length === 0) {
               // Ensure always at least one
               const defaultS = { id: `session-${Date.now()}`, title: 'New Chat', messages: [], lastUpdated: Date.now() };
               return { ...prev, chatSessions: [defaultS], currentChatSessionId: defaultS.id };
          }
          
          return {
              ...prev,
              chatSessions: newSessions,
              currentChatSessionId: newCurrentId
          };
      });
  };

  // --- AI Editor Actions ---
  const handleAIInsert = (text: string) => {
      scriptEditorRef.current?.insertAtCursor(text);
  };

  const handleAIReplace = (text: string) => {
      scriptEditorRef.current?.replaceSelection(text);
  };


  // --- Export Handler ---
  const handleExportVideo = async () => {
      if (!state.aRollVideoUrl) return;
      
      setIsExporting(true);
      setExportProgress(0);
      
      // Pause preview during export
      if (videoRef.current) {
          videoRef.current.pause();
          setIsPlaying(false);
      }

      try {
          const blob = await renderVideoToBlob(
              state.aRollVideoUrl,
              state.beats,
              state.layoutMode,
              (p) => setExportProgress(Math.round(p * 100))
          );
          
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `remix-video-${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          setStatus("Video exported successfully!");
      } catch (e: any) {
          console.error("Export failed:", e);
          setError("Failed to export video. " + e.message);
      } finally {
          setIsExporting(false);
          setExportProgress(0);
      }
  };

  // --- State Handlers ---
  const handleScriptChange = (blocks: ScriptBlock[]) => {
      setState(prev => ({ ...prev, scriptBlocks: blocks }));
  };

  const updateStyleSettings = (settings: Partial<StyleSettings>) => {
      setState(prev => ({
          ...prev,
          styleSettings: { ...prev.styleSettings, ...settings }
      }));
  };

  const handleGenerateSpeech = async (textToSpeak?: string) => {
    const fullText = textToSpeak || getFullScriptText();
    if (!fullText) return;

    setIsGeneratingTTS(true);
    setStatus("Generating speech...");
    setError(null);
    try {
      const wavBlob = await generateSpeech(fullText);
      const url = URL.createObjectURL(wavBlob);
      const newClip: AudioClip = {
        id: Date.now().toString(),
        text: fullText.substring(0, 50) + (fullText.length > 50 ? "..." : ""),
        audioUrl: url,
        duration: 0, 
        createdAt: Date.now()
      };
      setState(prev => ({
        ...prev,
        audioClips: [newClip, ...prev.audioClips],
        selectedAudioIds: [newClip.id]
      }));
      setStatus("Speech generated!");
    } catch (e: any) {
      setError(e.message || "Failed to generate speech");
    } finally {
      setIsGeneratingTTS(false);
    }
  };

  const handleDeleteAudio = (id: string) => {
      setState(prev => ({
          ...prev,
          audioClips: prev.audioClips.filter(c => c.id !== id),
          selectedAudioIds: prev.selectedAudioIds.filter(sid => sid !== id)
      }));
  };

  const handleAudioSelect = (id: string) => {
      setState(prev => {
          const isSelected = prev.selectedAudioIds.includes(id);
          const newSelection = isSelected 
             ? prev.selectedAudioIds.filter(mid => mid !== id)
             : [...prev.selectedAudioIds, id];
          return { ...prev, selectedAudioIds: newSelection };
      });
  };

  const handleMergeAudio = async () => {
      if (state.selectedAudioIds.length < 2) return;
      
      setStatus("Merging audio clips...");
      try {
          const selectedClips = state.audioClips.filter(c => state.selectedAudioIds.includes(c.id));
          selectedClips.sort((a, b) => a.createdAt - b.createdAt);
          
          const blob = await mergeAudioClips(selectedClips.map(c => c.audioUrl));
          const url = URL.createObjectURL(blob);
          
          const mergedText = selectedClips.map(c => c.text).join(" | ");

          const newClip: AudioClip = {
              id: `merged-${Date.now()}`,
              text: "Merged Audio: " + mergedText.substring(0, 30) + "...",
              audioUrl: url,
              duration: 0,
              createdAt: Date.now()
          };

          setState(prev => ({
              ...prev,
              audioClips: [newClip, ...prev.audioClips],
              selectedAudioIds: [newClip.id] 
          }));
          setStatus("Audio merged successfully!");
      } catch (e: any) {
          setError("Failed to merge audio: " + e.message);
      }
  };

  const handleAnalyzeBeats = async () => {
    const textToAnalyze = state.videoTranscript || getFullScriptText();
    
    if (!textToAnalyze) {
        setError("Please enter text in the editor to analyze.");
        return;
    }

    setIsAnalyzing(true);
    setStatus("Analyzing text for visual beats...");
    setError(null);
    try {
      const beats = await analyzeBeats(textToAnalyze);
      
      let currentT = 0;
      const updatedBeats = beats.map(beat => {
        const wordCount = beat.textSegment.split(' ').length;
        const dur = Math.max(2, wordCount / 2.5); 
        const b = { ...beat, startTime: currentT, endTime: currentT + dur };
        currentT += dur;
        return b;
      });

      setState(prev => ({ ...prev, beats: updatedBeats }));
      setStatus("Analysis complete. Review beats and generate images.");
      
    } catch (e: any) {
      setError(e.message || "Failed to analyze beats");
    } finally {
        setIsAnalyzing(false); 
    }
  };

  const handleGenerateVeo = async (config: { resolution: '720p' | '1080p'; aspectRatio: '9:16' | '16:9'; avatarImage?: string }) => {
     let sourceText = "";
     if (state.selectedAudioIds.length > 0) {
         const clip = state.audioClips.find(c => c.id === state.selectedAudioIds[0]);
         if (clip) sourceText = clip.text;
     }
     
     if (!sourceText) sourceText = getFullScriptText();
     if (!sourceText) {
         setError("No text content found to generate video.");
         return;
     }

     setState(prev => ({ ...prev, isGeneratingVideo: true, layoutMode: config.aspectRatio === '9:16' ? LayoutMode.PORTRAIT : LayoutMode.LANDSCAPE }));
     setStatus("Generating Veo A-Roll video (this may take a while)...");
     setError(null);
     
     try {
         const prompt = `A cinematic video of a person talking about: ${sourceText}. High quality, professional lighting.`;
         const videoUrl = await generateVeoVideo(prompt, config);
         
         setState(prev => ({ ...prev, aRollVideoUrl: videoUrl }));
         setStatus("Video generated!");
     } catch (e: any) {
         setError(e.message || "Failed to generate video");
     } finally {
         setState(prev => ({ ...prev, isGeneratingVideo: false }));
     }
  };

  const handleUploadARoll = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const url = URL.createObjectURL(file);
          
          setState(prev => ({ ...prev, aRollVideoUrl: url, beats: [], videoTranscript: "" }));
          
          setIsAnalyzing(true);
          setError(null);
          setStatus("Extracting audio from video...");
          
          try {
              const audioBase64 = await extractAudioFromVideo(file);
              
              setStatus("Transcribing and creating beats with Gemini...");
              const { transcript, beats } = await analyzeAudioContent(audioBase64);
              
              setState(prev => ({ 
                  ...prev, 
                  videoTranscript: transcript,
                  beats: beats,
              }));
              
              setStatus("Video uploaded and analyzed. Ready to generate visuals.");
          } catch (e: any) {
              console.error(e);
              setError(e.message || "Failed to process video");
              setStatus("Analysis failed.");
          } finally {
              setIsAnalyzing(false);
          }
      }
  };

  const handleRemoveARoll = () => {
      if (videoRef.current) {
          videoRef.current.pause();
          setIsPlaying(false);
      }
      setState(prev => ({
          ...prev,
          aRollVideoUrl: undefined,
          beats: [],
          videoTranscript: ""
      }));
      setCurrentTime(0);
      setDuration(0);
      setStatus("Video removed.");
  };

  const updateBeat = (beatId: string, updates: Partial<Beat>) => {
      setState(prev => ({
          ...prev,
          beats: prev.beats.map(b => b.id === beatId ? { ...b, ...updates } : b)
      }));
  };

  const handleRegenerateImage = async (beat: Beat) => {
      setStatus(`Regenerating image for beat...`);
      try {
          const beatTheme = beat.styleConfig?.themePrompt || state.styleSettings.themePrompt;
          const beatRef = beat.styleConfig?.referenceImage || state.styleSettings.referenceImage;
          const beatAvatar = beat.styleConfig?.avatarImage || state.styleSettings.avatarImage;
          
          const img = await generateBRollImage(
              beat.visualPrompt, 
              state.layoutMode,
              beatRef,
              beatTheme,
              beatAvatar
          );
          updateBeat(beat.id, { 
              bRollImage: img,
              bRollOptions: [...(beat.bRollOptions || []), img]
          });
          setStatus("Image updated.");
      } catch(e: any) {
          setError("Failed to regenerate image");
      }
  };

  const handleBulkGenerate = async () => {
      const beatsToProcess = state.beats;
      if (beatsToProcess.length === 0) return;

      let completed = 0;

      for (let i = 0; i < beatsToProcess.length; i++) {
          const beat = beatsToProcess[i];
          const count = beat.styleConfig?.imageCount || state.styleSettings.imageCount;
          const theme = beat.styleConfig?.themePrompt || state.styleSettings.themePrompt;
          const refImg = beat.styleConfig?.referenceImage || state.styleSettings.referenceImage;
          const avatar = beat.styleConfig?.avatarImage || state.styleSettings.avatarImage;

          for (let j = 0; j < count; j++) {
              setStatus(`Generating image ${j+1}/${count} for beat ${i + 1}/${beatsToProcess.length}...`);
              try {
                  await new Promise(resolve => setTimeout(resolve, 3000));
                  const img = await generateBRollImage(
                      beat.visualPrompt, 
                      state.layoutMode, 
                      refImg,
                      theme,
                      avatar
                  );
                  
                  setState(prev => ({
                      ...prev,
                      beats: prev.beats.map(b => {
                          if (b.id === beat.id) {
                              const isFirst = !b.bRollImage && (b.bRollOptions?.length || 0) === 0 && j === 0;
                              return { 
                                  ...b, 
                                  bRollImage: isFirst ? img : (b.bRollImage || img),
                                  bRollOptions: [...(b.bRollOptions || []), img] 
                              };
                          }
                          return b;
                      })
                  }));
              } catch (e) {
                  console.error(`Failed to generate image for beat ${beat.id}`, e);
              }
              completed++;
          }
      }
      setStatus("Batch generation complete.");
  };

  const handleGenerateImageFromPrompt = async (beatId: string, prompt: string) => {
      if (!prompt.trim()) return;
      
      const currentBeat = state.beats.find(b => b.id === beatId);
      if (!currentBeat) return;
      
      const count = currentBeat.styleConfig?.imageCount || state.styleSettings.imageCount || 1;
      
      setStatus(`Generating ${count} version${count > 1 ? 's' : ''}...`);
      
      try {
          const beatTheme = currentBeat.styleConfig?.themePrompt || state.styleSettings.themePrompt;
          const beatRef = currentBeat.styleConfig?.referenceImage || state.styleSettings.referenceImage;
          const beatAvatar = currentBeat.styleConfig?.avatarImage || state.styleSettings.avatarImage;

          for (let i = 0; i < count; i++) {
              if (count > 1) setStatus(`Generating version ${i+1}/${count}...`);
              
              const img = await generateBRollImage(
                  prompt, 
                  state.layoutMode,
                  beatRef, 
                  beatTheme,
                  beatAvatar
              );
              
              setState(prev => {
                  const b = prev.beats.find(bt => bt.id === beatId);
                  if (!b) return prev;

                  const newOptions = [...(b.bRollOptions || []), img];
                  return {
                      ...prev,
                      beats: prev.beats.map(bt => bt.id === beatId ? {
                          ...bt,
                          bRollImage: img, 
                          bRollOptions: newOptions,
                          visualPrompt: prompt
                      } : bt)
                  };
              });
          }
          
          setStatus(`Generated ${count} image${count > 1 ? 's' : ''}.`);
      } catch(e: any) {
          setError("Failed to generate image");
          setStatus("");
      }
  };

  const handleUploadImage = (beatId: string, file: File) => {
      const url = URL.createObjectURL(file);
      const currentBeat = state.beats.find(b => b.id === beatId);
      if (currentBeat) {
          updateBeat(beatId, { 
              bRollImage: url,
              bRollOptions: [...(currentBeat.bRollOptions || []), url]
          });
      }
  };

  const handleSelectImage = (beatId: string, imageUrl: string) => {
      updateBeat(beatId, { bRollImage: imageUrl });
  };

  const handleSplitBeat = async (beatId: string, startIdx: number, endIdx: number) => {
      const beatIndex = state.beats.findIndex(b => b.id === beatId);
      if (beatIndex === -1) return;
      
      const originalBeat = state.beats[beatIndex];
      const text = originalBeat.textSegment;
      
      if (startIdx < 0 || endIdx > text.length || startIdx >= endIdx) return;

      const len1 = startIdx;
      const len2 = endIdx - startIdx;
      const len3 = text.length - endIdx;

      const totalLength = text.length;
      const totalDuration = originalBeat.endTime - originalBeat.startTime;

      const parts = [];
      if (len1 > 0) parts.push({ text: text.substring(0, startIdx), len: len1 });
      parts.push({ text: text.substring(startIdx, endIdx), len: len2 });
      if (len3 > 0) parts.push({ text: text.substring(endIdx), len: len3 });

      let currentStartTime = originalBeat.startTime;
      const newBeats: Beat[] = [];

      for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          const partDuration = (part.len / totalLength) * totalDuration;
          
          const newBeat: Beat = {
              id: `beat-${Date.now()}-${i}`,
              startTime: currentStartTime,
              endTime: currentStartTime + partDuration,
              textSegment: part.text.trim(),
              visualPrompt: part.text.trim() + ", photorealistic, 4k, b-roll, cinematic lighting",
              overlayType: originalBeat.overlayType,
              isEnabled: true,
              bRollImage: undefined,
              bRollSettings: { x: 0, y: 0, scale: 1, height: 50, aRollOffsetY: 50 },
              bRollOptions: [],
              styleConfig: originalBeat.styleConfig 
          };
          newBeats.push(newBeat);
          currentStartTime += partDuration;
      }

      const updatedBeats = [...state.beats];
      updatedBeats.splice(beatIndex, 1, ...newBeats);
      
      setState(prev => ({ ...prev, beats: updatedBeats }));
  };

  const handleMergeBeats = (beatIds: string[]) => {
      const selectedBeats = state.beats.filter(b => beatIds.includes(b.id));
      if (selectedBeats.length < 2) return;

      selectedBeats.sort((a, b) => a.startTime - b.startTime);

      const firstBeat = selectedBeats[0];
      const lastBeat = selectedBeats[selectedBeats.length - 1];

      const mergedText = selectedBeats.map(b => b.textSegment).join(" ");

      const allImages = Array.from(new Set(selectedBeats.flatMap(b => b.bRollOptions || []))) as string[];
      if (firstBeat.bRollImage && !allImages.includes(firstBeat.bRollImage)) {
          allImages.unshift(firstBeat.bRollImage);
      }

      const mergedBeat: Beat = {
          id: `beat-merged-${Date.now()}`,
          startTime: firstBeat.startTime,
          endTime: lastBeat.endTime,
          textSegment: mergedText,
          visualPrompt: firstBeat.visualPrompt,
          bRollImage: firstBeat.bRollImage,
          overlayType: firstBeat.overlayType,
          isEnabled: firstBeat.isEnabled,
          bRollSettings: firstBeat.bRollSettings,
          bRollOptions: allImages,
          styleConfig: firstBeat.styleConfig
      };

      const remainingBeats = state.beats.filter(b => !beatIds.includes(b.id));
      const newBeatsList = [...remainingBeats, mergedBeat].sort((a, b) => a.startTime - b.startTime);

      setState(prev => ({
          ...prev,
          beats: newBeatsList
      }));
      setStatus(`Merged ${selectedBeats.length} beats.`);
  };

  return (
    <div className="h-screen bg-transparent text-text-main font-sans selection:bg-primary/30 selection:text-white flex flex-col overflow-hidden">
      
      {/* THEME TRANSITION OVERLAY */}
      {isTransitioningTheme && (
        <ThemeTransition 
          targetTheme={targetTheme}
          onAnimationComplete={() => setIsTransitioningTheme(false)}
          onThemeSwitch={applyTheme}
        />
      )}

      <CollaborationPanel isOpen={isCollabOpen} onClose={() => setIsCollabOpen(false)} />
      
      {/* Generate Video Modal */}
      <GenerateVideoModal 
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onGenerate={handleGenerateVeo}
      />

      {/* EXPORT OVERLAY */}
      {isExporting && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center gap-6 backdrop-blur-xl animate-fade-in">
              <div className="relative">
                  <Loader2 size={64} className="text-primary animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
                  </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="text-2xl font-bold text-white tracking-tight">Rendering Video</div>
                <div className="text-sm text-gray-400 font-medium">Please wait while we compose your masterpiece</div>
              </div>
              <div className="w-96 h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5">
                  <div 
                      className="h-full bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]"
                      style={{ width: `${exportProgress}%` }}
                  />
              </div>
              <div className="text-xs text-gray-500 font-mono tracking-widest">{exportProgress}%</div>
          </div>
      )}

      {/* TOP HEADER */}
      <header className="h-14 px-6 glass-panel border-b border-border flex items-center justify-between shrink-0 z-50">
          <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
                  <Music size={18} className="text-white fill-white" />
              </div>
              <div className="flex flex-col">
                  <h1 className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-text-main to-text-muted tracking-tight">
                      Remixer Beats <span className="text-primary">AI</span>
                  </h1>
                  <span className="text-[10px] text-text-muted font-medium tracking-wide">VIDEO COMPOSER SUITE</span>
              </div>
          </div>

          <div className="flex items-center gap-4">
               {/* Status Pill */}
               <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 ${status ? 'bg-primary/5 border-primary/20 opacity-100' : 'opacity-0 border-transparent'}`}>
                   {status && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.6)]"></span>}
                   <span className="text-[10px] font-medium text-primary tracking-wide">{status}</span>
               </div>
               
               {error && (
                 <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-[10px] font-medium animate-fade-in">
                    <AlertCircle size={12} />
                    {error}
                 </div>
               )}

               <div className="h-4 w-px bg-border mx-2"></div>
               
               {/* THEME TOGGLE */}
               <button 
                  onClick={handleThemeToggle}
                  disabled={isTransitioningTheme}
                  className="p-2 rounded-lg transition-colors border border-transparent hover:bg-surface text-text-muted hover:text-text-main hover:border-border"
                  title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
               >
                   {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
               </button>

               <button 
                  onClick={() => setIsCollabOpen(true)}
                  className={`p-2 rounded-lg transition-colors border border-transparent ${isCollabOpen ? 'bg-surface text-text-main border-border' : 'text-text-muted hover:text-text-main hover:bg-surface'}`}
                  title="Team Chat"
               >
                   <MessageSquare size={16} />
               </button>

               <button 
                   onClick={handleExportVideo}
                   disabled={!state.aRollVideoUrl || isExporting || isAnalyzing}
                   className="flex items-center gap-2 px-4 py-1.5 bg-surface hover:bg-background border border-border text-text-main rounded-lg text-xs font-semibold transition disabled:opacity-30 disabled:cursor-not-allowed group"
               >
                   <Download size={14} className="group-hover:text-primary transition-colors" />
                   Export
               </button>
          </div>
      </header>

      {/* MAIN LAYOUT: Flexbox Implementation with Collapsible Panels */}
      <main className="flex-1 min-h-0 flex overflow-hidden">
          
          {/* COLUMN 1: ASSETS & TOOLS (Fixed Width) */}
          <aside className="w-[280px] shrink-0 h-full flex flex-col border-r border-border bg-background/50 backdrop-blur-sm">
              <div className="p-4 border-b border-border flex items-center justify-between bg-surface/10">
                  <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                    <Layers size={14} /> Assets
                  </h2>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-6">
                  
                  {/* Script / Text */}
                  <div className="flex flex-col gap-2 h-[450px] shrink-0">
                      <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-text-main flex items-center gap-2">
                             <FileText size={14} className="text-primary" /> Script
                          </label>
                      </div>
                      
                      <ScriptEditor 
                          ref={scriptEditorRef}
                          blocks={state.scriptBlocks}
                          onChange={handleScriptChange}
                          onGenerateSpeech={handleGenerateSpeech}
                          isGeneratingTTS={isGeneratingTTS}
                          onSelectionChange={setSelectedScriptText}
                      />
                  </div>

                  {/* Audio Assets */}
                  <div className="flex flex-col gap-2 shrink-0">
                      <div className="flex items-center justify-between">
                         <label className="text-xs font-medium text-text-main flex items-center gap-2">
                             <FileAudio size={14} className="text-emerald-400" /> Audio
                         </label>
                         {state.selectedAudioIds.length >= 2 && (
                             <button 
                                onClick={handleMergeAudio}
                                className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded text-[9px] uppercase font-bold transition animate-fade-in"
                             >
                                 <Merge size={10} /> Merge
                             </button>
                         )}
                      </div>
                      <div className="min-h-[80px] max-h-[150px] overflow-y-auto custom-scrollbar rounded-xl border border-border bg-background/50 p-1">
                          {state.audioClips.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center text-text-muted gap-1 p-4">
                                  <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center"><Mic size={14} /></div>
                                  <span className="text-[10px]">No audio generated</span>
                              </div>
                          ) : (
                              state.audioClips.map(clip => (
                                  <div key={clip.id} className="relative group/audio">
                                      <div onClick={() => handleAudioSelect(clip.id)} className={`absolute left-0 top-0 bottom-2 w-1 rounded-l-xl z-10 cursor-pointer transition-colors ${state.selectedAudioIds.includes(clip.id) ? 'bg-emerald-500' : 'bg-transparent hover:bg-emerald-500/30'}`} />
                                      <div className={`${state.selectedAudioIds.includes(clip.id) ? 'bg-emerald-500/5' : ''}`}>
                                          <AudioPlayer 
                                            src={clip.audioUrl} 
                                            label={clip.text} 
                                            onDelete={() => handleDeleteAudio(clip.id)}
                                          />
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>

                  {/* A-Roll Source */}
                  <div className="flex flex-col gap-2 shrink-0">
                      <label className="text-xs font-medium text-text-main flex items-center gap-2">
                          <Video size={14} className="text-purple-400" /> A-Roll
                      </label>
                      
                      {state.aRollVideoUrl ? (
                          <div className="glass-card rounded-xl p-3 flex flex-col gap-3">
                              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/5 px-2 py-1.5 rounded-lg border border-emerald-500/10">
                                  <CheckCircle size={12} /> Source Active
                              </div>
                              <div className="flex gap-2">
                                  <label className="flex-1 py-1.5 glass-button rounded-lg text-[10px] font-medium flex items-center justify-center gap-1.5 cursor-pointer text-text-muted hover:text-text-main">
                                      <Upload size={12} /> Replace
                                      <input type="file" accept="video/*" onChange={handleUploadARoll} className="hidden" />
                                  </label>
                                  <button onClick={handleRemoveARoll} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/10 rounded-lg text-[10px] transition">
                                      <Trash2 size={12} />
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <div className={`grid ${state.audioClips.length > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                              {state.audioClips.length > 0 && (
                                <button 
                                    onClick={() => setIsGenerateModalOpen(true)}
                                    disabled={state.isGeneratingVideo || state.scriptBlocks.length === 0}
                                    className="h-16 rounded-xl bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border border-purple-500/20 flex flex-col items-center justify-center gap-1 text-purple-200 hover:text-white hover:border-purple-500/40 hover:from-purple-900/60 hover:to-indigo-900/60 transition group disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Wand2 size={16} className={`mb-0.5 ${state.isGeneratingVideo ? 'animate-spin' : 'group-hover:scale-110 transition'}`} />
                                    <span className="text-[9px] font-bold uppercase tracking-wide">Generate</span>
                                </button>
                              )}

                              <label className="h-16 rounded-xl bg-surface/50 border border-border flex flex-col items-center justify-center gap-1 text-text-muted hover:text-text-main hover:bg-surface hover:border-primary/20 transition cursor-pointer group">
                                  <Upload size={16} className="mb-0.5 group-hover:-translate-y-0.5 transition" />
                                  <span className="text-[9px] font-bold uppercase tracking-wide">Upload</span>
                                  <input type="file" accept="video/*" onChange={handleUploadARoll} className="hidden" />
                              </label>
                          </div>
                      )}
                  </div>
              </div>
          </aside>

          {/* MIDDLE AREA: PREVIEW & SEQUENCER (Flex) */}
          <div className="flex-1 flex min-w-0">
             
             {/* COLUMN 2: PREVIEW (Fluid Width) */}
             <main className="flex-1 h-full relative flex flex-col bg-background/80 min-w-[300px]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
                
                {/* Preview Header */}
                <div className="h-12 border-b border-border flex items-center justify-between px-4 z-10 shrink-0">
                    <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                        REC VIEW
                    </div>
                    <div className="flex bg-surface rounded-lg p-0.5 border border-border">
                          <button 
                              onClick={() => setState(prev => ({ ...prev, layoutMode: LayoutMode.PORTRAIT }))}
                              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${state.layoutMode === LayoutMode.PORTRAIT ? 'bg-text-main text-background shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                          >
                              9:16
                          </button>
                          <button 
                              onClick={() => setState(prev => ({ ...prev, layoutMode: LayoutMode.LANDSCAPE }))}
                              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${state.layoutMode === LayoutMode.LANDSCAPE ? 'bg-text-main text-background shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                          >
                              16:9
                          </button>
                    </div>
                </div>

                {/* Video Container */}
                <div className="flex-1 flex items-center justify-center p-4 min-h-0 overflow-hidden relative">
                    {state.aRollVideoUrl ? (
                        <VideoComposer 
                            ref={videoRef}
                            aRollUrl={state.aRollVideoUrl}
                            beats={state.beats}
                            layoutMode={state.layoutMode}
                            currentTime={currentTime}
                            duration={duration}
                            isPlaying={isPlaying}
                            videoComments={state.videoComments}
                            onTogglePlay={handleTogglePlay}
                            onTimeUpdate={handleVideoTimeUpdate}
                            onDurationChange={handleVideoDurationChange}
                            onEnded={handleVideoEnded}
                            onSeek={handleSeek}
                            onScrubStart={handleScrubStart}
                            onScrubEnd={handleScrubEnd}
                            onAddComment={handleAddVideoComment}
                            onDeleteComment={handleDeleteVideoComment}
                            onReplyComment={handleReplyVideoComment}
                            onResolveComment={handleResolveVideoComment}
                        />
                    ) : (
                        <div className="aspect-[9/16] h-[60vh] bg-surface/50 flex flex-col items-center justify-center text-text-muted gap-4 border border-border rounded-lg shadow-2xl">
                          <div className="w-20 h-20 rounded-full border border-border bg-surface flex items-center justify-center animate-pulse-slow">
                              <Video size={32} className="opacity-20" />
                          </div>
                          <p className="text-xs font-medium tracking-wide">NO SIGNAL</p>
                        </div>
                    )}
                </div>
             </main>

             {/* COLUMN 3: SEQUENCER (Fixed Width - Reduced size) */}
             <aside className="w-[320px] shrink-0 h-full border-l border-border bg-background/50 backdrop-blur-md flex flex-col">
                <Timeline 
                    beats={state.beats}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                    onUpdateBeat={updateBeat}
                    onRegenerateImage={handleRegenerateImage}
                    onUploadImage={handleUploadImage}
                    onSplitBeat={handleSplitBeat}
                    onMergeBeats={handleMergeBeats}
                    onGenerateImage={handleGenerateImageFromPrompt}
                    onSelectImage={handleSelectImage}
                    styleSettings={state.styleSettings}
                    onUpdateStyleSettings={updateStyleSettings}
                    onBulkGenerate={handleBulkGenerate}
                    isAnalyzing={isAnalyzing}
                />
             </aside>
          </div>

          {/* COLUMN 4: AI EDITOR (Collapsible) */}
          <aside className={`${isAiPanelOpen ? 'w-[360px]' : 'w-[50px]'} shrink-0 h-full border-l border-border bg-[#09090b] transition-[width] duration-300 ease-in-out`}>
              <AIEditorPanel 
                  sessions={state.chatSessions}
                  currentSessionId={state.currentChatSessionId}
                  onNewSession={handleNewSession}
                  onSwitchSession={handleSwitchSession}
                  onUpdateSession={handleUpdateSession}
                  onDeleteSession={handleDeleteSession}
                  selectedContext={selectedScriptText}
                  onInsert={handleAIInsert}
                  onReplace={handleAIReplace}
                  isCollapsed={!isAiPanelOpen}
                  onToggle={() => setIsAiPanelOpen(!isAiPanelOpen)}
              />
          </aside>

      </main>
    </div>
  );
};
