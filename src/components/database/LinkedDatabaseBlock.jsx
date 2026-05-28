import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Database as DbIcon, Settings, ExternalLink, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Database, DatabaseRecord, DatabaseView } from '@/api/firestoreClient.js';
import { applyFilters, applySorts } from '@/components/database/db-utils.js';
import { CellRenderer } from '@/components/database/CellRenderer.jsx';
import { useWorkspace } from '@/contexts/WorkspaceContext.jsx';

/**
 * Linked database block — renders a read-only database view inline inside a page.
 *
 * block = {
 *   type: 'linked_db',
 *   database_id: string | null,
 *   view_id: string | null,
 *   filter_by_relation: { property_id, value } | null,
 * }
 *
 * Props:
 *   block        — the block object
 *   onChange     — fn(updates) — updates the block content
 *   readOnly     — boolean (for shared page view)
 */
export default function LinkedDatabaseBlock({ block, onChange, readOnly = false }) {
  const { currentOrganization } = useWorkspace();
  const orgId = currentOrganization?.id;
  const [configMode, setConfigMode] = useState(!block.database_id);

  const { data: databases = [] } = useQuery({
    queryKey: ['databases', orgId],
    queryFn: () => Database.filter({ organization_id: orgId }),
    enabled: !!orgId,
  });

  const { data: views = [] } = useQuery({
    queryKey: ['db_views', block.database_id],
    queryFn: () => DatabaseView.filter({ database_id: block.database_id }),
    enabled: !!block.database_id,
  });

  const { data: records = [] } = useQuery({
    queryKey: ['records', block.database_id],
    queryFn: () => DatabaseRecord.filter({ database_id: block.database_id }),
    enabled: !!block.database_id,
  });

  const selectedDb   = databases.find(d => d.id === block.database_id);
  const selectedView = views.find(v => v.id === block.view_id) ?? views[0];
  const schema       = selectedDb?.schema ?? [];

  // Apply view filters/sorts
  const filtered = applyFilters(records, schema, selectedView?.filters ?? []);
  const sorted   = applySorts(filtered, selectedView?.sorts ?? []);
  // Optional filter by relation
  const displayed = block.filter_by_relation
    ? sorted.filter(r => {
        const val = r.properties?.[block.filter_by_relation.property_id];
        if (Array.isArray(val)) return val.includes(block.filter_by_relation.value);
        return val === block.filter_by_relation.value;
      })
    : sorted;

  const titleProp  = schema.find(p => p.type === 'title');
  const otherProps = schema.filter(p => p.id !== titleProp?.id).slice(0, 4);

  // ── Config panel ──────────────────────────────────────────────────────────
  if (configMode && !readOnly) {
    return (
      <div className="border-2 border-dashed border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <DbIcon className="w-4 h-4" />
          Linked database
        </div>

        <div className="space-y-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Database</label>
            <Select
              value={block.database_id ?? ''}
              onValueChange={val => onChange({ database_id: val, view_id: null })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select a database..." />
              </SelectTrigger>
              <SelectContent>
                {databases.map(db => (
                  <SelectItem key={db.id} value={db.id}>
                    {db.icon} {db.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {block.database_id && views.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">View</label>
              <Select
                value={block.view_id ?? views[0]?.id ?? ''}
                onValueChange={val => onChange({ view_id: val })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select view..." />
                </SelectTrigger>
                <SelectContent>
                  {views.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={() => setConfigMode(false)} disabled={!block.database_id}>
            Done
          </Button>
          {block.database_id && (
            <Button size="sm" variant="ghost" onClick={() => setConfigMode(false)}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Empty / not configured ────────────────────────────────────────────────
  if (!block.database_id || !selectedDb) {
    return (
      <div
        className="border-2 border-dashed border-border rounded-xl p-4 text-center text-muted-foreground text-sm cursor-pointer hover:border-primary/40"
        onClick={() => !readOnly && setConfigMode(true)}
      >
        <DbIcon className="w-5 h-5 mx-auto mb-1" />
        Click to link a database
      </div>
    );
  }

  // ── Display mode ──────────────────────────────────────────────────────────
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Mini header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>{selectedDb.icon ?? '📋'}</span>
          <span>{selectedDb.name}</span>
          <span className="text-xs text-muted-foreground font-normal">
            {selectedView?.name ? `· ${selectedView.name}` : ''}
          </span>
          <span className="text-xs text-muted-foreground">({displayed.length})</span>
        </div>
        <div className="flex items-center gap-1">
          {!readOnly && (
            <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setConfigMode(true)}>
              <Settings className="w-3 h-3" />
            </Button>
          )}
          <Link to={`/database/${selectedDb.id}`}>
            <Button variant="ghost" size="icon" className="w-6 h-6">
              <ExternalLink className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Mini table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/10">
              {titleProp && <th className="text-left px-3 py-1.5 text-xs font-medium text-muted-foreground w-48">{titleProp.name}</th>}
              {otherProps.map(p => (
                <th key={p.id} className="text-left px-3 py-1.5 text-xs font-medium text-muted-foreground">{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.slice(0, 10).map(record => (
              <tr key={record.id} className="border-b border-border hover:bg-muted/20">
                {titleProp && (
                  <td className="px-3 py-1.5 font-medium truncate max-w-[12rem]">
                    {record.properties?.[titleProp.id] || 'Untitled'}
                  </td>
                )}
                {otherProps.map(p => (
                  <td key={p.id} className="px-3 py-1.5">
                    <CellRenderer
                      prop={p}
                      value={record.properties?.[p.id]}
                      record={record}
                      schema={schema}
                      allRecords={records}
                    />
                  </td>
                ))}
              </tr>
            ))}
            {displayed.length === 0 && (
              <tr>
                <td colSpan={1 + otherProps.length} className="px-3 py-4 text-center text-muted-foreground text-sm">
                  No records
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {displayed.length > 10 && (
          <div className="px-3 py-1.5 text-xs text-muted-foreground border-t border-border bg-muted/10">
            + {displayed.length - 10} more records.{' '}
            <Link to={`/database/${selectedDb.id}`} className="underline hover:text-foreground">Open database</Link>
          </div>
        )}
      </div>
    </div>
  );
}
