import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Download, Trash2 } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  label?: string;
  onDelete?: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, label, onDelete }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => setIsPlaying(false);
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, []);

  return (
    <div className="flex items-center justify-between bg-black/20 hover:bg-black/40 p-3 rounded-xl mb-2 border border-white/5 transition-all group">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button 
          onClick={togglePlay}
          className="w-8 h-8 shrink-0 flex items-center justify-center bg-white/10 hover:bg-primary hover:text-white rounded-full text-gray-300 transition-all shadow-sm border border-white/5"
        >
          {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
        </button>
        <div className="text-xs text-gray-300 truncate font-medium group-hover:text-white transition-colors select-none">
          {label || 'Audio Clip'}
        </div>
      </div>
      
      <audio ref={audioRef} src={src} className="hidden" />
      
      <div className="flex items-center gap-1 shrink-0">
        <a 
          href={src} 
          download={`audio-${Date.now()}.wav`}
          className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
          title="Download"
        >
          <Download size={14} />
        </a>
        {onDelete && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-gray-500 hover:text-red-400 transition-colors p-1.5 rounded-full hover:bg-white/10"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
};