import React, { useState, useRef, useEffect } from 'react';
import { Beat, OverlayType, StyleSettings } from '../types';
import { RefreshCw, Upload, Layout, Eye, EyeOff, Layers, Scissors, Sliders, X, Check, Merge, CheckSquare, Image as ImageIcon, Wand2, Palette, Plus, Settings2, User, MoreVertical, Play, ChevronRight, ChevronDown, Sparkles, Loader2, Maximize } from 'lucide-react';

interface TimelineProps {
  beats: Beat[];
  currentTime: number;
  styleSettings: StyleSettings;
  isAnalyzing: boolean;
  onSeek: (time: number) => void;
  onUpdateBeat: (beatId: string, updates: Partial<Beat>) => void;
  onRegenerateImage: (beat: Beat) => void;
  onUploadImage: (beatId: string, file: File) => void;
  onSplitBeat: (beatId: string, startIdx: number, endIdx: number) => void;
  onMergeBeats: (beatIds: string[]) => void;
  onGenerateImage: (beatId: string, prompt: string) => void;
  onSelectImage: (beatId: string, imageUrl: string) => void;
  onUpdateStyleSettings: (settings: Partial<StyleSettings>) => void;
  onBulkGenerate: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  beats,
  currentTime,
  styleSettings,
  isAnalyzing,
  onSeek,
  onUpdateBeat,
  onRegenerateImage,
  onUploadImage,
  onSplitBeat,
  onMergeBeats,
  onGenerateImage,
  onSelectImage,
  onUpdateStyleSettings,
  onBulkGenerate
}) => {
  const [expandedSettingsId, setExpandedSettingsId] = useState<string | null>(null);
  const [expandedImagePanelId, setExpandedImagePanelId] = useState<string | null>(null);
  const [promptInputs, setPromptInputs] = useState<Record<string, string>>({});
  const [showGlobalSettings, setShowGlobalSettings] = useState(false); // Default closed for cleaner start
  
  const [beatToSplit, setBeatToSplit] = useState<Beat | null>(null);
  const [splitSelection, setSplitSelection] = useState<{start: number, end: number} | null>(null);
  const splitTextRef = useRef<HTMLParagraphElement>(null);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedBeatIds, setSelectedBeatIds] = useState<Set<string>>(new Set());

  // --- Handlers ---
  
  // Centralized image upload handler to convert GIFs to PNGs
  const processImageUpload = (file: File, callback: (dataUrl: string) => void) => {
      const reader = new FileReader();
      reader.onloadend = () => {
          const result = reader.result as string;
          // Convert GIF to PNG immediately on upload to avoid API issues
          if (file.type === 'image/gif') {
             const img = new Image();
             img.onload = () => {
                 const canvas = document.createElement('canvas');
                 canvas.width = img.width;
                 canvas.height = img.height;
                 const ctx = canvas.getContext('2d');
                 if(ctx) {
                     ctx.drawImage(img, 0, 0);
                     callback(canvas.toDataURL('image/png'));
                 } else {
                     callback(result); // Fallback
                 }
             };
             img.onerror = () => callback(result);
             img.src = result;
          } else {
             callback(result);
          }
      };
      reader.readAsDataURL(file);
  };

  const handleFileUpload = (beatId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      // For onUploadImage we usually pass the file, but we can't easily intercept it in App.tsx without logic duplication.
      // However, App.tsx's handleUploadImage simply creates an object URL.
      // To properly fix the GIF issue, we should ideally convert it here and pass a blob or data URL, but onUploadImage expects a File.
      // For now, we will rely on the service-level fix for the API calls, but for Style References (which are data strings), we can fix it here.
      onUploadImage(beatId, e.target.files[0]);
    }
  };

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          processImageUpload(e.target.files[0], (dataUrl) => {
              onUpdateStyleSettings({ referenceImage: dataUrl });
          });
      }
  };

  const handleAvatarImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          processImageUpload(e.target.files[0], (dataUrl) => {
              onUpdateStyleSettings({ avatarImage: dataUrl });
          });
      }
  };

  const handleLocalBeatImageUpload = (beatId: string, field: 'referenceImage' | 'avatarImage', e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          processImageUpload(e.target.files[0], (dataUrl) => {
             const beat = beats.find(b => b.id === beatId);
             if (beat) {
                 onUpdateBeat(beatId, {
                     styleConfig: {
                         ...beat.styleConfig,
                         [field]: dataUrl
                     }
                 });
             }
          });
      }
  };

  const handleOpenSplitModal = (e: React.MouseEvent, beat: Beat) => {
    e.stopPropagation();
    setBeatToSplit(beat);
    setSplitSelection(null);
  };

  const toggleSettings = (e: React.MouseEvent, beatId: string) => {
      e.stopPropagation();
      setExpandedImagePanelId(null);
      setExpandedSettingsId(prev => prev === beatId ? null : beatId);
  };

  const toggleImagePanel = (e: React.MouseEvent, beat: Beat) => {
      e.stopPropagation();
      setExpandedSettingsId(null);
      setExpandedImagePanelId(prev => prev === beat.id ? null : beat.id);
      if (!promptInputs[beat.id]) {
          setPromptInputs(prev => ({ ...prev, [beat.id]: beat.visualPrompt || "" }));
      }
  };

  const handleModalTextSelect = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !splitTextRef.current) {
      setSplitSelection(null);
      return;
    }
    if (!splitTextRef.current.contains(selection.anchorNode)) return;

    const range = selection.getRangeAt(0);
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(splitTextRef.current);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const start = preSelectionRange.toString().length;
    const end = start + range.toString().length;

    if (start < end) {
        setSplitSelection({ start, end });
    } else {
        setSplitSelection(null);
    }
  };

  const handleConfirmSplit = () => {
      if (beatToSplit && splitSelection) {
          onSplitBeat(beatToSplit.id, splitSelection.start, splitSelection.end);
          setBeatToSplit(null);
          setSplitSelection(null);
      }
  };

  const toggleSelectionMode = () => {
      setIsSelectionMode(!isSelectionMode);
      setSelectedBeatIds(new Set());
  };

  const toggleBeatSelection = (e: React.MouseEvent, beatId: string) => {
      e.stopPropagation();
      const newSet = new Set(selectedBeatIds);
      if (newSet.has(beatId)) {
          newSet.delete(beatId);
      } else {
          newSet.add(beatId);
      }
      setSelectedBeatIds(newSet);
  };

  const handleMerge = () => {
      if (selectedBeatIds.size < 2) return;
      onMergeBeats(Array.from(selectedBeatIds));
      setSelectedBeatIds(new Set());
      setIsSelectionMode(false);
  };

  // --- Rendering "Lights Animation" Mode ---
  if (isAnalyzing) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center relative overflow-hidden bg-black">
        {/* Ambient Background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-900 via-black to-black"></div>
        
        {/* Animated Orbs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-secondary/20 rounded-full blur-[80px] animate-pulse delay-700"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-accent/20 rounded-full blur-[80px] animate-pulse delay-300"></div>

        {/* Scanning Line Effect */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.05),transparent)] animate-[slideUp_3s_ease-in-out_infinite] translate-y-[-100%]"></div>

        {/* Content Card */}
        <div className="relative z-10 flex flex-col items-center gap-6 p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl">
           <div className="relative">
              <div className="absolute inset-0 bg-primary/50 blur-xl rounded-full animate-pulse"></div>
              <Sparkles size={48} className="text-white relative z-10 animate-[spin_3s_linear_infinite]" />
           </div>
           
           <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary via-white to-secondary">
                 Generating Sequences
              </h2>
              <div className="flex items-center justify-center gap-2">
                 <Loader2 size={14} className="text-gray-400 animate-spin" />
                 <p className="text-xs font-mono text-gray-400 uppercase tracking-[0.3em]">Please Wait</p>
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-surface/50 border-l border-border">
      
      {/* Header & Global Controls */}
      <div className="flex flex-col border-b border-border bg-surface/[0.2] z-20 shrink-0">
          <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                    <Layers size={14} className="text-text-muted" /> 
                    Sequencer
                  </h3>
                  <span className="text-[10px] bg-text-main/5 px-1.5 py-0.5 rounded text-text-muted font-mono">{beats.length}</span>
              </div>
              
              <div className="flex items-center gap-1">
                  {beats.length > 0 && (
                  <>
                    <button 
                        onClick={() => setShowGlobalSettings(!showGlobalSettings)}
                        className={`h-7 px-2.5 rounded-md transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide border ${showGlobalSettings ? 'bg-primary/20 text-primary border-primary/20' : 'text-text-muted border-transparent hover:text-text-main hover:bg-text-main/5'}`}
                    >
                        <Settings2 size={12} /> Config
                    </button>
                    
                    <div className="w-px h-3 bg-border mx-1"></div>
                    
                    {isSelectionMode && selectedBeatIds.size >= 2 && (
                        <button 
                            onClick={handleMerge}
                            className="h-7 px-3 bg-secondary hover:bg-secondary/80 text-white rounded-md flex items-center gap-1.5 animate-fade-in shadow-lg shadow-secondary/20 text-[10px] font-bold uppercase"
                        >
                            <Merge size={12} /> Merge ({selectedBeatIds.size})
                        </button>
                    )}
                    
                    <button 
                        onClick={toggleSelectionMode}
                        className={`h-7 w-7 rounded-md flex items-center justify-center transition-all ${isSelectionMode ? 'bg-text-main/20 text-text-main' : 'text-text-muted hover:text-text-main hover:bg-text-main/5'}`}
                        title={isSelectionMode ? "Cancel Selection" : "Select Beats"}
                    >
                        <CheckSquare size={14} />
                    </button>
                  </>
                  )}
              </div>
          </div>

          {/* Global Style Settings Drawer */}
          {showGlobalSettings && beats.length > 0 && (
            <div className="px-4 pb-4 animate-slide-up bg-surface/80 backdrop-blur-md border-b border-border">
                <div className="grid grid-cols-1 gap-3 pt-2">
                        {/* Theme */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-text-muted uppercase">Master Theme</label>
                            <div className="relative">
                                <Palette size={12} className="absolute left-2.5 top-2.5 text-text-muted" />
                                <input 
                                    type="text" 
                                    value={styleSettings.themePrompt}
                                    onChange={(e) => onUpdateStyleSettings({ themePrompt: e.target.value })}
                                    placeholder="e.g. Cinematic, Cyberpunk, Watercolor..."
                                    className="w-full glass-input rounded-lg pl-8 pr-3 py-2 text-xs text-text-main focus:border-primary/50"
                                />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            {/* Style Ref */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-text-muted uppercase">Style Reference</label>
                                <div className="flex gap-2">
                                    {styleSettings.referenceImage && (
                                        <div className="relative group shrink-0">
                                            <img src={styleSettings.referenceImage} className="w-8 h-8 rounded-md object-cover ring-1 ring-border" alt="ref" />
                                            <button onClick={() => onUpdateStyleSettings({ referenceImage: undefined })} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X size={8} /></button>
                                        </div>
                                    )}
                                    <label className="flex-1 cursor-pointer glass-button rounded-lg px-2 text-text-muted flex items-center justify-center gap-2 transition hover:text-text-main h-8 text-[10px] font-medium uppercase tracking-wide">
                                        <Upload size={10} /> {styleSettings.referenceImage ? 'Replace' : 'Upload Image'}
                                        <input type="file" accept="image/*" onChange={handleRefImageUpload} className="hidden" />
                                    </label>
                                </div>
                            </div>
                            
                            {/* Avatar */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-text-muted uppercase">Character / Avatar</label>
                                <div className="flex gap-2">
                                    {styleSettings.avatarImage && (
                                        <div className="relative group shrink-0">
                                            <img src={styleSettings.avatarImage} className="w-8 h-8 rounded-md object-cover ring-1 ring-border" alt="av" />
                                            <button onClick={() => onUpdateStyleSettings({ avatarImage: undefined })} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X size={8} /></button>
                                        </div>
                                    )}
                                    <label className="flex-1 cursor-pointer glass-button rounded-lg px-2 text-text-muted flex items-center justify-center gap-2 transition hover:text-text-main h-8 text-[10px] font-medium uppercase tracking-wide">
                                        <User size={10} /> {styleSettings.avatarImage ? 'Replace' : 'Upload Image'}
                                        <input type="file" accept="image/*" onChange={handleAvatarImageUpload} className="hidden" />
                                    </label>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between gap-4 mt-1 pt-3 border-t border-border">
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-text-muted uppercase">Versions</span>
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="4" 
                                    value={styleSettings.imageCount}
                                    onChange={(e) => onUpdateStyleSettings({ imageCount: Math.max(1, Math.min(4, parseInt(e.target.value) || 1)) })}
                                    className="w-12 glass-input rounded-md px-1 py-1 text-xs text-center text-text-main"
                                />
                             </div>
                             <button 
                                onClick={onBulkGenerate}
                                className="px-4 py-1.5 bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide shadow-lg shadow-primary/20 flex items-center gap-2 transition"
                             >
                                <Wand2 size={12} /> Generate All
                             </button>
                        </div>
                </div>
            </div>
          )}
      </div>
      
      {/* Beat List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-0 space-y-0.5 bg-background/30">
        {beats.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-text-muted text-center px-8">
            <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4 ring-1 ring-border">
                <Layers size={24} className="opacity-30" />
            </div>
            <p className="text-sm font-medium text-text-muted">Sequence Empty</p>
            <p className="text-xs mt-2 text-text-muted/60 max-w-[200px]">Analyze your transcript or script to generate beat segments.</p>
          </div>
        )}

        {beats.map((beat, index) => {
          const isTimeActive = currentTime >= beat.startTime && currentTime < beat.endTime;
          const showSettings = expandedSettingsId === beat.id;
          const showImagePanel = expandedImagePanelId === beat.id;
          const isSelected = selectedBeatIds.has(beat.id);
          const hasImage = !!beat.bRollImage;
          
          return (
            <div 
              key={beat.id}
              className={`relative border-l-2 transition-all duration-200 group
                ${isSelectionMode && isSelected ? 'bg-secondary/10 border-l-secondary' : 
                  isTimeActive ? 'bg-primary/10 border-l-primary' : 'bg-transparent border-l-transparent hover:bg-text-main/5'}
                ${!beat.isEnabled ? 'opacity-40 grayscale' : ''}
              `}
              onClick={() => {
                  if (isSelectionMode) {
                      toggleBeatSelection({ stopPropagation: () => {} } as React.MouseEvent, beat.id);
                  } else {
                      onSeek(beat.startTime);
                  }
              }}
            >
               {/* Beat Row */}
               <div className="flex items-stretch min-h-[72px] relative">
                   
                   {/* Selection Checkbox Overlay */}
                   {isSelectionMode && (
                       <div className="absolute left-2 top-1/2 -translate-y-1/2 z-20" onClick={(e) => toggleBeatSelection(e, beat.id)}>
                           <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-secondary border-secondary' : 'bg-surface border-border'}`}>
                               {isSelected && <Check size={10} className="text-white" />}
                           </div>
                       </div>
                   )}

                   {/* Timecode & Thumb */}
                   <div className={`w-16 flex flex-col items-center justify-center border-r border-border bg-background/50 shrink-0 ${isSelectionMode ? 'opacity-20' : ''}`}>
                       <span className="text-[9px] font-mono text-text-muted mb-1">{beat.startTime.toFixed(1)}s</span>
                       <div className="w-10 h-10 rounded bg-surface border border-border overflow-hidden relative">
                           {beat.bRollImage ? (
                               <img src={beat.bRollImage} className="w-full h-full object-cover" alt="thm" />
                           ) : (
                               <div className="w-full h-full flex items-center justify-center"><ImageIcon size={12} className="text-text-muted" /></div>
                           )}
                       </div>
                   </div>

                   {/* Content */}
                   <div className="flex-1 p-3 flex flex-col justify-center min-w-0">
                       <p className={`text-xs leading-relaxed line-clamp-2 font-medium ${isTimeActive ? 'text-text-main' : 'text-text-main/80'}`}>
                           {beat.textSegment}
                       </p>
                       
                       {!isSelectionMode && (
                       <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            {/* Quick Actions */}
                            <button 
                                onClick={(e) => toggleImagePanel(e, beat)} 
                                className={`h-6 px-2 rounded flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide border transition-colors ${showImagePanel ? 'bg-primary/20 text-primary border-primary/20' : 'bg-surface border-border text-text-muted hover:text-text-main'}`}
                            >
                                <ImageIcon size={10} /> {hasImage ? 'Edit' : 'Create'}
                            </button>

                            <div className="w-px h-3 bg-border"></div>
                            
                            <button onClick={(e) => toggleSettings(e, beat.id)} className={`p-1.5 rounded hover:bg-text-main/5 ${showSettings ? 'text-text-main bg-text-main/5' : 'text-text-muted'}`} title="Settings"><Sliders size={12} /></button>
                            
                            <button 
                                onClick={(e) => {
                                     e.stopPropagation();
                                     onUpdateBeat(beat.id, { overlayType: beat.overlayType === OverlayType.SPLIT ? OverlayType.FULL : OverlayType.SPLIT });
                                }}
                                className={`p-1.5 rounded hover:bg-text-main/5 ${beat.overlayType === OverlayType.SPLIT ? 'text-blue-400' : 'text-text-muted'}`}
                                title={beat.overlayType === OverlayType.SPLIT ? "Active: Split Mode" : "Active: Full Mode"}
                            >
                                {beat.overlayType === OverlayType.SPLIT ? <Layout size={12} /> : <Maximize size={12} />}
                            </button>

                            <button onClick={(e) => handleOpenSplitModal(e, beat)} className="p-1.5 rounded hover:bg-text-main/5 text-text-muted hover:text-yellow-400" title="Split Text Segment"><Scissors size={12} /></button>
                            <button onClick={() => onUpdateBeat(beat.id, { isEnabled: !beat.isEnabled })} className="p-1.5 rounded hover:bg-text-main/5 text-text-muted hover:text-blue-400" title="Toggle Visibility">{beat.isEnabled ? <Eye size={12} /> : <EyeOff size={12} />}</button>
                       </div>
                       )}
                   </div>
               </div>

               {/* Expanded Image Studio */}
               {showImagePanel && !isSelectionMode && (
                   <div className="border-t border-b border-border bg-surface/90 backdrop-blur-md p-3 animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-3">
                            <div className="flex gap-3">
                                <textarea 
                                    className="flex-1 h-20 glass-input rounded-lg p-2.5 text-xs text-text-main placeholder-text-muted outline-none resize-none leading-relaxed"
                                    value={promptInputs[beat.id] || ""}
                                    onChange={(e) => setPromptInputs(prev => ({...prev, [beat.id]: e.target.value}))}
                                    placeholder="Describe the visual..."
                                />
                                <div className="flex flex-col gap-2 w-28 shrink-0">
                                    <button 
                                        onClick={() => onGenerateImage(beat.id, promptInputs[beat.id])}
                                        className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-lg flex flex-col items-center justify-center gap-1 text-[10px] font-bold uppercase transition shadow-lg shadow-primary/20"
                                        disabled={!promptInputs[beat.id]}
                                    >
                                        <Wand2 size={16} /> Generate
                                    </button>
                                    <label className="h-8 glass-button rounded-lg flex items-center justify-center gap-1.5 text-[10px] font-bold text-text-muted hover:text-text-main cursor-pointer uppercase">
                                        <Upload size={12} /> Upload
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(beat.id, e)} />
                                    </label>
                                </div>
                            </div>
                            
                            {/* Override Configs */}
                            <div className="bg-background/40 p-3 rounded-lg border border-border flex flex-col gap-3">
                                 <div className="grid grid-cols-2 gap-3">
                                     <div>
                                         <label className="text-[9px] font-bold text-text-muted uppercase block mb-1">Beat Style</label>
                                         <input 
                                            type="text" 
                                            value={beat.styleConfig?.themePrompt || ""}
                                            onChange={(e) => onUpdateBeat(beat.id, { styleConfig: { ...beat.styleConfig, themePrompt: e.target.value } })}
                                            placeholder={styleSettings.themePrompt || "Theme Override"}
                                            className="w-full glass-input rounded px-2 py-1 text-[10px] text-text-main"
                                         />
                                     </div>
                                     <div>
                                         <label className="text-[9px] font-bold text-text-muted uppercase block mb-1">Versions</label>
                                          <input 
                                            type="number" 
                                            min="1" 
                                            max="4" 
                                            value={beat.styleConfig?.imageCount || ""}
                                            placeholder={styleSettings.imageCount.toString()}
                                            onChange={(e) => onUpdateBeat(beat.id, { styleConfig: { ...beat.styleConfig, imageCount: parseInt(e.target.value) || undefined } })}
                                            className="w-full glass-input rounded px-2 py-1 text-[10px] text-text-main"
                                         />
                                     </div>
                                 </div>
                                 <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                                     <div className="flex-1">
                                        <label className="text-[9px] font-bold text-text-muted uppercase block mb-1">Avatar</label>
                                        <div className="flex items-center gap-1">
                                            {beat.styleConfig?.avatarImage && <div className="w-5 h-5 rounded bg-cover ring-1 ring-border" style={{backgroundImage: `url(${beat.styleConfig.avatarImage})`}} />}
                                            <label className="flex-1 cursor-pointer bg-surface hover:bg-surface/80 rounded h-5 flex items-center justify-center text-[9px] text-text-muted hover:text-text-main border border-border"><Plus size={10} /><input type="file" onChange={(e) => handleLocalBeatImageUpload(beat.id, 'avatarImage', e)} className="hidden" /></label>
                                        </div>
                                     </div>
                                     <div className="flex-1">
                                        <label className="text-[9px] font-bold text-text-muted uppercase block mb-1">Ref</label>
                                        <div className="flex items-center gap-1">
                                            {beat.styleConfig?.referenceImage && <div className="w-5 h-5 rounded bg-cover ring-1 ring-border" style={{backgroundImage: `url(${beat.styleConfig.referenceImage})`}} />}
                                            <label className="flex-1 cursor-pointer bg-surface hover:bg-surface/80 rounded h-5 flex items-center justify-center text-[9px] text-text-muted hover:text-text-main border border-border"><Plus size={10} /><input type="file" onChange={(e) => handleLocalBeatImageUpload(beat.id, 'referenceImage', e)} className="hidden" /></label>
                                        </div>
                                     </div>
                                 </div>
                            </div>

                            {/* Versions */}
                            {beat.bRollOptions && beat.bRollOptions.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                    {beat.bRollOptions.map((imgUrl, idx) => (
                                        <div key={idx} onClick={() => onSelectImage(beat.id, imgUrl)} className={`w-12 h-12 shrink-0 rounded-md overflow-hidden cursor-pointer border-2 transition-all relative ${beat.bRollImage === imgUrl ? 'border-primary ring-1 ring-primary/50' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                                            <img src={imgUrl} className="w-full h-full object-cover" alt="opt" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                   </div>
               )}

               {/* Expanded Transforms */}
               {showSettings && !isSelectionMode && (
                    <div className="border-t border-b border-border bg-surface/90 backdrop-blur-md p-4 animate-slide-up text-xs" onClick={(e) => e.stopPropagation()}>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                            <div className="col-span-2 mb-1">
                                <span className="text-[10px] font-bold text-text-muted uppercase">Transform & Layout</span>
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-text-muted"><span>Scale</span><span>{beat.bRollSettings.scale.toFixed(1)}x</span></div>
                                <input type="range" min="0.5" max="3" step="0.1" value={beat.bRollSettings.scale} onChange={(e) => onUpdateBeat(beat.id, { bRollSettings: { ...beat.bRollSettings, scale: parseFloat(e.target.value) } })} className="w-full accent-primary h-1 bg-text-main/10 rounded-lg appearance-none cursor-pointer" />
                            </div>
                            
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-text-muted"><span>Position X</span><span>{beat.bRollSettings.x}</span></div>
                                <input type="range" min="-50" max="50" step="1" value={beat.bRollSettings.x} onChange={(e) => onUpdateBeat(beat.id, { bRollSettings: { ...beat.bRollSettings, x: parseInt(e.target.value) } })} className="w-full accent-primary h-1 bg-text-main/10 rounded-lg appearance-none cursor-pointer" />
                            </div>

                             <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-text-muted"><span>Position Y</span><span>{beat.bRollSettings.y}</span></div>
                                <input type="range" min="-50" max="50" step="1" value={beat.bRollSettings.y} onChange={(e) => onUpdateBeat(beat.id, { bRollSettings: { ...beat.bRollSettings, y: parseInt(e.target.value) } })} className="w-full accent-primary h-1 bg-text-main/10 rounded-lg appearance-none cursor-pointer" />
                            </div>
                            
                            {beat.overlayType === OverlayType.SPLIT && (
                                <>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-text-muted"><span>Split Height</span><span>{beat.bRollSettings.height}%</span></div>
                                    <input type="range" min="20" max="80" step="5" value={beat.bRollSettings.height || 50} onChange={(e) => onUpdateBeat(beat.id, { bRollSettings: { ...beat.bRollSettings, height: parseInt(e.target.value) } })} className="w-full accent-secondary h-1 bg-text-main/10 rounded-lg appearance-none cursor-pointer" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-text-muted"><span>A-Roll Pan/Crop</span><span>{beat.bRollSettings.aRollOffsetY ?? 50}%</span></div>
                                    <input type="range" min="0" max="100" step="1" value={beat.bRollSettings.aRollOffsetY ?? 50} onChange={(e) => onUpdateBeat(beat.id, { bRollSettings: { ...beat.bRollSettings, aRollOffsetY: parseInt(e.target.value) } })} className="w-full accent-secondary h-1 bg-text-main/10 rounded-lg appearance-none cursor-pointer" />
                                </div>
                                </>
                            )}
                        </div>
                    </div>
               )}
            </div>
          );
        })}
      </div>

      {/* Split Modal */}
      {beatToSplit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
           <div className="glass-panel rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-border bg-surface">
              <div className="p-3 border-b border-border flex justify-between items-center bg-background/30">
                  <h3 className="text-xs font-bold text-text-main flex items-center gap-2 uppercase tracking-wide"><Scissors size={14} className="text-yellow-400" /> Split Segment</h3>
                  <button onClick={() => { setBeatToSplit(null); setSplitSelection(null); }} className="text-text-muted hover:text-text-main transition"><X size={16} /></button>
              </div>
              <div className="p-5">
                  <div className="mb-4 text-xs text-text-muted font-medium"><p>Select text below to define the split point.</p></div>
                  <div className="bg-background/40 rounded-lg p-4 border border-border">
                      <p ref={splitTextRef} onMouseUp={handleModalTextSelect} className="text-sm leading-relaxed text-text-main cursor-text select-text font-serif">{beatToSplit.textSegment}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-end h-5">
                      {splitSelection && <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold uppercase tracking-wide"><Check size={10} /> Ready to split</span>}
                  </div>
              </div>
              <div className="p-3 border-t border-border bg-background/30 flex justify-end gap-2">
                  <button onClick={() => { setBeatToSplit(null); setSplitSelection(null); }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text-main hover:bg-text-main/5 transition">Cancel</button>
                  <button onClick={handleConfirmSplit} disabled={!splitSelection} className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition uppercase tracking-wide shadow-lg ${splitSelection ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-yellow-500/20' : 'bg-text-main/5 text-text-muted cursor-not-allowed border border-border'}`}>Split</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};