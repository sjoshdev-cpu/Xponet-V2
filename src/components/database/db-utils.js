import { FILTER_OPS_FOR } from './db-constants.js';

/** Unique short id */
export function genId() {
  return Math.random().toString(36).substr(2, 9);
}

/** Apply filter array to records (client-side) */
export function applyFilters(records, schema, filters) {
  if (!filters?.length) return records;
  return records.filter(record =>
    filters.every(f => {
      const val = record.properties?.[f.property];
      switch (f.op) {
        case 'is_empty':      return !val || val === '' || (Array.isArray(val) && !val.length);
        case 'is_not_empty':  return val && val !== '' && !(Array.isArray(val) && !val.length);
        case 'equals':        return String(val ?? '') === String(f.value ?? '');
        case 'not_equals':    return String(val ?? '') !== String(f.value ?? '');
        case 'contains':      return String(val ?? '').toLowerCase().includes(String(f.value ?? '').toLowerCase());
        case 'not_contains':  return !String(val ?? '').toLowerCase().includes(String(f.value ?? '').toLowerCase());
        case 'greater':       return Number(val) > Number(f.value);
        case 'less':          return Number(val) < Number(f.value);
        case 'gte':           return Number(val) >= Number(f.value);
        case 'lte':           return Number(val) <= Number(f.value);
        case 'before':        return val && new Date(val) < new Date(f.value);
        case 'after':         return val && new Date(val) > new Date(f.value);
        case 'is_checked':    return val === true;
        case 'is_not_checked':return val !== true;
        default:              return true;
      }
    })
  );
}

/** Apply sort array to records (client-side) */
export function applySorts(records, sorts) {
  if (!sorts?.length) return records;
  return [...records].sort((a, b) => {
    for (const s of sorts) {
      const va = a.properties?.[s.property] ?? '';
      const vb = b.properties?.[s.property] ?? '';
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      }
      if (cmp !== 0) return s.dir === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
}

/** Group records by a property id; returns Map<groupKey, record[]> */
export function groupRecords(records, propertyId, schema) {
  const prop = schema?.find(p => p.id === propertyId);
  const groups = new Map();
  records.forEach(r => {
    const rawVal = r.properties?.[propertyId];
    const key = rawVal ?? '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  // Ensure all options appear as columns even when empty
  if (prop?.options) {
    prop.options.forEach(o => {
      if (!groups.has(o.id)) groups.set(o.id, []);
    });
  }
  return groups;
}

/** Evaluate a rollup */
export function computeRollup(rollupProp, record, relatedRecords) {
  const { rollup_property, rollup_fn } = rollupProp;
  const rel = record.properties?.[rollupProp.relation_property] ?? [];
  const linked = relatedRecords.filter(r => rel.includes(r.id));
  switch (rollup_fn) {
    case 'count':          return linked.length;
    case 'count_values':   return linked.filter(r => r.properties?.[rollup_property] != null && r.properties?.[rollup_property] !== '').length;
    case 'sum':            return linked.reduce((a, r) => a + (Number(r.properties?.[rollup_property]) || 0), 0);
    case 'avg': {
      const vals = linked.map(r => Number(r.properties?.[rollup_property]) || 0);
      return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
    }
    case 'min':            return linked.length ? Math.min(...linked.map(r => Number(r.properties?.[rollup_property]) || 0)) : null;
    case 'max':            return linked.length ? Math.max(...linked.map(r => Number(r.properties?.[rollup_property]) || 0)) : null;
    case 'percent_checked':{
      const total = linked.length;
      const checked = linked.filter(r => r.properties?.[rollup_property] === true).length;
      return total ? Math.round((checked / total) * 100) + '%' : '0%';
    }
    default: return null;
  }
}

/** Evaluate a simple formula expression against a record */
export function evaluateFormula(formula, record, schema) {
  if (!formula) return '';
  try {
    // Replace {FieldName} with actual values
    const withVals = formula.replace(/\{([^}]+)\}/g, (_, name) => {
      const prop = schema.find(p => p.name === name || p.id === name);
      const val = prop ? record.properties?.[prop.id] : undefined;
      if (val === undefined || val === null) return '""';
      if (typeof val === 'string') return JSON.stringify(val);
      return val;
    });

    return evalExpr(withVals);
  } catch {
    return '#ERROR';
  }
}

function evalExpr(expr) {
  expr = expr.trim();
  // String literal
  if (/^"[^"]*"$/.test(expr) || /^'[^']*'$/.test(expr)) return expr.slice(1, -1);
  // Number
  if (!isNaN(Number(expr)) && expr !== '') return Number(expr);
  // Boolean
  if (expr === 'true') return true;
  if (expr === 'false') return false;
  // Functions
  if (expr.startsWith('now()')) return new Date().toISOString().slice(0, 10);
  if (expr.startsWith('concat(')) {
    const args = splitArgs(expr.slice(7, -1)).map(evalExpr);
    return args.join('');
  }
  if (expr.startsWith('if(')) {
    const [condRaw, thenRaw, elseRaw] = splitArgs(expr.slice(3, -1));
    const cond = evalCondition(condRaw?.trim() ?? '');
    return cond ? evalExpr(thenRaw?.trim() ?? '""') : evalExpr(elseRaw?.trim() ?? '""');
  }
  if (expr.startsWith('dateDiff(')) {
    const args = splitArgs(expr.slice(9, -1)).map(a => evalExpr(a.trim()));
    const [d1, d2, unit = 'days'] = args;
    const ms = new Date(d2) - new Date(d1);
    if (unit === 'hours')  return Math.round(ms / 3600000);
    if (unit === 'weeks')  return Math.round(ms / 604800000);
    if (unit === 'months') return Math.round(ms / 2628000000);
    return Math.round(ms / 86400000);
  }
  if (expr.startsWith('floor(')) return Math.floor(Number(evalExpr(expr.slice(6, -1))));
  if (expr.startsWith('ceil('))  return Math.ceil(Number(evalExpr(expr.slice(5, -1))));
  if (expr.startsWith('round(')) return Math.round(Number(evalExpr(expr.slice(6, -1))));
  if (expr.startsWith('abs('))   return Math.abs(Number(evalExpr(expr.slice(4, -1))));
  if (expr.startsWith('upper(')) return String(evalExpr(expr.slice(6, -1))).toUpperCase();
  if (expr.startsWith('lower(')) return String(evalExpr(expr.slice(6, -1))).toLowerCase();
  // Arithmetic (+, -, *, /)
  const arithMatch = expr.match(/^(.+?)([+\-*/])(.+)$/);
  if (arithMatch) {
    const l = Number(evalExpr(arithMatch[1].trim()));
    const r = Number(evalExpr(arithMatch[3].trim()));
    switch (arithMatch[2]) {
      case '+': return l + r;
      case '-': return l - r;
      case '*': return l * r;
      case '/': return r !== 0 ? l / r : '#DIV0';
    }
  }
  return expr;
}

function evalCondition(cond) {
  for (const op of ['==','!=','>=','<=','>','<']) {
    const idx = cond.indexOf(op);
    if (idx >= 0) {
      const l = evalExpr(cond.slice(0, idx).trim());
      const r = evalExpr(cond.slice(idx + op.length).trim());
      switch (op) {
        case '==': return l == r;   // eslint-disable-line eqeqeq
        case '!=': return l != r;   // eslint-disable-line eqeqeq
        case '>':  return Number(l) > Number(r);
        case '<':  return Number(l) < Number(r);
        case '>=': return Number(l) >= Number(r);
        case '<=': return Number(l) <= Number(r);
      }
    }
  }
  return Boolean(evalExpr(cond));
}

/** Split top-level args (respects nested parentheses) */
function splitArgs(str) {
  const args = [];
  let depth = 0, start = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(' || str[i] === '[') depth++;
    else if (str[i] === ')' || str[i] === ']') depth--;
    else if (str[i] === ',' && depth === 0) {
      args.push(str.slice(start, i));
      start = i + 1;
    }
  }
  args.push(str.slice(start));
  return args;
}

/** Returns the filter ops available for a schema property */
export function filterOpsFor(prop) {
  return FILTER_OPS_FOR[prop?.type] ?? FILTER_OPS_FOR.text;
}
