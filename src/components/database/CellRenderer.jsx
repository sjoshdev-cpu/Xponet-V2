import { format } from 'date-fns';
import { OPTION_COLOR_CLASSES } from './db-constants.js';
import { computeRollup, evaluateFormula } from './db-utils.js';

/**
 * Read-only cell renderer for table rows, board cards, etc.
 */
export function CellRenderer({ prop, value, record, schema, allRecords = [] }) {
  if (!prop) return null;

  const display = getDisplayValue({ prop, value, record, schema, allRecords });

  if (display === null || display === undefined || display === '') {
    return <span className="text-muted-foreground/40 text-sm">—</span>;
  }

  return display;
}

function getDisplayValue({ prop, value, record, schema, allRecords }) {
  switch (prop.type) {
    case 'title':
    case 'text':
    case 'url':
    case 'phone':
    case 'email':
      return <span className="text-sm truncate">{String(value ?? '')}</span>;

    case 'number':
      return <span className="text-sm font-mono">{value !== undefined && value !== null ? Number(value).toLocaleString() : ''}</span>;

    case 'checkbox':
      return (
        <span className={`inline-block w-4 h-4 rounded border-2 ${value ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
          {value && <svg viewBox="0 0 12 12" className="w-3 h-3 text-primary-foreground mx-auto"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>}
        </span>
      );

    case 'select':
    case 'status': {
      const opt = (prop.options ?? []).find(o => o.id === value);
      if (!opt) return null;
      return (
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${OPTION_COLOR_CLASSES[opt.color] ?? OPTION_COLOR_CLASSES.gray}`}>
          {opt.label}
        </span>
      );
    }

    case 'multi_select': {
      if (!Array.isArray(value) || !value.length) return null;
      return (
        <div className="flex flex-wrap gap-1">
          {value.map(vid => {
            const opt = (prop.options ?? []).find(o => o.id === vid);
            if (!opt) return null;
            return (
              <span key={vid} className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${OPTION_COLOR_CLASSES[opt.color] ?? OPTION_COLOR_CLASSES.gray}`}>
                {opt.label}
              </span>
            );
          })}
        </div>
      );
    }

    case 'date': {
      if (!value) return null;
      try { return <span className="text-sm">{format(new Date(value), 'MMM d, yyyy')}</span>; }
      catch { return <span className="text-sm">{String(value)}</span>; }
    }

    case 'person':
      return <span className="text-sm truncate">{String(value ?? '')}</span>;

    case 'relation': {
      const ids = Array.isArray(value) ? value : [];
      if (!ids.length) return null;
      const linked = allRecords.filter(r => ids.includes(r.id));
      return (
        <div className="flex flex-wrap gap-1">
          {linked.map(r => {
            const titleProp = schema.find(p => p.type === 'title');
            const title = titleProp ? r.properties?.[titleProp.id] : r.id;
            return (
              <span key={r.id} className="inline-flex px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs font-medium">
                {title || '—'}
              </span>
            );
          })}
        </div>
      );
    }

    case 'rollup': {
      const result = computeRollup(prop, record, allRecords);
      return <span className="text-sm font-mono">{result !== null ? String(result) : ''}</span>;
    }

    case 'formula': {
      const result = evaluateFormula(prop.formula, record, schema);
      return <span className="text-sm">{result !== null && result !== undefined ? String(result) : ''}</span>;
    }

    default:
      return <span className="text-sm truncate">{String(value ?? '')}</span>;
  }
}

export default CellRenderer;
