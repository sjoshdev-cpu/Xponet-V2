import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Settings2, Eye, EyeOff } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { DatabaseView } from '@/api/firestoreClient.js';
import { cn } from '@/lib/utils';

// ─── Properties shown in the panel (in display order) ─────────────────────
// title is intentionally omitted — it is always visible and non-toggleable.

const TOGGLEABLE_PROPS = [
  {
    key: 'created_time',
    label: 'Created time',
    description: 'Date the document was created',
  },
  {
    key: 'category',
    label: 'Category',
    description: 'Document category tag',
  },
  {
    key: 'last_edited_by',
    label: 'Last edited by',
    description: 'Who made the most recent edit',
  },
  {
    key: 'last_edited_time',
    label: 'Last updated time',
    description: 'Date of the most recent edit',
  },
  {
    key: 'reviewers',
    label: 'Reviewers',
    description: 'Assigned reviewer avatars',
  },
];

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * CustomizeDatabaseSheet
 *
 * A right-side sheet for toggling which columns are visible in a database view.
 * Uses optimistic UI — the column list is updated in the TanStack Query cache
 * immediately on toggle, then persisted to Firestore in the background.
 *
 * Props:
 *   open         {boolean}          controlled open state
 *   onOpenChange {(open) => void}   controlled open state setter
 *   activeView   {object}           the current DatabaseView document
 *   viewsQueryKey {unknown[]}       TanStack Query key for the views list
 *                                   used to optimistically update + invalidate
 */
export default function CustomizeDatabaseSheet({
  open,
  onOpenChange,
  activeView,
  viewsQueryKey,
}) {
  const qc = useQueryClient();

  // Current visible columns (excluding title, which is always shown)
  const visibleColumns = activeView?.visibleColumns ?? [];

  // ── Mutation with optimistic update ────────────────────────────────────
  const { mutate: persistColumns } = useMutation({
    mutationFn: ({ viewId, columns }) =>
      DatabaseView.update(viewId, { visibleColumns: columns }),

    onMutate: async ({ columns }) => {
      // Prevent race: cancel any in-flight re-fetches for this query
      await qc.cancelQueries({ queryKey: viewsQueryKey });

      // Snapshot current data for rollback
      const previous = qc.getQueryData(viewsQueryKey);

      // Apply optimistic update to cache so the table re-renders immediately
      qc.setQueryData(viewsQueryKey, (old) =>
        (old ?? []).map((v) =>
          v.id === activeView?.id ? { ...v, visibleColumns: columns } : v
        )
      );

      return { previous };
    },

    onError: (_err, _vars, ctx) => {
      // Roll back if the Firestore write fails
      if (ctx?.previous !== undefined) {
        qc.setQueryData(viewsQueryKey, ctx.previous);
      }
    },

    onSettled: () => {
      // Re-sync with server after success or error
      qc.invalidateQueries({ queryKey: viewsQueryKey });
    },
  });

  // ── Toggle handler ──────────────────────────────────────────────────────
  function handleToggle(key, currentlyVisible) {
    if (!activeView?.id) return;

    const nextColumns = currentlyVisible
      ? visibleColumns.filter((c) => c !== key)
      : [...visibleColumns, key];

    persistColumns({ viewId: activeView.id, columns: nextColumns });
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 sm:max-w-80 flex flex-col gap-0 p-0">
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-border gap-1">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-muted-foreground" />
            <SheetTitle className="text-sm font-semibold">Customize Document Hub</SheetTitle>
          </div>
          <SheetDescription className="text-xs text-muted-foreground pl-6">
            Select features to turn on or off
          </SheetDescription>
        </SheetHeader>

        {/* Always-visible row (non-toggleable) */}
        <div className="px-5 pt-4 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Always visible
          </p>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2.5">
              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">Doc name</span>
            </div>
            <Switch checked disabled size="sm" aria-label="Doc name is always visible" />
          </div>
        </div>

        <Separator />

        {/* Toggleable properties */}
        <div className="px-5 pt-3 pb-4 flex-1 overflow-y-auto">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Properties
          </p>

          <div className="space-y-0.5">
            {TOGGLEABLE_PROPS.map((prop) => {
              const isVisible = visibleColumns.includes(prop.key);
              return (
                <div
                  key={prop.key}
                  className={cn(
                    'flex items-center justify-between rounded-md px-2 py-2.5 transition-colors',
                    'hover:bg-muted/50 cursor-pointer group'
                  )}
                  onClick={() => handleToggle(prop.key, isVisible)}
                  role="row"
                  aria-label={`Toggle ${prop.label}`}
                >
                  <div className="flex items-center gap-2.5">
                    {isVisible ? (
                      <Eye className="w-3.5 h-3.5 text-primary shrink-0" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                    )}
                    <div>
                      <p
                        className={cn(
                          'text-sm leading-none',
                          isVisible ? 'text-foreground font-medium' : 'text-muted-foreground'
                        )}
                      >
                        {prop.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-none">
                        {prop.description}
                      </p>
                    </div>
                  </div>

                  <Switch
                    checked={isVisible}
                    size="sm"
                    aria-label={prop.label}
                    // Prevent double-fire: the row's onClick handles toggling
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={(checked) => handleToggle(prop.key, !checked)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-border">
          <p className="text-[11px] text-muted-foreground/60 text-center">
            Changes are saved automatically per view.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
