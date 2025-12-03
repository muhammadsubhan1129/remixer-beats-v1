import React, { useState, useRef, useEffect } from 'react';
import { X, Send, MessageSquare, Reply, User, Trash2 } from 'lucide-react';
import { Comment } from '../types';
import { EmojiPicker } from './EmojiPicker';

interface CollaborationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const INITIAL_COMMENTS: Comment[] = [
  {
    id: '1',
    author: 'Sarah Jenkins',
    role: 'Director',
    text: 'Great start on the intro! Can we switch the B-roll at 0:04 to something more energetic?',
    timestamp: Date.now() - 3600000,
    replies: [
      {
        id: '2',
        author: 'Mike (Editor)',
        role: 'Editor',
        text: 'Sure, I will regenerate that beat with "high energy" in the prompt.',
        timestamp: Date.now() - 1800000,
        replies: []
      }
    ]
  },
  {
    id: '3',
    author: 'David Lee',
    role: 'Client',
    text: 'Love the voiceover tone. Is it possible to make the split screen taller for the product shots?',
    timestamp: Date.now() - 7200000,
    replies: []
  }
];

const formatTime = (timestamp: number) => {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return 'Yesterday';
};

interface CommentBubbleProps {
  comment: Comment;
  onReply: (info: { id: string; author: string }) => void;
  onDelete: (id: string) => void;
  isReply?: boolean;
}

const CommentBubble: React.FC<CommentBubbleProps> = ({ comment, onReply, onDelete, isReply }) => {
  const isMe = comment.author === 'You' || comment.author.includes('Editor'); 

  return (
    <div className={`flex flex-col mb-4 ${isReply ? 'ml-8 mt-2' : ''} animate-slide-up`}>
       {/* Meta Line */}
       <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
          {!isMe && (
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                {comment.author.charAt(0)}
            </div>
          )}
          <span className="text-[10px] font-bold text-gray-300">{comment.author}</span>
          <span className="text-[9px] text-gray-500">{formatTime(comment.timestamp)}</span>
          {isMe && (
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                Y
            </div>
          )}
       </div>

       {/* Bubble */}
       <div className={`relative group max-w-[90%] self-${isMe ? 'end' : 'start'} ${isMe ? 'ml-auto' : ''}`}>
           <div 
             className={`p-3 rounded-2xl text-xs leading-relaxed shadow-md border backdrop-blur-sm transition-all
                ${isMe 
                    ? 'bg-indigo-600/90 text-white border-indigo-500/50 rounded-tr-sm hover:bg-indigo-600' 
                    : 'bg-zinc-800/80 text-gray-200 border-zinc-700/50 rounded-tl-sm hover:bg-zinc-800'
                }
             `}
           >
               {comment.text}
           </div>

           {/* Actions Overlay */}
           <div className={`absolute -bottom-5 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity px-1 ${isMe ? 'right-0 justify-end' : 'left-0 justify-start'}`}>
                {!isReply && (
                    <button onClick={() => onReply({ id: comment.id, author: comment.author })} className="text-[9px] text-gray-500 hover:text-white flex items-center gap-1 transition font-medium">
                        <Reply size={10} /> Reply
                    </button>
                )}
                <button onClick={() => onDelete(comment.id)} className="text-[9px] text-gray-500 hover:text-red-400 flex items-center gap-1 transition">
                    <Trash2 size={10} />
                </button>
           </div>
       </div>

       {/* Recursive Replies */}
       {comment.replies.length > 0 && (
           <div className="mt-2 pl-2 border-l-2 border-zinc-800 ml-2 space-y-2">
               {comment.replies.map(reply => (
                   <CommentBubble key={reply.id} comment={reply} onReply={onReply} onDelete={onDelete} isReply />
               ))}
           </div>
       )}
    </div>
  );
};

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({ isOpen, onClose }) => {
  const [comments, setComments] = useState<Comment[]>(INITIAL_COMMENTS);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string, author: string } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [isOpen, comments]);

  const handleSend = () => {
    if (!inputText.trim()) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      author: 'You',
      role: 'Editor',
      text: inputText,
      timestamp: Date.now(),
      replies: []
    };

    if (replyingTo) {
      setComments(prev => prev.map(c => {
        if (c.id === replyingTo.id) {
          return { ...c, replies: [...c.replies, newComment] };
        }
        return c;
      }));
      setReplyingTo(null);
    } else {
      setComments(prev => [...prev, newComment]);
    }

    setInputText('');
  };

  const handleDelete = (id: string) => {
      setComments(prev => {
          const filteredTopLevel = prev.filter(c => c.id !== id);
          if (filteredTopLevel.length !== prev.length) return filteredTopLevel;
          
          return prev.map(c => ({
              ...c,
              replies: c.replies.filter(r => r.id !== id)
          }));
      });
  };

  const handleEmojiSelect = (emoji: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = inputText;
      const newText = text.substring(0, start) + emoji + text.substring(end);
      setInputText(newText);
      setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />}
      
      <div className={`fixed top-0 right-0 bottom-0 w-[400px] bg-[#09090b] border-l border-white/10 z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="h-14 px-5 border-b border-white/5 flex items-center justify-between bg-zinc-900/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                <MessageSquare size={16} className="text-indigo-400" />
            </div>
            <div>
                <h2 className="text-sm font-bold text-white">Project Discussion</h2>
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> 
                    <span className="text-[10px] text-gray-500 font-medium">3 Active Now</span>
                </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 bg-[#09090b] relative">
           {/* Background Pattern */}
           <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

           {comments.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-4 opacity-50 relative z-10">
               <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center"><MessageSquare size={24} /></div>
               <p className="text-xs font-medium">No messages yet. Start the conversation!</p>
             </div>
           ) : (
             <div className="pb-2 relative z-10">
                {comments.map(comment => (
                  <CommentBubble key={comment.id} comment={comment} onReply={setReplyingTo} onDelete={handleDelete} />
                ))}
                <div ref={messagesEndRef} />
             </div>
           )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-zinc-900/90 border-t border-white/10 relative z-20 backdrop-blur-md">
           {replyingTo && (
             <div className="absolute bottom-full left-0 right-0 px-4 py-2 bg-zinc-800 border-t border-white/5 flex items-center justify-between text-xs animate-slide-up shadow-lg">
                <span className="text-gray-400 flex items-center gap-1"><Reply size={10} /> Replying to <span className="text-indigo-400 font-bold">{replyingTo.author}</span></span>
                <button onClick={() => setReplyingTo(null)} className="text-gray-500 hover:text-white"><X size={12} /></button>
             </div>
           )}
           
           <div className="relative flex gap-2 items-end">
               <div className="flex-1 bg-zinc-950 border border-white/10 rounded-2xl focus-within:bg-zinc-900 focus-within:border-indigo-500/50 transition-colors flex flex-col shadow-inner">
                   <textarea 
                        ref={textareaRef}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                        placeholder={replyingTo ? "Type a reply..." : "Message team..."}
                        className="w-full bg-transparent border-none outline-none text-sm text-gray-200 placeholder-gray-600 p-3 min-h-[44px] max-h-32 resize-none custom-scrollbar"
                        rows={1}
                        style={{height: 'auto'}}
                   />
                   <div className="px-2 pb-2 flex justify-between items-center">
                       <button 
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className={`p-1.5 rounded-lg text-gray-500 hover:text-indigo-400 hover:bg-white/5 transition ${showEmojiPicker ? 'text-indigo-400' : ''}`}
                        >
                            <span className="text-lg leading-none">☺</span>
                       </button>
                   </div>
               </div>
               
               <button 
                 onClick={handleSend}
                 disabled={!inputText.trim()}
                 className="p-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center shrink-0 mb-0.5"
               >
                 <Send size={18} className={inputText.trim() ? 'translate-x-0.5' : ''} />
               </button>

               {showEmojiPicker && (
                   <div className="absolute bottom-full right-0 mb-4 shadow-2xl rounded-xl overflow-hidden">
                       <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
                   </div>
               )}
           </div>
        </div>
      </div>
    </>
  );
};