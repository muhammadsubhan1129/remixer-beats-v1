import React from 'react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_LIST = [
  '😀', '😂', '😍', '🥰', '😎', '🤔', '😐', '🙄', 
  '👍', '👎', '👏', '🙌', '🔥', '✨', '🎉', '🚀', 
  '👀', '✅', '❌', '❤️', '💔', '💡', '🤖', '💩',
  '👋', '🙏', '🤝', '💪', '🧠', '💀', '👻', '👽'
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose }) => {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute z-50 bottom-full mb-2 right-0 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl p-2 w-64 animate-fade-in">
        <div className="grid grid-cols-8 gap-1">
          {EMOJI_LIST.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onSelect(emoji);
                onClose();
              }}
              className="w-7 h-7 flex items-center justify-center text-lg hover:bg-white/10 rounded transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
