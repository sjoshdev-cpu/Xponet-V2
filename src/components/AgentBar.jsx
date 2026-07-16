import React, { useState, useRef, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { useQueryClient } from '@tanstack/react-query';
import { functions } from '@/lib/firebase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Sparkles, Send, Loader2, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const workspaceAgent = httpsCallable(functions, 'workspaceAgent');

const EXAMPLES = [
  'Create a bug tracker database with Status and Priority columns',
  'Add a task to fix the login redirect, high priority, due next Friday',
  'Make a page called Onboarding Checklist',
  'Add a CRM record for Acme Corp',
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
      const { data } = await workspaceAgent({ message, orgId: currentOrg.id });
      setTurns((t) => [...t, { role: 'agent', text: data.reply || 'Done.' }]);
      // Refresh everything not already covered by realtime listeners.
      queryClient.invalidateQueries();
    } catch (err) {
      const msg =
        err?.code === 'functions/unauthenticated' ? 'Please sign in again.'
        : err?.code === 'functions/permission-denied' ? "You're not a member of this workspace."
        : err?.message || 'The assistant could not complete that request.';
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
              <div className="py-2">
                <p className="text-sm text-muted-foreground mb-2.5">
                  Describe what you want and I'll build it in this workspace. Try:
                </p>
                <div className="flex flex-col gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => send(ex)}
                      className="text-left text-sm px-3 py-2 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
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
