/**
 * TableBlock — rich, interactive table block for the page editor.
 *
 * Persists via block.rows (string[][]) and block.colWidths (number[]).
 * All mutations call onChange(updatedBlock) which flows through the normal
 * debounced-save pipeline in PageEditor.
 *
 * Features
 *  • Column header hover → "+" button on the right edge to add a column
 *  • "+ Add row" button below the last row
 *  • Draggable column-resize handles (mouse drag on right border of header cell)
 *  • Column header right-click context menu: Rename, Insert left/right, Delete, Sort A→Z
 *  • Row hover menu (MoreHorizontal): Insert above/below, Delete
 *  • Tab / Shift+Tab cell navigation; Tab on last cell of last row adds a new row
 *  • Cell selection with blue highlight on click; Shift+click extends rectangular selection
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, ArrowUp, ArrowDown, MoreHorizontal,
  SortAsc, Pencil, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_COL_WIDTH = 150;
const MIN_COL_WIDTH = 64;

// ── TableCellEditor ───────────────────────────────────────────────────────────
// Controlled contentEditable cell that syncs value from props without clobbering
// the browser cursor position during normal typing.

function TableCellEditor({ value, onChange, placeholder, className, cellKey, onKeyDown, onClick }) {
  const ref = useRef(null);

  // Sync innerHTML from props only when it has actually changed externally
  // (e.g., a column was sorted or a cell was cleared programmatically).
  // The comparison prevents React from resetting the caret on every keystroke.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== (value || '')) {
      el.innerHTML = value || '';
    }
  });

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-cell={cellKey}
      data-placeholder={placeholder}
      className={cn(
        'outline-none min-h-[1em] w-full select-text',
        // Show placeholder when empty (relies on .empty-placeholder::before CSS)
        !value && placeholder && 'empty-placeholder',
        className,
      )}
      onInput={(e) => onChange(e.currentTarget.innerHTML)}
      onKeyDown={onKeyDown}
      onClick={onClick}
    />
  );
}

// ── TableBlock ────────────────────────────────────────────────────────────────

export default function TableBlock({ block, onChange }) {
  // ── Derived state from block props ────────────────────────────────────────
  const rows = block.rows?.length
    ? block.rows
    : [['Header 1', 'Header 2', 'Header 3'], ['', '', ''], ['', '', '']];
  const numCols = rows[0]?.length ?? 0;
  const colWidths =
    Array.isArray(block.colWidths) && block.colWidths.length === numCols
      ? block.colWidths
      : Array(numCols).fill(DEFAULT_COL_WIDTH);

  // ── Component state ───────────────────────────────────────────────────────
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [hoveredRow, setHoveredRow] = useState(null);
  const [showAddCol, setShowAddCol] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const tableRef = useRef(null);
  // Always-current copies used in async event handlers (resize, pending-focus)
  const blockRef = useRef(block);
  const colWidthsRef = useRef(colWidths);
  const rowsRef = useRef(rows);
  // Pending focus cell key after add-row-on-Tab (set before onChange resolves)
  const pendingFocusRef = useRef(null);

  useEffect(() => { blockRef.current = block; }, [block]);
  useEffect(() => { colWidthsRef.current = colWidths; }, [colWidths]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  // Focus the pending cell after a new row is added via Tab
  useEffect(() => {
    if (!pendingFocusRef.current) return;
    const key = pendingFocusRef.current;
    pendingFocusRef.current = null;
    const target = tableRef.current?.querySelector(`[data-cell="${key}"]`);
    if (target) {
      target.focus();
      setSelectedCells(new Set([key]));
    }
  });

  // ── Cell update ───────────────────────────────────────────────────────────
  const updateCell = (ri, ci, value) => {
    const newRows = rows.map((r, rIdx) =>
      rIdx === ri ? r.map((c, cIdx) => (cIdx === ci ? value : c)) : r,
    );
    onChange({ ...block, rows: newRows });
  };

  // ── Column operations ─────────────────────────────────────────────────────
  const insertColumnAt = (idx) => {
    const cur = blockRef.current;
    const newRows = cur.rows.map((r) => {
      const copy = [...r];
      copy.splice(idx, 0, '');
      return copy;
    });
    const newWidths = [...colWidthsRef.current];
    newWidths.splice(idx, 0, DEFAULT_COL_WIDTH);
    onChange({ ...cur, rows: newRows, colWidths: newWidths });
  };

  /** Insert a column after `afterIdx` (defaults to last column). */
  const addColumn = (afterIdx) => {
    const cur = blockRef.current;
    const idx = afterIdx !== undefined ? afterIdx + 1 : cur.rows[0].length;
    insertColumnAt(idx);
  };

  const deleteColumn = (ci) => {
    const cur = blockRef.current;
    if (cur.rows[0].length <= 1) return;
    const newRows = cur.rows.map((r) => r.filter((_, i) => i !== ci));
    const newWidths = colWidthsRef.current.filter((_, i) => i !== ci);
    onChange({ ...cur, rows: newRows, colWidths: newWidths });
  };

  const sortColumn = (ci) => {
    const cur = blockRef.current;
    if (cur.rows.length <= 1) return;
    const [header, ...data] = cur.rows;
    const stripHtml = (s) => (s || '').replace(/<[^>]+>/g, '');
    const sorted = [...data].sort((a, b) =>
      stripHtml(a[ci]).localeCompare(stripHtml(b[ci])),
    );
    onChange({ ...cur, rows: [header, ...sorted] });
  };

  // ── Row operations ────────────────────────────────────────────────────────
  /** Insert a row after `afterIdx` (0-based across the full rows array). */
  const addRow = (afterIdx) => {
    const cur = blockRef.current;
    const idx = afterIdx !== undefined ? afterIdx : cur.rows.length - 1;
    const newRows = [...cur.rows];
    newRows.splice(idx + 1, 0, Array(cur.rows[0].length).fill(''));
    onChange({ ...cur, rows: newRows });
  };

  const deleteRow = (ri) => {
    const cur = blockRef.current;
    // Never delete the header row; always keep at least one data row
    if (ri === 0 || cur.rows.length <= 2) return;
    onChange({ ...cur, rows: cur.rows.filter((_, i) => i !== ri) });
  };

  // ── Column resize ─────────────────────────────────────────────────────────
  const startResize = useCallback(
    (e, ci) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = colWidthsRef.current[ci];

      // Prevent text selection while dragging
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';

      const onMove = (mv) => {
        const newWidth = Math.max(MIN_COL_WIDTH, startWidth + (mv.clientX - startX));
        const newWidths = colWidthsRef.current.map((w, i) => (i === ci ? newWidth : w));
        // Update both the ref immediately (for subsequent mousemove) and call onChange
        colWidthsRef.current = newWidths;
        onChange({ ...blockRef.current, colWidths: newWidths });
      };

      const onUp = () => {
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [onChange],
  );

  // ── Cell selection ────────────────────────────────────────────────────────
  const handleCellClick = (e, ri, ci) => {
    const key = `${ri},${ci}`;
    if (e.shiftKey && selectedCells.size > 0) {
      // Extend to rectangular selection from the last selected cell
      const [lastKey] = [...selectedCells].slice(-1);
      const [lr, lc] = lastKey.split(',').map(Number);
      const minR = Math.min(lr, ri);
      const maxR = Math.max(lr, ri);
      const minC = Math.min(lc, ci);
      const maxC = Math.max(lc, ci);
      const next = new Set();
      for (let r = minR; r <= maxR; r++)
        for (let c = minC; c <= maxC; c++) next.add(`${r},${c}`);
      setSelectedCells(next);
    } else {
      setSelectedCells(new Set([key]));
    }
  };

  const isSelected = (ri, ci) => selectedCells.has(`${ri},${ci}`);

  // ── Tab / Shift+Tab navigation ────────────────────────────────────────────
  const handleCellKeyDown = (e, ri, ci) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const cur = rowsRef.current;
    const colCount = cur[0].length;
    const rowCount = cur.length;
    let nextRi = ri;
    let nextCi = ci;

    if (e.shiftKey) {
      nextCi -= 1;
      if (nextCi < 0) {
        nextCi = colCount - 1;
        nextRi = Math.max(0, nextRi - 1);
      }
      const target = tableRef.current?.querySelector(`[data-cell="${nextRi},${nextCi}"]`);
      if (target) {
        target.focus();
        setSelectedCells(new Set([`${nextRi},${nextCi}`]));
      }
    } else {
      nextCi += 1;
      if (nextCi >= colCount) {
        nextCi = 0;
        nextRi += 1;
      }
      if (nextRi >= rowCount) {
        // Past the last row — add a new row and focus its first cell
        addRow(rowCount - 1);
        pendingFocusRef.current = `${rowCount},0`;
        return;
      }
      const target = tableRef.current?.querySelector(`[data-cell="${nextRi},${nextCi}"]`);
      if (target) {
        target.focus();
        setSelectedCells(new Set([`${nextRi},${nextCi}`]));
      }
    }
  };

  // ── Focus helper for "Rename" context menu item ───────────────────────────
  const focusAndSelectAll = (cellKey) => {
    const el = tableRef.current?.querySelector(`[data-cell="${cellKey}"]`);
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="my-1 group/table relative"
      // Clicking outside cells deselects
      onMouseDown={(e) => {
        if (!e.target.closest('[data-cell]')) setSelectedCells(new Set());
      }}
    >
      {/* Horizontal scroll wrapper */}
      <div className="overflow-x-auto rounded-sm">
        <table
          ref={tableRef}
          className="border-collapse text-sm"
          style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}
        >
          {/* Column widths */}
          <colgroup>
            {colWidths.map((w, ci) => (
              <col key={ci} style={{ width: w }} />
            ))}
            {/* Extra utility column for the add-col button / row menus */}
            <col style={{ width: 32 }} />
          </colgroup>

          {/* ── Header row ────────────────────────────────────────────────── */}
          <thead>
            <tr
              onMouseEnter={() => setShowAddCol(true)}
              onMouseLeave={() => setShowAddCol(false)}
            >
              {rows[0].map((cell, ci) => (
                <th
                  key={ci}
                  className={cn(
                    'relative border border-border text-left p-0 font-semibold',
                    isSelected(0, ci) && 'ring-2 ring-inset ring-blue-400/70',
                  )}
                  style={{ background: 'hsl(var(--muted) / 0.6)' }}
                >
                  {/* Context menu wraps the cell content */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div className="px-3 py-1.5 w-full h-full cursor-default">
                        <TableCellEditor
                          value={cell}
                          cellKey={`0,${ci}`}
                          placeholder={`Header ${ci + 1}`}
                          className="font-semibold"
                          onChange={(v) => updateCell(0, ci, v)}
                          onKeyDown={(e) => handleCellKeyDown(e, 0, ci)}
                          onClick={(e) => handleCellClick(e, 0, ci)}
                        />
                      </div>
                    </ContextMenuTrigger>

                    <ContextMenuContent className="w-52">
                      <ContextMenuItem onSelect={() => focusAndSelectAll(`0,${ci}`)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onSelect={() => insertColumnAt(ci)}>
                        <ChevronLeft className="h-3.5 w-3.5 mr-2" /> Insert left
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => addColumn(ci)}>
                        <ChevronRight className="h-3.5 w-3.5 mr-2" /> Insert right
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onSelect={() => sortColumn(ci)}>
                        <SortAsc className="h-3.5 w-3.5 mr-2" /> Sort A → Z
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onSelect={() => deleteColumn(ci)}
                        className="text-destructive focus:text-destructive"
                        disabled={rows[0].length <= 1}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete column
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  {/* Resize handle — positioned at right border, outside ContextMenuTrigger */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 flex items-center justify-center group/resize"
                    onMouseDown={(e) => startResize(e, ci)}
                  >
                    {/* Visual indicator on hover */}
                    <div className="w-0.5 h-4 bg-border group-hover/resize:bg-primary/60 rounded-full transition-colors" />
                  </div>
                </th>
              ))}

              {/* Add-column button cell */}
              <th className="border border-border p-0" style={{ background: 'hsl(var(--muted) / 0.6)' }}>
                <button
                  className={cn(
                    'w-8 h-full flex items-center justify-center py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-150',
                    showAddCol ? 'opacity-100' : 'opacity-0 pointer-events-none',
                  )}
                  onClick={() => addColumn()}
                  title="Add column"
                  tabIndex={-1}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </th>
            </tr>
          </thead>

          {/* ── Body rows ─────────────────────────────────────────────────── */}
          <tbody>
            {rows.slice(1).map((row, rOffset) => {
              const ri = rOffset + 1;
              return (
                <tr
                  key={ri}
                  className="group/row"
                  onMouseEnter={() => setHoveredRow(ri)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        'border border-border px-3 py-1.5 overflow-hidden align-top',
                        isSelected(ri, ci)
                          ? 'bg-blue-50 dark:bg-blue-950/40 ring-2 ring-inset ring-blue-400/60'
                          : 'bg-background',
                      )}
                    >
                      <TableCellEditor
                        value={cell}
                        cellKey={`${ri},${ci}`}
                        onChange={(v) => updateCell(ri, ci, v)}
                        onKeyDown={(e) => handleCellKeyDown(e, ri, ci)}
                        onClick={(e) => handleCellClick(e, ri, ci)}
                      />
                    </td>
                  ))}

                  {/* Row actions — visible on hover */}
                  <td className="border-0 p-0 bg-transparent align-middle w-8">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={cn(
                            'flex items-center justify-center w-8 h-full py-1 text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-sm transition-all duration-100',
                            hoveredRow === ri
                              ? 'opacity-100'
                              : 'opacity-0 pointer-events-none',
                          )}
                          title="Row options"
                          tabIndex={-1}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => addRow(ri - 1)}>
                          <ArrowUp className="h-3.5 w-3.5 mr-2" />
                          Insert above
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addRow(ri)}>
                          <ArrowDown className="h-3.5 w-3.5 mr-2" />
                          Insert below
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => deleteRow(ri)}
                          className="text-destructive focus:text-destructive"
                          disabled={rows.length <= 2}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete row
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Add row button ───────────────────────────────────────────────── */}
      <button
        className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 px-2 py-1 rounded-md transition-colors opacity-0 group-hover/table:opacity-100"
        onClick={() => addRow()}
        tabIndex={-1}
      >
        <Plus className="h-3 w-3" />
        Add row
      </button>
    </div>
  );
}
