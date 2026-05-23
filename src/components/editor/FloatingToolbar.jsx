import React, { useState, useEffect, useRef } from 'react';
import { Bold, Italic, Underline, Strikethrough, Link, Code, Type } from 'lucide-react';
import { cn } from '@/lib/utils';

const TEXT_COLORS = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b', '#ffffff'];
const BG_COLORS = ['#fef9c3', '#fef2f2', '#fff7ed', '#f0fdf4', '#eff6ff', '#faf5ff', '#fdf2f8', '#f1f5f9', '#e2e8f0', '#f8fafc'];

export default function FloatingToolbar() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showColors, setShowColors] = useState(null); // 'text' | 'bg' | null
  const [linkInput, setLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setVisible(false);
        setShowColors(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0) { setVisible(false); return; }
      setPosition({
        top: rect.top + window.scrollY - 48,
        left: Math.max(8, rect.left + rect.width / 2 - 200),
      });
      setVisible(true);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setShowColors(null);
        setLinkInput(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const exec = (cmd, val) => {
    document.execCommand(cmd, false, val);
    window.getSelection()?.collapseToEnd();
  };

  const applyColor = (color) => {
    if (showColors === 'text') exec('foreColor', color);
    else exec('hiliteColor', color);
    setShowColors(null);
  };

  const applyLink = () => {
    if (linkUrl) exec('createLink', linkUrl);
    setLinkInput(false);
    setLinkUrl('');
  };

  if (!visible) return null;

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl flex items-center gap-0.5 px-1.5 py-1"
      style={{ top: position.top, left: position.left }}
      onMouseDown={e => e.preventDefault()}
    >
      <ToolBtn onClick={() => exec('bold')} title="Bold"><Bold className="h-3.5 w-3.5" /></ToolBtn>
      <ToolBtn onClick={() => exec('italic')} title="Italic"><Italic className="h-3.5 w-3.5" /></ToolBtn>
      <ToolBtn onClick={() => exec('underline')} title="Underline"><Underline className="h-3.5 w-3.5" /></ToolBtn>
      <ToolBtn onClick={() => exec('strikeThrough')} title="Strikethrough"><Strikethrough className="h-3.5 w-3.5" /></ToolBtn>
      <ToolBtn onClick={() => exec('formatBlock', '<code>')} title="Inline code"><Code className="h-3.5 w-3.5" /></ToolBtn>

      <div className="w-px h-5 bg-border mx-0.5" />

      <ToolBtn
        onClick={() => { setLinkInput(!linkInput); setShowColors(null); }}
        title="Link"
      >
        <Link className="h-3.5 w-3.5" />
      </ToolBtn>

      <ToolBtn
        onClick={() => { setShowColors(showColors === 'text' ? null : 'text'); setLinkInput(false); }}
        title="Text color"
        className={showColors === 'text' ? 'bg-accent' : ''}
      >
        <Type className="h-3.5 w-3.5" />
        <span className="w-3 h-1 rounded-full bg-foreground mt-0.5" />
      </ToolBtn>

      <ToolBtn
        onClick={() => { setShowColors(showColors === 'bg' ? null : 'bg'); setLinkInput(false); }}
        title="Highlight color"
        className={showColors === 'bg' ? 'bg-accent' : ''}
      >
        <span className="text-[10px] font-bold">A</span>
        <span className="w-3 h-1 rounded-full bg-yellow-300 mt-0.5" />
      </ToolBtn>

      {/* Color pickers */}
      {showColors && (
        <div className="absolute top-full mt-1 left-0 bg-popover border border-border rounded-lg shadow-lg p-2 flex gap-1 flex-wrap w-[132px]">
          {(showColors === 'text' ? TEXT_COLORS : BG_COLORS).map(color => (
            <button
              key={color}
              onClick={() => applyColor(color)}
              className="w-7 h-7 rounded-md border border-border hover:scale-110 transition-transform"
              style={{ background: color }}
              title={color}
            />
          ))}
        </div>
      )}

      {/* Link input */}
      {linkInput && (
        <div className="absolute top-full mt-1 left-0 bg-popover border border-border rounded-lg shadow-lg p-2 flex gap-2 w-72">
          <input
            autoFocus
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyLink()}
            placeholder="https://..."
            className="flex-1 text-sm px-2 py-1 rounded border border-input bg-background outline-none focus:ring-1 focus:ring-ring"
          />
          <button onClick={applyLink} className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90">Apply</button>
        </div>
      )}
    </div>
  );
}

function ToolBtn({ children, onClick, title, className }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn('h-7 w-7 flex flex-col items-center justify-center rounded hover:bg-accent transition-colors text-foreground', className)}
    >
      {children}
    </button>
  );
}