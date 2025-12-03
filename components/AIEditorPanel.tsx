
import React, { useState, useRef, useEffect } from 'react';
import { Send, Plus, MessageSquare, Copy, RefreshCw, ArrowDownToLine, Sparkles, Trash2, ChevronLeft, ChevronRight, Loader2, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { ChatSession, ChatMessage } from '../types';
import { sendChatMessage } from '../services/geminiService';
// @ts-ignore
import { parse } from 'marked';

interface AIEditorPanelProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onNewSession: () => void;
  onSwitchSession: (id: string) => void;
  onUpdateSession: (session: ChatSession) => void;
  onDeleteSession: (id: string) => void;
  selectedContext: string;
  onInsert: (text: string) => void;
  onReplace: (text: string) => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

export const AIEditorPanel: React.FC<AIEditorPanelProps> = ({
  sessions,
  currentSessionId,
  onNewSession,
  onSwitchSession,
  onUpdateSession,
  onDeleteSession,
  selectedContext,
  onInsert,
  onReplace,
  isCollapsed,
  onToggle
}) => {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!isCollapsed) {
        scrollToBottom();
    }
  }, [currentSession?.messages, isCollapsed]);

  const handleSend = async () => {
    if (!input.trim() || !currentSession) return;
    
    setIsSending(true);
    const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        text: input,
        timestamp: Date.now()
    };

    // Optimistic Update
    const updatedMessages = [...currentSession.messages, userMsg];
    const updatedSession = { 
        ...currentSession, 
        messages: updatedMessages, 
        lastUpdated: Date.now(),
        // Auto-title if first message
        title: currentSession.messages.length === 0 ? input.slice(0, 30) : currentSession.title
    };
    onUpdateSession(updatedSession);
    setInput("");

    try {
        const responseText = await sendChatMessage(
            currentSession.messages,
            input,
            selectedContext
        );

        const aiMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: responseText,
            timestamp: Date.now()
        };

        onUpdateSession({
            ...updatedSession,
            messages: [...updatedMessages, aiMsg]
        });

    } catch (e) {
        console.error("Chat Error", e);
    } finally {
        setIsSending(false);
    }
  };

  // Helper to render markdown content
  const renderContent = (text: string) => {
    try {
      // marked.parse can be sync or async depending on options, standard usage is sync
      const html = parse(text) as string; 
      return { __html: html };
    } catch (e) {
      return { __html: text };
    }
  };

  // Convert markdown to clean HTML for insertion (unwrapping single P tags)
  const cleanHtml = (markdown: string): string => {
      try {
          const html = parse(markdown) as string;
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html;
          
          // Unwrap if it is a single paragraph to avoid nested blocks
          if (tempDiv.childNodes.length === 1 && tempDiv.firstChild?.nodeName === 'P') {
              return (tempDiv.firstChild as HTMLElement).innerHTML;
          }
          return html;
      } catch (e) {
          return markdown;
      }
  };

  // Handlers for Insert/Replace that sanitize/convert Markdown first
  const handleInsert = (text: string) => {
      onInsert(cleanHtml(text));
  };

  const handleReplace = (text: string) => {
      onReplace(cleanHtml(text));
  };

  // COLLAPSED VIEW
  if (isCollapsed) {
      return (
          <div className="h-full flex flex-col items-center py-4 gap-4 bg-surface w-full">
              <button onClick={onToggle} className="p-2 rounded-lg bg-surface hover:bg-white/10 text-text-muted hover:text-text-main transition" title="Expand AI Panel">
                  <PanelRightOpen size={18} />
              </button>
              
              <div className="w-8 h-px bg-border" />
              
              <button onClick={onNewSession} className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition" title="New Chat">
                  <Plus size={18} />
              </button>
              
              <div className="flex-1 flex items-center justify-center [writing-mode:vertical-rl] rotate-180 text-text-muted text-[10px] font-bold tracking-[0.2em] uppercase select-none opacity-50">
                  AI Copilot
              </div>
          </div>
      );
  }

  // EXPANDED VIEW
  return (
    <div className="h-full flex flex-col bg-surface relative w-full overflow-hidden">
       
       {/* Header */}
       <div className="h-12 border-b border-border flex items-center justify-between px-3 shrink-0 bg-background/50">
           <div className="flex items-center gap-2 overflow-hidden">
               <button onClick={onToggle} className="p-1.5 hover:bg-white/10 rounded-lg text-text-muted hover:text-text-main transition" title="Collapse Panel">
                   <PanelRightClose size={16} />
               </button>
               <div className="h-4 w-px bg-border mx-1"></div>
               <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 hover:bg-white/10 rounded-lg text-text-muted hover:text-text-main transition" title="History">
                   {isSidebarOpen ? <ChevronRight size={16} /> : <MessageSquare size={16} />}
               </button>
               <span className="text-xs font-bold text-text-main truncate ml-1">
                   {currentSession?.title || "AI Editor"}
               </span>
           </div>
           <button onClick={onNewSession} className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg transition" title="New Chat">
               <Plus size={16} />
           </button>
       </div>

       <div className="flex-1 flex min-h-0 relative">
           
           {/* Sidebar (History) */}
           <div className={`absolute inset-y-0 left-0 z-20 w-64 bg-[#121214] border-r border-border transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl`}>
               <div className="p-3 border-b border-border flex justify-between items-center bg-zinc-900">
                   <span className="text-[10px] font-bold text-text-muted uppercase">History</span>
                   <button onClick={() => setIsSidebarOpen(false)}><ChevronLeft size={14} className="text-text-muted" /></button>
               </div>
               <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                   {sessions.sort((a,b) => b.lastUpdated - a.lastUpdated).map(session => (
                       <div 
                         key={session.id} 
                         onClick={() => { onSwitchSession(session.id); setIsSidebarOpen(false); }}
                         className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${currentSessionId === session.id ? 'bg-primary/20 text-text-main' : 'text-text-muted hover:bg-white/5 hover:text-text-main'}`}
                       >
                           <span className="truncate flex-1">{session.title}</span>
                           <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                           >
                               <Trash2 size={12} />
                           </button>
                       </div>
                   ))}
               </div>
           </div>

           {/* Chat Area */}
           <div className="flex-1 flex flex-col min-w-0 bg-[#09090b]">
               <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                   {currentSession?.messages.length === 0 && (
                       <div className="h-full flex flex-col items-center justify-center text-text-muted opacity-50 space-y-2">
                           <Sparkles size={32} />
                           <p className="text-xs">Ask AI to write or edit script...</p>
                       </div>
                   )}
                   
                   {currentSession?.messages.map((msg) => (
                       <div key={msg.id} className={`flex flex-col gap-1 max-w-[95%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
                           <div className={`p-3 rounded-2xl text-xs leading-relaxed ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-sm shadow-md' : 'bg-surface border border-border text-gray-200 rounded-tl-sm'}`}>
                               {/* Render Markdown Content */}
                               <div 
                                 className="prose"
                                 dangerouslySetInnerHTML={renderContent(msg.text)}
                               />
                           </div>
                           
                           {/* AI Actions */}
                           {msg.role === 'model' && (
                               <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity px-1">
                                   <button onClick={() => navigator.clipboard.writeText(msg.text)} className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-white" title="Copy"><Copy size={12} /></button>
                                   <button onClick={() => handleInsert(msg.text)} className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-white flex items-center gap-1" title="Insert at cursor"><ArrowDownToLine size={12} /></button>
                                   {selectedContext && (
                                       <button onClick={() => handleReplace(msg.text)} className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-emerald-400 flex items-center gap-1" title="Replace Selection"><RefreshCw size={12} /></button>
                                   )}
                               </div>
                           )}
                       </div>
                   ))}
                   {isSending && (
                       <div className="self-start bg-surface border border-border p-3 rounded-2xl rounded-tl-sm flex items-center gap-2 animate-pulse">
                           <Loader2 size={14} className="animate-spin text-primary" />
                           <span className="text-xs text-text-muted">Thinking...</span>
                       </div>
                   )}
                   <div ref={messagesEndRef} />
               </div>

               {/* Input Area */}
               <div className="p-3 bg-surface border-t border-border">
                   {selectedContext && (
                       <div className="mb-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between group">
                           <div className="flex items-center gap-2 overflow-hidden">
                               <span className="text-[10px] font-bold text-primary uppercase whitespace-nowrap">Context:</span>
                               <span className="text-xs text-text-muted truncate italic max-w-[200px]">"{selectedContext}"</span>
                           </div>
                       </div>
                   )}
                   <div className="relative">
                       <textarea
                           value={input}
                           onChange={(e) => setInput(e.target.value)}
                           onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                           placeholder="Type a message..."
                           className="w-full bg-[#09090b] border border-border rounded-xl pl-3 pr-10 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 resize-none custom-scrollbar transition-colors"
                           rows={1}
                           style={{ minHeight: '44px', maxHeight: '120px' }}
                       />
                       <button 
                           onClick={handleSend}
                           disabled={!input.trim() || isSending}
                           className="absolute right-2 bottom-2 p-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-primary/20"
                       >
                           <Send size={14} />
                       </button>
                   </div>
               </div>
           </div>
       </div>
    </div>
  );
};
