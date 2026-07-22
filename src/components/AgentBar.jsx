import React, { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { auth } from '@/lib/firebase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Sparkles, Send, Loader2, CornerDownLeft, FileText, CheckSquare, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * Calls the standalone agent server (server/index.js) at /api/agent — proxied
 * to localhost:8787 in dev by Vite, and to the VM-local process by nginx in
 * production. The Firebase ID token authenticates the caller server-side.
 */
async function callAgent({ message, orgId }) {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in again.');
  const token = await user.getIdToken();

  let res;
  try {
    res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message, orgId }),
    });
  } catch {
    // fetch itself rejected — network down, or nothing serving /api at all
    throw new Error("Couldn't reach the assistant server. Is it running? (cd server && npm run dev)");
  }

  // 502/503/504 from the dev/nginx proxy means the agent server is down or
  // not reachable — the response body is proxy HTML, not our JSON.
  if (res.status === 502 || res.status === 504) {
    throw new Error("The assistant server isn't reachable. Start it with: cd server && npm run dev (see server/README.md).");
  }

  let data = {};
  try { data = await res.json(); } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Shown in the empty transcript — an overview of what the agent can build,
// mirroring the three object types its tools can create (see server/agent-core.js).
const CAPABILITIES = [
  {
    icon: FileText,
    title: 'Document & Note Taking (Pages)',
    items: [
      { label: 'Create Pages', body: 'Write documents, meeting notes, project wikis, or personal logs.' },
      { label: 'Organize Content', body: 'Nest pages within pages to build structured knowledge bases.' },
    ],
  },
  {
    icon: CheckSquare,
    title: 'Task Tracking (Task Board)',
    items: [
      {
        label: 'Create Tasks',
        body: (
          <>
            Track your to-dos with attributes like <strong className="font-medium text-foreground">Status</strong>{' '}
            (Backlog, To Do, In Progress, In Review, Done),{' '}
            <strong className="font-medium text-foreground">Priority</strong> (Low, Medium, High, Urgent),{' '}
            <strong className="font-medium text-foreground">Effort</strong> (XS to XL),{' '}
            <strong className="font-medium text-foreground">Due Dates</strong>, and{' '}
            <strong className="font-medium text-foreground">Assignees</strong>.
          </>
        ),
      },
    ],
  },
  {
    icon: Database,
    title: 'Structured Data (Databases)',
    items: [
      {
        label: 'Create Custom Databases',
        body: 'Build trackers for anything (e.g., CRM, Bug Trackers, Inventory, Content Calendars, or Resource Libraries).',
      },
      {
        label: 'Define Schemas',
        body: 'Add custom columns/properties including text, numbers, dates, checkboxes, and single/multi-select dropdowns.',
      },
      {
        label: 'Add Records',
        body: 'Create and manage individual entries (rows) within any database, each of which can have its own dedicated page content.',
      },
    ],
  },
];

/**
 * AgentBar — a command bar that sends a natural-language request to the
 * workspaceAgent Cloud Function, which creates pages/tasks/databases/records
 * via the Admin SDK. Realtime listeners pick up most writes automatically;
 * we also invalidate all queries after a run so anything non-live refreshes.
 *
 * Opens on Cmd/Ctrl+J or via the floating button.
 */
export default function AgentBar() {
  const { currentOrg } = useWorkspace();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState([]); // { role: 'user'|'agent', text }
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    if (!currentOrg?.id) {
      toast.error('No workspace selected.');
      return;
    }
    setInput('');
    setTurns((t) => [...t, { role: 'user', text: message }]);
    setBusy(true);
    try {
      const data = await callAgent({ message, orgId: currentOrg.id });
      setTurns((t) => [...t, { role: 'agent', text: data.reply || 'Done.' }]);
      // Refresh everything not already covered by realtime listeners.
      queryClient.invalidateQueries();
    } catch (err) {
      const msg = err?.message || 'The assistant could not complete that request.';
      setTurns((t) => [...t, { role: 'agent', text: msg, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        title="Ask AI (⌘J)"
        className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <Sparkles className="h-4 w-4" />
        Ask AI
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> Workspace Assistant
            </DialogTitle>
            <DialogDescription className="sr-only">
              Ask the assistant to create pages, tasks, databases, and records.
            </DialogDescription>
          </DialogHeader>

          {/* Transcript */}
          <div ref={scrollRef} className="max-h-[45vh] overflow-y-auto px-4 py-3 space-y-3">
            {turns.length === 0 && (
              <div className="py-1 space-y-4">
                {CAPABILITIES.map(({ icon: Icon, title, items }) => (
                  <section key={title}>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Icon className="h-4 w-4 shrink-0 text-primary" />
                      {title}
                    </h3>
                    <ul className="mt-1.5 space-y-1 pl-6">
                      {items.map(({ label, body }) => (
                        <li key={label} className="relative text-sm leading-relaxed text-muted-foreground">
                          <span className="absolute -left-3.5 top-2 h-1 w-1 rounded-full bg-muted-foreground/50" />
                          <strong className="font-medium text-foreground">{label}:</strong> {body}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                <p className="border-t border-border pt-3 text-sm italic leading-relaxed text-muted-foreground">
                  If you'd like me to set up a new page, build a database, or create a task list for you, just let me
                  know what you're working on!
                </p>
              </div>
            )}

            {turns.map((turn, i) => (
              <div key={i} className={cn('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap',
                    turn.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : turn.error
                        ? 'bg-destructive/10 text-destructive rounded-bl-sm'
                        : 'bg-muted text-foreground rounded-bl-sm',
                  )}
                >
                  {turn.text}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-border p-3">
            <div className="relative">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Create a database, add a task, make a page…"
                rows={2}
                disabled={busy}
                className="resize-none pr-12 text-sm"
              />
              <Button
                size="icon"
                onClick={() => send()}
                disabled={busy || !input.trim()}
                className="absolute bottom-2 right-2 h-8 w-8"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" /> Enter to send · Shift+Enter for a new line
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
