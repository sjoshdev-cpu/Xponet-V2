import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '@/api/firestoreClient';
import { useQuery } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  CommandDialog, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList
} from '@/components/ui/command';
import { FileText, Clock, Search } from 'lucide-react';

export default function CommandPalette({ open, onOpenChange }) {
  const { currentOrg, user } = useWorkspace();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: pages = [] } = useQuery({
    queryKey: ['pages', currentOrg?.id],
    queryFn: () => Page.filter({ org_id: currentOrg?.id }),
    enabled: !!currentOrg?.id
  });

  const activePages = pages.filter(p => !p.is_deleted && !p.is_template);

  const filtered = search
    ? activePages.filter(p =>
        (p.title || '').toLowerCase().includes(search.toLowerCase())
      )
    : activePages.slice(0, 8);

  // Keyboard shortcut
  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages..." value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
            <Search className="h-8 w-8" />
            <p>No results found</p>
          </div>
        </CommandEmpty>
        <CommandGroup heading={search ? 'Results' : 'Recent pages'}>
          {filtered.map(page => (
            <CommandItem
              key={page.id}
              onSelect={() => {
                navigate(`/page/${page.id}`);
                onOpenChange(false);
                setSearch('');
              }}
              className="flex items-center gap-2"
            >
              <span className="text-sm">{page.icon || '📄'}</span>
              <span>{page.title || 'Untitled'}</span>
              {!search && <Clock className="h-3 w-3 ml-auto text-muted-foreground" />}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}