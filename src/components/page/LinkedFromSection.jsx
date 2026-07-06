import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getBacklinks } from '@/api/firestoreClient';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Link2 } from 'lucide-react';

/**
 * Collapsible "Backlinks" section shown at the bottom of each page.
 * Queries pages where mentionedIn contains this pageId.
 */
export function LinkedFromSection({ pageId }) {
  const [open, setOpen] = useState(false);

  const { data: backlinks = [], isLoading } = useQuery({
    queryKey: ['backlinks', pageId],
    queryFn: () => getBacklinks(pageId),
    enabled: !!pageId,
    // Don't hammer Firestore — cache for 60 s
    staleTime: 60_000,
  });

  // Hide entirely when there are no backlinks
  if (isLoading || backlinks.length === 0) return null;

  return (
    <div className="mt-10 pt-6 border-t border-border/50">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
          <Link2 className="h-3.5 w-3.5 shrink-0" />
          <span>Backlinks</span>
          <span className="ml-0.5 text-xs bg-muted px-1.5 py-0.5 rounded-full font-normal">
            {backlinks.length}
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-3 space-y-0.5 pl-5">
            {backlinks.map((bl) => (
              <Link
                key={bl.sourcePageId}
                to={`/page/${bl.sourcePageId}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 px-3 py-1.5 rounded-md transition-colors"
              >
                <span className="text-base leading-none shrink-0">
                  {bl.sourceIcon || '📄'}
                </span>
                <span className="truncate">{bl.sourceTitle || 'Untitled'}</span>
              </Link>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
