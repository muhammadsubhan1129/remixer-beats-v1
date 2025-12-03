
import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { ScriptBlock } from '../types';
import { Bold, Italic, AlignLeft, AlignCenter, Heading2, GripVertical, Mic, Loader2 } from 'lucide-react';

export interface ScriptEditorRef {
  insertAtCursor: (text: string) => void;
  replaceSelection: (text: string) => void;
}

interface ScriptEditorProps {
  blocks: ScriptBlock[];
  onChange: (blocks: ScriptBlock[]) => void;
  onGenerateSpeech: (text?: string) => void;
  isGeneratingTTS: boolean;
  onSelectionChange: (text: string) => void;
}

// --- Memoized Block Component ---
interface BlockItemProps {
  block: ScriptBlock;
  index: number;
  isActive: boolean;
  isHighlighted?: boolean;
  onFocus: (id: string) => void;
  onBlur: (id: string, content: string) => void;
  onSplit: (index: number, contentBefore: string, contentAfter: string) => void;
  onMerge: (index: number) => void;
  onNavigate: (index: number, direction: 'up' | 'down') => void;
  onDragStart: (index: number) => void;
  onDragEnter: (index: number) => void;
  onDragEnd: () => void;
}

const BlockItem = React.memo(({ 
  block, index, isActive, isHighlighted, onFocus, onBlur, onSplit, onMerge, onNavigate, onDragStart, onDragEnter, onDragEnd 
}: BlockItemProps) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);

      const marker = `__SPLIT_${Date.now()}__`;
      const markerNode = document.createTextNode(marker);
      range.deleteContents();
      range.insertNode(markerNode);
      
      const fullHtml = contentRef.current?.innerHTML || '';
      const parts = fullHtml.split(marker);
      
      onSplit(index, parts[0] || '', parts.slice(1).join('') || '');
      
    } else if (e.key === 'Backspace') {
       const selection = window.getSelection();
       if (selection && selection.rangeCount > 0 && selection.isCollapsed) {
           if (!contentRef.current?.textContent && index > 0) {
               e.preventDefault();
               onMerge(index);
           }
       }
    } else if (e.key === 'ArrowUp') {
      if (index > 0) {
        e.preventDefault();
        onNavigate(index, 'up');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onNavigate(index, 'down');
    }
  };

  return (
    <div 
      className={`group flex items-start gap-2 p-1.5 rounded-lg transition-all duration-700 border
        ${isHighlighted 
            ? 'bg-indigo-500/20 border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.15)] scale-[1.01] z-10' 
            : isActive 
                ? 'bg-text-main/5 border-border' 
                : 'hover:bg-text-main/5 border-transparent'
        }
      `}
      id={`block-wrapper-${block.id}`}
      onDragEnter={() => onDragEnter(index)}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
    >
       <div 
         className="mt-1 cursor-grab active:cursor-grabbing text-text-muted hover:text-text-main opacity-0 group-hover:opacity-100 transition-opacity p-1"
         draggable
         onDragStart={() => onDragStart(index)}
       >
          <GripVertical size={14} />
       </div>

       <div 
          ref={contentRef}
          className={`flex-1 min-w-0 outline-none transition-colors duration-300
              ${block.type === 'h1' ? 'text-xl font-bold text-text-main mb-2' : 
                block.type === 'h2' ? 'text-lg font-semibold text-text-main/90 mb-1' : 
                block.type === 'blockquote' ? 'pl-4 border-l-4 border-primary/50 italic text-text-muted py-1 my-1' : 
                'text-sm text-text-main leading-relaxed'}
              ${block.align === 'center' ? 'text-center' : block.align === 'right' ? 'text-right' : 'text-left'}
          `}
          id={`block-${block.id}`}
          contentEditable
          suppressContentEditableWarning
          onFocus={() => onFocus(block.id)}
          onBlur={(e) => onBlur(block.id, e.currentTarget.innerHTML)}
          onKeyDown={handleKeyDown}
          dangerouslySetInnerHTML={{ __html: block.content }}
          onClick={(e) => e.stopPropagation()}
       />
    </div>
  );
}, (prev, next) => {
    return (
        prev.block.id === next.block.id &&
        prev.block.content === next.block.content &&
        prev.block.align === next.block.align &&
        prev.block.type === next.block.type &&
        prev.index === next.index &&
        prev.isActive === next.isActive &&
        prev.isHighlighted === next.isHighlighted
    );
});

BlockItem.displayName = "BlockItem";

export const ScriptEditor = forwardRef<ScriptEditorRef, ScriptEditorProps>(({ blocks, onChange, onGenerateSpeech, isGeneratingTTS, onSelectionChange }, ref) => {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(null);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const savedRange = useRef<Range | null>(null);

  // Trigger flash animation on the block element
  const flashBlock = (node: Node) => {
      let el = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
      const blockWrapper = el?.closest('[id^="block-wrapper-"]');
      if (blockWrapper) {
          blockWrapper.classList.remove('animate-success-flash');
          void (blockWrapper as HTMLElement).offsetWidth; // trigger reflow
          blockWrapper.classList.add('animate-success-flash');
      } else if (activeBlockId) {
          // Fallback to active block
          const activeWrapper = document.getElementById(`block-wrapper-${activeBlockId}`);
          if (activeWrapper) {
              activeWrapper.classList.remove('animate-success-flash');
              void activeWrapper.offsetWidth;
              activeWrapper.classList.add('animate-success-flash');
          }
      }
  };

  // --- Exposed Methods for AI Panel ---
  useImperativeHandle(ref, () => ({
    insertAtCursor: (text: string) => {
        // Always create a new block for insertion
        const newBlock: ScriptBlock = {
            id: `block-${Date.now()}`,
            content: text,
            align: 'left',
            type: 'p'
        };
        
        let insertIndex = blocks.length;
        if (activeBlockId) {
             const idx = blocks.findIndex(b => b.id === activeBlockId);
             if (idx !== -1) insertIndex = idx + 1;
        }

        const newBlocks = [...blocks];
        newBlocks.splice(insertIndex, 0, newBlock);
        onChange(newBlocks);
        
        // Highlight and scroll to the new block
        setHighlightedBlockId(newBlock.id);
        setTimeout(() => setHighlightedBlockId(null), 2000);
        
        setTimeout(() => {
            const el = document.getElementById(`block-wrapper-${newBlock.id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    },
    replaceSelection: (text: string) => {
        if (savedRange.current) {
             const range = savedRange.current;
             const root = range.commonAncestorContainer;
             const isConnected = root.nodeType === Node.ELEMENT_NODE ? document.contains(root) : document.contains(root.parentNode);
             if (isConnected) {
                 range.deleteContents();
                 const fragment = document.createRange().createContextualFragment(text);
                 const firstChild = fragment.firstChild;
                 range.insertNode(fragment);
                 syncBlockContent();
                 if (firstChild) flashBlock(firstChild);
             }
        }
    }
  }));

  // --- Toolbar & Selection Logic ---
  useEffect(() => {
    let rafId: number;

    const updateSelection = () => {
       const sel = window.getSelection();
       if (!sel || sel.rangeCount === 0) {
           setSelectionRect(null);
           onSelectionChange("");
           savedRange.current = null;
           return;
       }

       // Scope Validation
       const range = sel.getRangeAt(0);
       let container: Node | null = range.commonAncestorContainer;
       while (container && container.nodeType === 3) {
           container = container.parentNode;
       }
       
       if (editorRef.current && container && editorRef.current.contains(container)) {
           const text = sel.toString();
           if (text.length > 0) {
               // Update selection for parent
               onSelectionChange(text);
               savedRange.current = range.cloneRange();

               // UI Rect for Toolbar
               const rect = range.getBoundingClientRect();
               if (rect.width > 0 || rect.height > 0) {
                   setSelectionRect(rect);
                   return;
               }
           } else {
               // Cursor but no selection text - still save range for insert
               savedRange.current = range.cloneRange();
               onSelectionChange(""); 
           }
       }
       
       setSelectionRect(null);
    };

    const handleSelectionChange = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(updateSelection);
    };

    const handleMouseDown = (e: MouseEvent) => {
       if (toolbarRef.current && toolbarRef.current.contains(e.target as Node)) {
           return;
       }
    };

    const handleScroll = () => {
        handleSelectionChange();
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mousedown', handleMouseDown);
    
    const editorEl = editorRef.current;
    if (editorEl) editorEl.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);

    return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
        document.removeEventListener('mousedown', handleMouseDown);
        if (editorEl) editorEl.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleScroll);
        if (rafId) cancelAnimationFrame(rafId);
    };
  }, [onSelectionChange]);

  const handleBlockChange = useCallback((id: string, newContent: string) => {
    const block = blocks.find(b => b.id === id);
    if (block && block.content === newContent) return;
    onChange(blocks.map(b => b.id === id ? { ...b, content: newContent } : b));
  }, [blocks, onChange]);

  const handleFormat = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    syncBlockContent();
  }, [activeBlockId, blocks]);

  const syncBlockContent = () => {
      if (activeBlockId) {
          const el = document.getElementById(`block-${activeBlockId}`);
          if (el) {
              const newBlocks = blocks.map(b => b.id === activeBlockId ? { ...b, content: el.innerHTML } : b);
              onChange(newBlocks);
          }
      }
  };

  const handleAlign = useCallback((align: 'left' | 'center' | 'right') => {
    if (activeBlockId) {
      const newBlocks = blocks.map(b => b.id === activeBlockId ? { ...b, align } : b);
      onChange(newBlocks);
    }
  }, [activeBlockId, blocks, onChange]);

  const handleTypeChange = useCallback((type: 'p' | 'h1' | 'h2' | 'blockquote') => {
    if (activeBlockId) {
      const newBlocks = blocks.map(b => b.id === activeBlockId ? { ...b, type } : b);
      onChange(newBlocks);
    }
  }, [activeBlockId, blocks, onChange]);

  const handleSplit = useCallback((index: number, contentBefore: string, contentAfter: string) => {
      const newBlocks = [...blocks];
      newBlocks[index] = { ...newBlocks[index], content: contentBefore };
      const newBlock: ScriptBlock = {
          id: `block-${Date.now()}`,
          content: contentAfter,
          align: 'left',
          type: 'p'
      };
      newBlocks.splice(index + 1, 0, newBlock);
      onChange(newBlocks);
      
      setTimeout(() => {
          const el = document.getElementById(`block-${newBlock.id}`);
          if (el) {
              el.focus();
          }
      }, 0);
  }, [blocks, onChange]);

  const handleMerge = useCallback((index: number) => {
      if (index === 0) return;
      const newBlocks = blocks.filter((_, i) => i !== index);
      onChange(newBlocks);
      setTimeout(() => {
          const prevBlock = blocks[index - 1];
          if (prevBlock) document.getElementById(`block-${prevBlock.id}`)?.focus();
      }, 0);
  }, [blocks, onChange]);

  const handleNavigate = useCallback((index: number, direction: 'up' | 'down') => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const targetBlock = blocks[targetIndex];
      if (targetBlock) {
          document.getElementById(`block-${targetBlock.id}`)?.focus();
      }
  }, [blocks]);

  // --- Drag & Drop ---
  const handleDragStart = useCallback((index: number) => {
      dragItem.current = index;
  }, []);
  const handleDragEnter = useCallback((index: number) => {
      dragOverItem.current = index;
  }, []);
  const handleSort = useCallback(() => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const _blocks = [...blocks];
      const draggedItemContent = _blocks.splice(dragItem.current, 1)[0];
      _blocks.splice(dragOverItem.current, 0, draggedItemContent);
      onChange(_blocks);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  }, [blocks, onChange]);

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-xl overflow-hidden relative group/editor shadow-sm">
      
      {/* Editor Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background/50 shrink-0">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Script Content</span>
          <button 
            onClick={() => onGenerateSpeech()}
            disabled={isGeneratingTTS || blocks.length === 0}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed group"
            title="Convert full script to speech"
          >
            {isGeneratingTTS ? <Loader2 size={12} className="animate-spin" /> : <Mic size={12} />}
            <span className="text-[10px] font-bold uppercase">Generate Full Audio</span>
          </button>
      </div>

      {/* Main Editor Area - Scrollable */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3" ref={editorRef}>
        {blocks.map((block, index) => (
          <BlockItem 
             key={block.id}
             block={block}
             index={index}
             isActive={activeBlockId === block.id}
             isHighlighted={highlightedBlockId === block.id}
             onFocus={setActiveBlockId}
             onBlur={handleBlockChange}
             onSplit={handleSplit}
             onMerge={handleMerge}
             onNavigate={handleNavigate}
             onDragStart={handleDragStart}
             onDragEnter={handleDragEnter}
             onDragEnd={handleSort}
          />
        ))}
        {/* Clickable space at bottom */}
        <div className="h-20 cursor-text" onClick={() => {
            // Optional: focus last block
        }} />
      </div>

      {/* Floating Toolbar (Text Formatting) */}
      {selectionRect && (
        <div 
          ref={toolbarRef}
          className="fixed z-50 flex items-center gap-0.5 p-1 rounded-lg bg-surface/90 backdrop-blur-md border border-border shadow-xl animate-fade-in"
          style={{ 
            top: selectionRect.top - 40, 
            left: Math.max(10, Math.min(window.innerWidth - 250, selectionRect.left))
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('bold')} className="p-1.5 hover:bg-text-main/10 rounded text-text-muted hover:text-text-main"><Bold size={14} /></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('italic')} className="p-1.5 hover:bg-text-main/10 rounded text-text-muted hover:text-text-main"><Italic size={14} /></button>
          
          <div className="w-px h-3 bg-border mx-1"></div>
          
          <button 
            onMouseDown={(e) => e.preventDefault()} 
            onClick={() => {
                const text = window.getSelection()?.toString();
                if (text) onGenerateSpeech(text);
            }}
            disabled={isGeneratingTTS}
            className="p-1.5 hover:bg-emerald-500/10 hover:text-emerald-400 rounded text-text-muted hover:text-text-main disabled:opacity-50 transition-colors"
            title="Generate Audio from Selection"
          >
            {isGeneratingTTS ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
          </button>

          <div className="w-px h-3 bg-border mx-1"></div>

          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleAlign('left')} className="p-1.5 hover:bg-text-main/10 rounded text-text-muted hover:text-text-main"><AlignLeft size={14} /></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleAlign('center')} className="p-1.5 hover:bg-text-main/10 rounded text-text-muted hover:text-text-main"><AlignCenter size={14} /></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleTypeChange('h2')} className="p-1.5 hover:bg-text-main/10 rounded text-text-muted hover:text-text-main"><Heading2 size={14} /></button>
        </div>
      )}
    </div>
  );
});

ScriptEditor.displayName = 'ScriptEditor';
