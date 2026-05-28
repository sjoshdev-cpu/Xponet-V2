import React, { useState, useEffect } from 'react';
import { Page } from '@/api/firestoreClient';
import { useParams } from 'react-router-dom';
import BlockRenderer from '@/components/editor/BlockRenderer';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, Eye, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function SharedPage() {
  const { token } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    async function load() {
      const pages = await Page.filter({ share_token: token });
      if (pages.length === 0) {
        setError('Page not found or this link is no longer active.');
        setLoading(false);
        return;
      }
      const found = pages[0];

      // Enforce expiry client-side
      if (found.share_expires_at && new Date() > new Date(found.share_expires_at)) {
        setError('This share link has expired.');
        setLoading(false);
        return;
      }

      setPage(found);
      if (!found.share_password) setUnlocked(true);
      setLoading(false);
    }
    load();
  }, [token]);

  const handleUnlock = () => {
    if (passwordInput === page?.share_password) {
      setUnlocked(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-muted-foreground gap-3">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-2">
          <Clock className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-lg font-semibold text-foreground">Link unavailable</p>
        <p className="text-sm text-center max-w-xs">{error || 'This link may have expired or been disabled.'}</p>
        <a href="/" className="text-xs text-primary underline mt-2">Go to Xponet</a>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-full max-w-sm mx-auto p-8 rounded-2xl border border-border bg-card shadow-lg text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{page.icon} {page.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">This page is password protected.</p>
          </div>
          <Input
            type="password"
            placeholder="Enter password..."
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            className={passwordError ? 'border-destructive' : ''}
            autoFocus
          />
          {passwordError && <p className="text-xs text-destructive">Incorrect password. Please try again.</p>}
          <Button onClick={handleUnlock} className="w-full">Unlock</Button>
        </div>
      </div>
    );
  }

  let blocks = [];
  try { blocks = JSON.parse(page.content || '[]'); } catch { blocks = []; }
  const fontStyle = page.font_style || 'sans';
  const isGradient = page.cover_url?.startsWith('linear-gradient');

  return (
    <div className="min-h-screen bg-background">
      {/* Share banner */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border/50">
        <div className="px-6 py-2.5 flex items-center justify-between max-w-[900px] mx-auto">
          <div className="flex items-center gap-2 text-sm">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Shared page</span>
            <span className="text-border">·</span>
            <span className="font-medium truncate max-w-[220px]">{page.icon} {page.title || 'Untitled'}</span>
          </div>
          <div className="flex items-center gap-2">
            {page.share_expires_at && (
              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Expires {format(new Date(page.share_expires_at), 'MMM d, yyyy')}
              </span>
            )}
            <span className="text-xs text-muted-foreground hidden sm:block">
              Powered by <span className="font-bold text-foreground">Xponet</span>
            </span>
          </div>
        </div>
      </div>

      {/* Cover */}
      {page.cover_url && (
        <div
          className="h-[250px] w-full bg-cover"
          style={isGradient ? { background: page.cover_url } : { backgroundImage: `url(${page.cover_url})`, backgroundPositionY: `${page.cover_position || 50}%` }}
        />
      )}

      {/* Content */}
      <div className="max-w-[900px] mx-auto px-6 py-10">
        <div className="text-5xl mb-2">{page.icon || '📄'}</div>
        <h1 className={cn(
          'text-4xl font-bold mb-8',
          fontStyle === 'serif' ? 'font-serif' : fontStyle === 'mono' ? 'font-mono' : 'font-sans'
        )}>
          {page.title || 'Untitled'}
        </h1>
        <div className="pl-8 space-y-0.5">
          {blocks.map((block) => (
            <BlockRenderer
              key={block.id}
              block={block}
              fontStyle={fontStyle}
              onChange={() => {}}
              onDelete={() => {}}
              onAddAfter={() => {}}
            />
          ))}
        </div>
      </div>

      <footer className="border-t border-border py-6 text-center mt-12">
        <p className="text-xs text-muted-foreground">
          Shared with <span className="font-semibold text-foreground">Xponet</span>
          {page.updated_date && <> · Last updated {format(new Date(page.updated_date), 'MMM d, yyyy')}</>}
        </p>
      </footer>
    </div>
  );
}