import { useState, useEffect, useRef, useCallback } from 'react';
import { Bold, Italic, Underline, Strikethrough, Link, Code, Type } from 'lucide-react';
import { cn } from '@/lib/utils';

const TEXT_COLORS = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b', '#ffffff'];
const BG_COLORS = ['#fef9c3', '#fef2f2', '#fff7ed', '#f0fdf4', '#eff6ff', '#faf5ff', '#fdf2f8', '#f1f5f9', '#e2e8f0', '#f8fafc'];

// Notify the nearest contentEditable that its content changed
function notifyChange(node) {
  let el = node;
  while (el && el.getAttribute?.('contenteditable') !== 'true') el = el.parentElement;
  if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
}

function toggleInlineFormat(tagName) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);

  // Check if selection is fully inside an existing element of this tag
  let ancestor = range.commonAncestorContainer;
  if (ancestor.nodeType === 3) ancestor = ancestor.parentElement;
  const existing = ancestor.closest?.(tagName);

  if (existing) {
    // Unwrap: move children out, remove wrapper
    const parent = existing.parentNode;
    while (existing.firstChild) parent.insertBefore(existing.firstChild, existing);
    parent.removeChild(existing);
    parent.normalize();
    notifyChange(parent);
    return;
  }

  // Wrap selection in new element
  try {
    const fragment = range.extractContents();
    const wrapper = document.createElement(tagName);
    wrapper.appendChild(fragment);
    range.insertNode(wrapper);
    // Restore selection to wrapper contents
    const newRange = document.createRange();
    newRange.selectNodeContents(wrapper);
    sel.removeAllRanges();
    sel.addRange(newRange);
    notifyChange(wrapper);
  } catch {
    // Complex multi-element selection – fall back to execCommand
    document.execCommand(tagName === 'strong' ? 'bold' : tagName === 'em' ? 'italic' : tagName === 'u' ? 'underline' : tagName === 's' ? 'strikeThrough' : 'bold', false, null);
  }
}

function applyLink(url) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  try {
    const fragment = range.extractContents();
    anchor.appendChild(fragment);
    range.insertNode(anchor);
    const newRange = document.createRange();
    newRange.selectNodeContents(anchor);
    sel.removeAllRanges();
    sel.addRange(newRange);
    notifyChange(anchor);
  } catch {
    document.execCommand('createLink', false, url);
  }
}

function applyColor(color, mode) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  try {
    const fragment = range.extractContents();
    const span = document.createElement('span');
    if (mode === 'text') span.style.color = color;
    else span.style.backgroundColor = color;
    span.appendChild(fragment);
    range.insertNode(span);
    notifyChange(span);
  } catch {
    if (mode === 'text') document.execCommand('foreColor', false, color);
    else document.execCommand('hiliteColor', false, color);
  }
}

function isTagActive(tagName) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  let node = sel.getRangeAt(0).commonAncestorContainer;
  if (node.nodeType === 3) node = node.parentElement;
  return !!node?.closest?.(tagName);
}

export default function FloatingToolbar() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [activeFormats, setActiveFormats] = useState({});
  const [showColors, setShowColors] = useState(null);
  const [linkInput, setLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const ref = useRef(null);

  const updateActiveFormats = useCallback(() => {
    setActiveFormats({
      bold: isTagActive('strong') || isTagActive('b'),
      italic: isTagActive('em') || isTagActive('i'),
      underline: isTagActive('u'),
      strike: isTagActive('s') || isTagActive('strike'),
      code: isTagActive('code'),
    });
  }, []);

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
      updateActiveFormats();
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [updateActiveFormats]);

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

  const handleFormat = (tagName) => {
    toggleInlineFormat(tagName);
    setTimeout(updateActiveFormats, 0);
  };

  const handleApplyLink = () => {
    if (linkUrl) applyLink(linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`);
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
      <ToolBtn
        onClick={() => handleFormat('strong')}
        title="Bold (Ctrl+B)"
        active={activeFormats.bold}
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => handleFormat('em')}
        title="Italic (Ctrl+I)"
        active={activeFormats.italic}
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => handleFormat('u')}
        title="Underline (Ctrl+U)"
        active={activeFormats.underline}
      >
        <Underline className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => handleFormat('s')}
        title="Strikethrough"
        active={activeFormats.strike}
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => handleFormat('code')}
        title="Inline code"
        active={activeFormats.code}
      >
        <Code className="h-3.5 w-3.5" />
      </ToolBtn>

      <div className="w-px h-5 bg-border mx-0.5" />

      <ToolBtn
        onClick={() => { setLinkInput(!linkInput); setShowColors(null); }}
        title="Link"
        active={linkInput}
      >
        <Link className="h-3.5 w-3.5" />
      </ToolBtn>

      <ToolBtn
        onClick={() => { setShowColors(showColors === 'text' ? null : 'text'); setLinkInput(false); }}
        title="Text color"
        active={showColors === 'text'}
        className="flex-col gap-0"
      >
        <Type className="h-3.5 w-3.5" />
        <span className="w-3 h-0.5 rounded-full bg-foreground" />
      </ToolBtn>

      <ToolBtn
        onClick={() => { setShowColors(showColors === 'bg' ? null : 'bg'); setLinkInput(false); }}
        title="Highlight color"
        active={showColors === 'bg'}
        className="flex-col gap-0"
      >
        <span className="text-[10px] font-bold leading-none">A</span>
        <span className="w-3 h-0.5 rounded-full bg-yellow-300" />
      </ToolBtn>

      {/* Color pickers */}
      {showColors && (
        <div className="absolute top-full mt-1 left-0 bg-popover border border-border rounded-lg shadow-lg p-2 flex gap-1 flex-wrap w-[132px]">
          {(showColors === 'text' ? TEXT_COLORS : BG_COLORS).map(color => (
            <button
              key={color}
              onClick={() => { applyColor(color, showColors); setShowColors(null); }}
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
            onKeyDown={e => { if (e.key === 'Enter') handleApplyLink(); if (e.key === 'Escape') { setLinkInput(false); setLinkUrl(''); } }}
            placeholder="https://..."
            className="flex-1 text-sm px-2 py-1 rounded border border-input bg-background outline-none focus:ring-1 focus:ring-ring"
          />
          <button onClick={handleApplyLink} className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90">Apply</button>
        </div>
      )}
    </div>
  );
}

function ToolBtn({ children, onClick, title, active, className }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'h-7 w-7 flex flex-col items-center justify-center rounded transition-colors text-foreground',
        active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent',
        className
      )}
    >
      {children}
    </button>
  );
}