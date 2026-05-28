import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────
// Content serialization helpers
// ─────────────────────────────────────────────

/**
 * Serialize a { text, mentions } object to a JSON string for storage.
 * mentions = [{ email, name }]
 */
export function serializeContent(text, mentions) {
  return JSON.stringify({ v: 2, text, mentions: mentions || [] });
}

/**
 * Deserialize stored content. Handles both:
 *   v2  — JSON { v: 2, text, mentions }
 *   v1  — plain-text string (legacy)
 */
export function deserializeContent(raw) {
  if (!raw) return { text: '', mentions: [] };
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.v === 2) return parsed;
  } catch (_) {}
  return { text: raw, mentions: [] };
}

/**
 * renderContent(raw) → React node(s)
 * Replaces @Name patterns from mentions with styled chips.
 * Falls back to plain text for legacy comments.
 */
export function renderContent(raw) {
  const { text, mentions } = deserializeContent(raw);
  if (!text) return null;
  if (!mentions || mentions.length === 0) return <>{text}</>;

  const parts = [];
  let remaining = text;
  let key = 0;

  for (const m of mentions) {
    const tag = `@${m.name}`;
    const idx = remaining.indexOf(tag);
    if (idx === -1) continue;
    if (idx > 0) parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>);
    parts.push(
      <span
        key={key++}
        className="inline-flex items-center gap-0.5 bg-primary/10 text-primary rounded px-1 text-sm font-medium cursor-default"
        title={m.email}
      >
        @{m.name}
      </span>,
    );
    remaining = remaining.slice(idx + tag.length);
  }
  if (remaining) parts.push(<span key={key++}>{remaining}</span>);
  return parts.length > 0 ? <>{parts}</> : <>{text}</>;
}

// ─────────────────────────────────────────────
// MentionInput component
// ─────────────────────────────────────────────

/**
 * Smart textarea with @mention picker.
 *
 * Props:
 *   value      — { text: string, mentions: [{email, name}] }
 *   onChange   — ({ text, mentions }) => void
 *   members    — [{ email, name }]   workspace members
 *   onSubmit   — () => void          called on Enter (no Shift)
 *   placeholder, className, rows
 */
export default function MentionInput({
  value,
  onChange,
  members = [],
  placeholder,
  className,
  onSubmit,
  rows = 2,
  autoFocus,
}) {
  const [mentionQuery, setMentionQuery] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const textareaRef = useRef(null);
  const atIndexRef = useRef(-1);

  const text = value?.text ?? (typeof value === 'string' ? value : '');
  const mentions = value?.mentions ?? [];

  const filteredMembers = mentionQuery
    ? members.filter(
        (m) =>
          (m.name || '').toLowerCase().includes(mentionQuery.toLowerCase()) ||
          (m.email || '').toLowerCase().includes(mentionQuery.toLowerCase()),
      )
    : members.slice(0, 8);

  const handleChange = (e) => {
    const newText = e.target.value;
    const pos = e.target.selectionStart;
    const textBeforeCursor = newText.slice(0, pos);
    const lastAt = textBeforeCursor.lastIndexOf('@');

    if (lastAt !== -1) {
      const afterAt = textBeforeCursor.slice(lastAt + 1);
      // Show picker only while there's no space/newline after @
      if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
        atIndexRef.current = lastAt;
        setMentionQuery(afterAt);
        setShowPicker(true);
      } else {
        setShowPicker(false);
      }
    } else {
      setShowPicker(false);
    }

    onChange({ text: newText, mentions });
  };

  const handleMentionSelect = (member) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const atIdx = atIndexRef.current;

    const before = text.slice(0, atIdx);
    const after = text.slice(pos);
    const insertedName = `@${member.name} `;
    const newText = before + insertedName + after;

    // De-duplicate mentions by email
    const newMentions = [
      ...mentions.filter((m) => m.email !== member.email),
      { email: member.email, name: member.name },
    ];

    onChange({ text: newText, mentions: newMentions });
    setShowPicker(false);
    setMentionQuery('');
    atIndexRef.current = -1;

    setTimeout(() => {
      if (!ta) return;
      ta.focus();
      const newPos = (before + insertedName).length;
      ta.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (showPicker && (e.key === 'Escape' || e.key === ' ')) {
      setShowPicker(false);
    }
    if (e.key === 'Enter' && !e.shiftKey && !showPicker && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handler = (e) => {
      if (!textareaRef.current?.parentElement?.contains(e.target)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        className={cn(
          'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none',
          className,
        )}
      />

      {/* Mention picker dropdown */}
      {showPicker && filteredMembers.length > 0 && (
        <div className="absolute z-50 bottom-full left-0 mb-1 w-60 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="py-1">
            {filteredMembers.map((m) => (
              <button
                key={m.email}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleMentionSelect(m);
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
              >
                <span className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {(m.name || m.email || '?').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="font-medium truncate">{m.name || m.email}</div>
                  {m.name && (
                    <div className="text-[10px] text-muted-foreground truncate">{m.email}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-border px-3 py-1.5">
            <p className="text-[10px] text-muted-foreground">Type a name to filter</p>
          </div>
        </div>
      )}
    </div>
  );
}
