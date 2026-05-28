// Shared column-header dropdown — shows Sort / Hide / Delete actions.
// Render only for non-fixed columns; caller decides which actions to expose.
import { ChevronDown, EyeOff, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * @param {Function} [onHide]     – hide this column in the active view
 * @param {Function} [onDelete]   – permanently remove this property
 * @param {Function} [onSortAsc]  – sort ascending by this property
 * @param {Function} [onSortDesc] – sort descending by this property
 */
export default function ColumnHeaderDropdown({ onHide, onDelete, onSortAsc, onSortDesc }) {
  const hasSorts = onSortAsc || onSortDesc;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* opacity-0 until parent has class="group/th" and user hovers */}
        <button
          className="opacity-0 group-hover/th:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent focus:outline-none focus-visible:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-44">
        {onSortAsc && (
          <DropdownMenuItem onClick={onSortAsc} className="gap-2 text-xs">
            <ArrowUp className="w-3.5 h-3.5" /> Sort ascending
          </DropdownMenuItem>
        )}
        {onSortDesc && (
          <DropdownMenuItem onClick={onSortDesc} className="gap-2 text-xs">
            <ArrowDown className="w-3.5 h-3.5" /> Sort descending
          </DropdownMenuItem>
        )}

        {hasSorts && <DropdownMenuSeparator />}

        {onHide && (
          <DropdownMenuItem onClick={onHide} className="gap-2 text-xs">
            <EyeOff className="w-3.5 h-3.5" /> Hide property
          </DropdownMenuItem>
        )}

        {onDelete && onHide && <DropdownMenuSeparator />}
        {onDelete && !onHide && null /* separator only when both present */}

        {onDelete && (
          <DropdownMenuItem
            onClick={onDelete}
            className="gap-2 text-xs text-destructive focus:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete property
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
