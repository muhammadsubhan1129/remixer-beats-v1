import React, { useState, useEffect, forwardRef, useRef } from 'react';
import { Beat, LayoutMode, OverlayType, VideoComment } from '../types';
import { Play, Pause, MessageCircle, Send, X, Check, MoreVertical, Reply, Trash2, CheckCircle2 } from 'lucide-react';

interface VideoComposerProps {
  aRollUrl: string;
  beats: Beat[];
  layoutMode: LayoutMode;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  videoComments: VideoComment[];
  onTogglePlay: () => void;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onEnded: () => void;
  onSeek: (time: number) => void;
  onScrubStart: () => void;
  onScrubEnd: () => void;
  onAddComment: (timestamp: number, text: string) => void;
  onDeleteComment: (id: string) => void;
  onReplyComment: (commentId: string, text: string) => void;
  onResolveComment: (id: string) => void;
}

export const VideoComposer = forwardRef<HTMLVideoElement, VideoComposerProps>(({
  aRollUrl,
  beats,
  layoutMode,
  currentTime,
  duration,
  isPlaying,
  videoComments,
  onTogglePlay,
  onTimeUpdate,
  onDurationChange,
  onEnded,
  onSeek,
  onScrubStart,
  onScrubEnd,
  onAddComment,
  onDeleteComment,
  onReplyComment,
  onResolveComment
}, ref) => {
  const [currentBeat, setCurrentBeat] = useState<Beat | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [showCommentPanel, setShowCommentPanel] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const commentListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const activeBeat = beats.find(b => currentTime >= b.startTime && currentTime < b.endTime && b.isEnabled);
    setCurrentBeat(activeBeat || null);
  }, [currentTime, beats]);

  // Scroll to comment when timestamp is hit (optional UX, maybe too jumpy)
  // Instead, let's just highlight markers

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    onTimeUpdate(e.currentTarget.currentTime);
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    onDurationChange(e.currentTarget.duration);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      onSeek(time);
  };

  const handleMarkerClick = (e: React.MouseEvent, time: number) => {
      e.stopPropagation();
      onSeek(time);
      setShowCommentPanel(true);
      // Optional: scroll to comment logic here
  };

  const handleSubmitComment = () => {
      if (!newCommentText.trim()) return;
      onAddComment(currentTime, newCommentText);
      setNewCommentText("");
      // Don't auto-close, user might want to see it added
  };

  const handleSubmitReply = (commentId: string) => {
      if (!replyText.trim()) return;
      onReplyComment(commentId, replyText);
      setReplyText("");
      setReplyingToId(null);
  };

  // Determine if we are in Split Mode
  const isSplitMode = currentBeat && currentBeat.isEnabled && currentBeat.overlayType === OverlayType.SPLIT;
  const splitHeight = currentBeat?.bRollSettings?.height || 50;
  const aRollOffsetY = currentBeat?.bRollSettings?.aRollOffsetY ?? 50;

  // Format time (mm:ss)
  const formatTime = (t: number) => {
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const spacerSvg = layoutMode === LayoutMode.PORTRAIT 
    ? "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='1600' viewBox='0 0 900 1600'%3E%3C/svg%3E"
    : "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='900' viewBox='0 0 1600 900'%3E%3C/svg%3E";

  // Sort comments by timestamp
  const sortedComments = [...videoComments].sort((a, b) => a.videoTimestamp - b.videoTimestamp);

  return (
    <div className="w-full h-full flex items-center justify-center p-2">
        <div 
            className="relative bg-black shadow-2xl ring-1 ring-white/10 group overflow-hidden flex"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {/* Spacer Image */}
            <img 
                src={spacerSvg} 
                alt="" 
                className="block w-auto h-auto max-w-full max-h-full object-contain opacity-0 pointer-events-none select-none relative z-0"
                style={{ maxHeight: 'calc(100vh - 150px)', maxWidth: '100%' }} 
            />

            {/* Absolute Content Layer (Video) */}
            <div className="absolute inset-0 z-10 flex flex-col w-full h-full bg-black">
                
                {/* --- B-Roll Layer (Split Mode) --- */}
                {isSplitMode && (
                    <div 
                        className="w-full relative overflow-hidden bg-gray-900 border-b border-white/5 transition-all duration-300 ease-out"
                        style={{ height: `${splitHeight}%` }}
                    >
                        {currentBeat?.bRollImage ? (
                            <img 
                                src={currentBeat.bRollImage} 
                                alt="B-Roll" 
                                className="w-full h-full object-cover"
                                style={{
                                    transform: `translate(${currentBeat.bRollSettings.x}%, ${currentBeat.bRollSettings.y}%) scale(${currentBeat.bRollSettings.scale})`,
                                    transformOrigin: 'center center'
                                }}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/5">
                                <span className="text-gray-500 text-[9px] uppercase font-bold tracking-widest bg-black/40 px-2 py-1 rounded backdrop-blur">No Visual</span>
                            </div>
                        )}
                    </div>
                )}

                {/* --- A-Roll Layer --- */}
                <div 
                  className="w-full relative transition-all duration-300 ease-out bg-black overflow-hidden"
                  style={{
                     height: isSplitMode ? `${100 - splitHeight}%` : '100%'
                  }}
                >
                  <video
                    ref={ref}
                    src={aRollUrl}
                    playsInline
                    className={`w-full h-full ${isSplitMode ? 'object-cover' : 'object-contain'}`}
                    style={{
                        objectPosition: isSplitMode ? `50% ${aRollOffsetY}%` : 'center'
                    }}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={onEnded}
                    loop={false}
                    onClick={onTogglePlay}
                  />
                </div>
            
                {/* Full Overlay */}
                {currentBeat && currentBeat.isEnabled && !isSplitMode && currentBeat.bRollImage && (
                    <div className="absolute inset-0 z-20 overflow-hidden pointer-events-none">
                        <img 
                            src={currentBeat.bRollImage} 
                            alt="Overlay" 
                            className="w-full h-full object-cover"
                            style={{
                                transform: `translate(${currentBeat.bRollSettings.x}%, ${currentBeat.bRollSettings.y}%) scale(${currentBeat.bRollSettings.scale})`,
                                transformOrigin: 'center center'
                            }}
                        />
                    </div>
                )}

                 {/* Controls Overlay */}
                <div className={`absolute bottom-0 left-0 right-0 z-30 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${isHovering || !isPlaying || showCommentPanel ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="flex flex-col gap-2 relative">
                        {/* Timeline Container */}
                        <div className="relative h-4 flex items-center group/timeline cursor-pointer">
                            {/* Marker Layer (Under thumb, over track) */}
                            <div className="absolute inset-x-0 h-1 top-1.5 z-20 pointer-events-none">
                                {videoComments.map(comment => (
                                    <div 
                                        key={comment.id}
                                        className={`absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 transition-transform hover:scale-150 cursor-pointer pointer-events-auto shadow-sm ring-1 ring-black/50 ${comment.isResolved ? 'bg-emerald-500/50' : 'bg-yellow-400'}`}
                                        style={{ left: `${(comment.videoTimestamp / duration) * 100}%` }}
                                        onClick={(e) => handleMarkerClick(e, comment.videoTimestamp)}
                                        title={`${comment.author}: ${comment.text}`}
                                    />
                                ))}
                            </div>

                            {/* Native Slider */}
                            <input 
                                type="range" 
                                min="0" 
                                max={duration || 100} 
                                step="0.01"
                                value={currentTime}
                                onChange={handleSeekChange}
                                onMouseDown={onScrubStart}
                                onMouseUp={onScrubEnd}
                                onTouchStart={onScrubStart}
                                onTouchEnd={onScrubEnd}
                                className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-primary hover:h-1.5 transition-all relative z-10"
                            />
                        </div>
                        
                        {/* Buttons */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button onClick={onTogglePlay} className="text-white hover:text-primary transition-colors">
                                    {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                                </button>
                                <span className="text-[10px] font-mono text-gray-300">
                                    {formatTime(currentTime)} / {formatTime(duration)}
                                </span>
                            </div>
                            
                            <button 
                                onClick={() => {
                                    if(isPlaying) onTogglePlay(); // Pause to comment
                                    setShowCommentPanel(!showCommentPanel);
                                }}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all border ${showCommentPanel ? 'bg-white text-black border-white' : 'bg-white/10 text-white border-white/10 hover:bg-white/20'}`}
                            >
                                <MessageCircle size={12} />
                                {videoComments.length > 0 ? `${videoComments.length} Notes` : 'Add Note'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Comment Sidebar (Inside Video Container) */}
            {showCommentPanel && (
                <div className="absolute top-0 right-0 bottom-0 w-72 bg-[#121214]/95 backdrop-blur-xl border-l border-white/10 z-40 flex flex-col animate-slide-up shadow-2xl">
                    <div className="h-12 border-b border-white/5 flex items-center justify-between px-4 bg-white/[0.02]">
                        <span className="text-xs font-bold text-gray-200">Video Notes</span>
                        <button onClick={() => setShowCommentPanel(false)} className="text-gray-500 hover:text-white transition">
                            <X size={14} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3" ref={commentListRef}>
                         {sortedComments.length === 0 ? (
                             <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
                                 <MessageCircle size={24} className="opacity-20" />
                                 <p className="text-[10px]">No notes yet.</p>
                                 <p className="text-[10px] text-center px-4">Pause the video at a specific frame to add a timestamped comment.</p>
                             </div>
                         ) : (
                             sortedComments.map(comment => (
                                 <div 
                                    key={comment.id} 
                                    className={`group rounded-lg p-3 border transition-all ${Math.abs(currentTime - comment.videoTimestamp) < 1 ? 'bg-white/10 border-primary/30 ring-1 ring-primary/20' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                                >
                                     <div className="flex items-center justify-between mb-1.5">
                                         <button 
                                            onClick={() => onSeek(comment.videoTimestamp)}
                                            className="text-[10px] font-mono font-bold text-yellow-400 bg-yellow-400/10 px-1.5 rounded hover:bg-yellow-400/20 transition"
                                         >
                                             {formatTime(comment.videoTimestamp)}
                                         </button>
                                         <div className="flex items-center gap-2">
                                            {comment.isResolved && <CheckCircle2 size={12} className="text-emerald-500" />}
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => onResolveComment(comment.id)} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-emerald-400" title="Resolve"><Check size={10} /></button>
                                                <button onClick={() => onDeleteComment(comment.id)} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-red-400" title="Delete"><Trash2 size={10} /></button>
                                            </div>
                                         </div>
                                     </div>
                                     <div className="flex items-start gap-2 mb-2">
                                         <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[8px] font-bold text-white shrink-0">
                                             {comment.author.charAt(0)}
                                         </div>
                                         <div className="flex-1 min-w-0">
                                             <p className={`text-xs text-gray-300 leading-relaxed break-words ${comment.isResolved ? 'line-through opacity-50' : ''}`}>{comment.text}</p>
                                         </div>
                                     </div>

                                     {/* Replies */}
                                     {comment.replies.map(reply => (
                                         <div key={reply.id} className="ml-7 mt-2 pt-2 border-t border-white/5 flex items-start gap-2">
                                            <div className="w-4 h-4 rounded-full bg-gray-700 flex items-center justify-center text-[7px] font-bold text-gray-300 shrink-0">
                                                {reply.author.charAt(0)}
                                            </div>
                                            <p className="text-[10px] text-gray-400 leading-relaxed">{reply.text}</p>
                                         </div>
                                     ))}

                                     {/* Reply Input */}
                                     {replyingToId === comment.id ? (
                                         <div className="ml-7 mt-2 flex gap-1">
                                             <input 
                                                autoFocus
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSubmitReply(comment.id)}
                                                className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white focus:border-primary/50 outline-none"
                                                placeholder="Reply..."
                                             />
                                             <button onClick={() => handleSubmitReply(comment.id)} className="p-1 bg-white/10 hover:bg-white/20 rounded text-white"><Send size={10} /></button>
                                         </div>
                                     ) : (
                                         !comment.isResolved && (
                                            <button 
                                                onClick={() => setReplyingToId(comment.id)}
                                                className="ml-7 mt-1 text-[9px] text-gray-500 hover:text-gray-300 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Reply size={9} /> Reply
                                            </button>
                                         )
                                     )}
                                 </div>
                             ))
                         )}
                    </div>

                    {/* New Comment Input */}
                    <div className="p-3 border-t border-white/10 bg-black/40">
                         <div className="flex items-center justify-between mb-2 text-[10px] text-gray-500">
                             <span>Adding note at <span className="text-yellow-400 font-mono font-bold">{formatTime(currentTime)}</span></span>
                         </div>
                         <div className="flex gap-2">
                             <input 
                                value={newCommentText}
                                onChange={(e) => setNewCommentText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                                placeholder="Type a note..."
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-colors"
                             />
                             <button 
                                onClick={handleSubmitComment}
                                disabled={!newCommentText.trim()}
                                className="p-2 rounded-lg bg-primary hover:bg-primary/90 text-white disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-primary/20"
                             >
                                <Send size={14} />
                             </button>
                         </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
});

VideoComposer.displayName = 'VideoComposer';