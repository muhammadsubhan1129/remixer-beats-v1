
import React, { useState } from 'react';
import { X, Smartphone, Monitor, Video, User, Upload, Check, Wand2 } from 'lucide-react';

interface GenerateVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: { resolution: '720p' | '1080p'; aspectRatio: '9:16' | '16:9'; avatarImage?: string }) => void;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop'
];

export const GenerateVideoModal: React.FC<GenerateVideoModalProps> = ({ isOpen, onClose, onGenerate }) => {
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [avatarMode, setAvatarMode] = useState<'preset' | 'upload' | 'none'>('none');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [uploadedAvatar, setUploadedAvatar] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedAvatar(reader.result as string);
        setAvatarMode('upload');
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const convertUrlToBase64 = async (url: string): Promise<string> => {
      try {
          const response = await fetch(url);
          const blob = await response.blob();
          return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
          });
      } catch (e) {
          console.error("Failed to load preset image", e);
          return "";
      }
  };

  const handleSubmit = async () => {
      let finalAvatar: string | undefined = undefined;

      if (avatarMode === 'upload' && uploadedAvatar) {
          finalAvatar = uploadedAvatar;
      } else if (avatarMode === 'preset' && selectedPreset) {
          finalAvatar = await convertUrlToBase64(selectedPreset);
      }

      onGenerate({
          aspectRatio,
          resolution,
          avatarImage: finalAvatar
      });
      onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
           <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Video size={16} className="text-white" />
              </div>
              <h2 className="text-sm font-bold text-white tracking-wide">Generate AI Video</h2>
           </div>
           <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition">
             <X size={16} />
           </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
            
            {/* 1. Dimension & Resolution */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Format</label>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setAspectRatio('9:16')}
                            className={`flex-1 flex flex-col items-center justify-center gap-2 py-3 rounded-xl border transition-all ${aspectRatio === '9:16' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
                        >
                            <Smartphone size={20} />
                            <span className="text-[10px] font-bold">9:16</span>
                        </button>
                        <button 
                            onClick={() => setAspectRatio('16:9')}
                            className={`flex-1 flex flex-col items-center justify-center gap-2 py-3 rounded-xl border transition-all ${aspectRatio === '16:9' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
                        >
                            <Monitor size={20} />
                            <span className="text-[10px] font-bold">16:9</span>
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Resolution</label>
                    <div className="flex flex-col gap-2">
                        <button 
                            onClick={() => setResolution('720p')}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${resolution === '720p' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
                        >
                            <span className="text-xs font-medium">720p HD</span>
                            {resolution === '720p' && <Check size={14} />}
                        </button>
                        <button 
                            onClick={() => setResolution('1080p')}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${resolution === '1080p' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
                        >
                            <span className="text-xs font-medium">1080p FHD</span>
                            {resolution === '1080p' && <Check size={14} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Avatar Selection */}
            <div className="space-y-3 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Avatar / Starting Frame</label>
                    <div className="flex bg-white/5 rounded-lg p-0.5">
                        <button onClick={() => setAvatarMode('none')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${avatarMode === 'none' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>None</button>
                        <button onClick={() => setAvatarMode('preset')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${avatarMode === 'preset' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Presets</button>
                        <button onClick={() => setAvatarMode('upload')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${avatarMode === 'upload' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Upload</button>
                    </div>
                </div>
                
                {avatarMode === 'preset' && (
                    <div className="grid grid-cols-3 gap-2">
                        {AVATAR_PRESETS.map((src) => (
                            <button 
                                key={src}
                                onClick={() => setSelectedPreset(src)}
                                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${selectedPreset === src ? 'border-primary ring-2 ring-primary/20' : 'border-transparent opacity-60 hover:opacity-100'}`}
                            >
                                <img src={src} className="w-full h-full object-cover" alt="Avatar Preset" />
                                {selectedPreset === src && <div className="absolute inset-0 bg-primary/20 flex items-center justify-center"><Check size={20} className="text-white drop-shadow-md" /></div>}
                            </button>
                        ))}
                    </div>
                )}

                {avatarMode === 'upload' && (
                     <label className="flex flex-col items-center justify-center gap-2 h-24 border border-dashed border-white/20 rounded-xl bg-white/5 hover:bg-white/10 transition cursor-pointer group">
                        {uploadedAvatar ? (
                             <div className="relative w-full h-full p-2">
                                 <img src={uploadedAvatar} className="w-full h-full object-contain rounded-lg" alt="Uploaded" />
                                 <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                                     <Upload size={20} className="text-white" />
                                 </div>
                             </div>
                        ) : (
                             <>
                                <Upload size={20} className="text-gray-400 group-hover:text-white transition-colors" />
                                <span className="text-[10px] text-gray-500 font-medium">Click to upload image</span>
                             </>
                        )}
                        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                     </label>
                )}
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white/[0.02] border-t border-white/5 flex justify-end">
            <button 
                onClick={handleSubmit}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wide shadow-lg shadow-purple-500/20 flex items-center gap-2 transition transform active:scale-95"
            >
                <Wand2 size={14} /> Generate Video
            </button>
        </div>

      </div>
    </div>
  );
};
