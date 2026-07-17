// src/pages/Databases.jsx
// Full Notion-like database page — table view, column types, CSV import/export, customize layout
import { Component, useState, useRef, useCallback } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Page, withLastEditedBy } from "@/api/firestoreClient";
import FileUploadButton from "@/components/ui/FileUploadButton";
import { CompactFileChip } from "@/components/ui/UploadedFilePreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, MoreHorizontal, Search, Filter, ArrowUpDown,
  Download, Upload, LayoutGrid, List, Table2,
  Trash2, Copy, X, Check,
  FileText, Image as ImgIcon, Link, Calendar, User, Hash,
  AlignLeft, ToggleLeft, Phone, Mail, Database, Eye, EyeOff,
  Settings2, Star, Lock, Unlock, RefreshCw, Columns3,
} from "lucide-react";
import AddPropertyModal, { COL_TYPES } from "@/components/database/AddPropertyModal";
import ColumnHeaderDropdown from "@/components/database/ColumnHeaderDropdown";
import StatusOptionsPanel from "@/components/database/StatusOptionsPanel";
import { DEFAULT_STATUS_OPTIONS, OPTION_COLOR_CLASSES } from "@/components/database/db-constants.js";

const STATUS_OPTS = [
  { label: "Not started", dot: "bg-gray-400" },
  { label: "In progress", dot: "bg-blue-500" },
  { label: "Done",        dot: "bg-green-500" },
  { label: "Blocked",     dot: "bg-red-500" },
  { label: "On hold",     dot: "bg-amber-400" },
];

const VIEW_TYPES = [
  { id: "table",   label: "Table",   icon: Table2 },
  { id: "board",   label: "Board",   icon: LayoutGrid },
  { id: "list",    label: "List",    icon: List },
];

const DB_PRESETS = [
  {
    id: "knowledge_base",
    label: "Knowledge Base",
    description: "Organise articles and documentation",
    icon: "📚",
    color: "from-blue-900/60 to-blue-800/40",
    columns: [
      { id: "title",    label: "Title",       type: "text",   fixed: true },
      { id: "category", label: "Category",    type: "select", options: ["Guide", "Reference", "Tutorial", "Policy"] },
      { id: "status",   label: "Status",      type: "status" },
      { id: "author",   label: "Author",      type: "person" },
      { id: "files",    label: "Attachments", type: "files"  },
      { id: "url",      label: "Source URL",  type: "url"    },
    ],
  },
  {
    id: "project_tracker",
    label: "Project Tracker",
    description: "Track projects from start to finish",
    icon: "📋",
    color: "from-purple-900/60 to-purple-800/40",
    columns: [
      { id: "title",    label: "Project",     type: "text",   fixed: true },
      { id: "status",   label: "Status",      type: "status" },
      { id: "priority", label: "Priority",    type: "select", options: ["Low", "Medium", "High", "Urgent"] },
      { id: "owner",    label: "Owner",       type: "person" },
      { id: "due",      label: "Due date",    type: "date"   },
      { id: "files",    label: "Files",       type: "files"  },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    description: "Manage clients and contacts",
    icon: "👥",
    color: "from-emerald-900/60 to-emerald-800/40",
    columns: [
      { id: "title",   label: "Company",     type: "text",   fixed: true },
      { id: "contact", label: "Contact",     type: "person" },
      { id: "email",   label: "Email",       type: "email"  },
      { id: "phone",   label: "Phone",       type: "phone"  },
      { id: "status",  label: "Status",      type: "select", options: ["Lead", "Prospect", "Client", "Churned"] },
      { id: "files",   label: "Contracts",   type: "files"  },
    ],
  },
  {
    id: "meeting_notes",
    label: "Meeting Notes",
    description: "Turn meetings into action",
    icon: "📅",
    color: "from-amber-900/60 to-amber-800/40",
    columns: [
      { id: "title",    label: "Meeting",     type: "text",   fixed: true },
      { id: "date",     label: "Date",        type: "date"   },
      { id: "category", label: "Category",    type: "select", options: ["Standup", "Presentation", "Planning", "1:1", "QBR"] },
      { id: "attendees",label: "Attendees",   type: "person" },
      { id: "files",    label: "Recording",   type: "files"  },
    ],
  },
  {
    id: "custom",
    label: "Empty database",
    description: "Start from scratch",
    icon: "🗄️",
    color: "from-gray-800/60 to-gray-700/40",
    columns: [
      { id: "title",  label: "Name",   type: "text",   fixed: true },
      { id: "status", label: "Status", type: "status" },
      { id: "date",   label: "Date",   type: "date"   },
      { id: "files",  label: "Files",  type: "files"  },
    ],
  },
  {
    id: "dept_dashboard",
    label: "Department Dashboard",
    description: "Track a department's work items with owner, status & dates",
    icon: "📊",
    color: "from-teal-900/60 to-teal-800/40",
    columns: [
      { id: "title",     label: "Item",       type: "text",   fixed: true },
      { id: "owner",     label: "Owner",      type: "person" },
      { id: "status",    label: "Status",     type: "status" },
      { id: "priority",  label: "Priority",   type: "select", options: ["Low", "Medium", "High", "Urgent"] },
      { id: "due_date",  label: "Due date",   type: "date"   },
      { id: "notes",     label: "Notes",      type: "text"   },
    ],
  },
];

// The "Empty database" preset, used as the fallback schema when a database
// page has no saved columns. Looked up by id so it survives preset reordering.
const EMPTY_PRESET = DB_PRESETS.find((p) => p.id === "custom");

// ─────────────────────────────────────────────────────────────
// CSV utilities
// ─────────────────────────────────────────────────────────────
function toCSV(columns, rows) {
  const headers = columns.map(c => `"${c.label}"`).join(",");
  const body = rows.map(row =>
    columns.map(col => {
      const v = row.data?.[col.id];
      if (v == null) return '""';
      if (col.type === "files") return `"${(v || []).map(f => f.url).join("; ")}"`;
      if (Array.isArray(v)) return `"${v.join(", ")}"`;
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(",")
  );
  return [headers, ...body].join("\n");
}

function fromCSV(text) {
  const parseRow = line => {
    const cells = []; let cur = ""; let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { cells.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  };
  const lines = text.trim().split("\n");
  if (lines.length < 1) return { headers: [], rows: [] };
  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(line => {
    const vals = parseRow(line);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] || ""]));
  });
  return { headers, rows };
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
// Error boundary — catches render errors inside the table
// ─────────────────────────────────────────────────────────────
class DatabaseTableErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[DatabaseTableErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center p-8">
          <div className="text-4xl">⚠️</div>
          <p className="font-semibold text-foreground">Something went wrong rendering this table</p>
          <p className="text-sm text-muted-foreground">{this.state.error?.message}</p>
          <button
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────
// Cell component
// ─────────────────────────────────────────────────────────────
function Cell({ col, value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const commit = v => { setEditing(false); const val = v ?? draft; if (val !== value) onChange(val); };

  if (col.type === "checkbox") {
    return (
      <div className="flex items-center justify-center h-full px-2">
        <input
          type="checkbox"
          checked={!!value}
          onChange={e => onChange(e.target.checked)}
          className="w-4 h-4 rounded accent-primary cursor-pointer"
        />
      </div>
    );
  }

  if (col.type === "status") {
    // Use schema options if they are objects (new format), otherwise fall back to defaults
    const statusOpts =
      col.options?.length && typeof col.options[0] === 'object'
        ? col.options
        : DEFAULT_STATUS_OPTIONS;
    // Support values stored as option id OR legacy label string
    const opt = statusOpts.find(
      (s) => s.id === value || s.name === value || s.label === value
    );
    return (
      <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? null : v)}>
        <SelectTrigger className="h-8 border-none bg-transparent px-2 text-xs focus:ring-0 w-full">
          {opt ? (
            <span
              className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                OPTION_COLOR_CLASSES[opt.color] ?? OPTION_COLOR_CLASSES.gray
              }`}
            >
              {opt.name ?? opt.label}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">—</SelectItem>
          {statusOpts.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <span
                className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                  OPTION_COLOR_CLASSES[s.color] ?? OPTION_COLOR_CLASSES.gray
                }`}
              >
                {s.name ?? s.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (col.type === "select") {
    return (
      <Select value={value || "__none__"} onValueChange={v => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger className="h-8 border-none bg-transparent px-2 text-xs focus:ring-0 w-full">
          {value
            ? <Badge variant="secondary" className="text-[11px] py-0">{value}</Badge>
            : <span className="text-muted-foreground">—</span>}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">—</SelectItem>
          {(col.options || []).filter(Boolean).map(o => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (col.type === "date") {
    return (
      <input
        type="date"
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        className="w-full h-8 bg-transparent border-none text-xs px-2 text-foreground focus:outline-none cursor-pointer"
      />
    );
  }

  if (col.type === "files") {
    const files = Array.isArray(value) ? value : [];
    return (
      <div className="flex items-center gap-1 flex-wrap min-h-[32px] px-1.5 py-1">
        {files.map((f, i) => (
          <CompactFileChip
            key={i}
            file={f}
            onRemove={() => onChange(files.filter((_, idx) => idx !== i))}
          />
        ))}
        <FileUploadButton
          folder="xponet/databases"
          onUpload={r => onChange([...files, r])}
          label=""
          size="icon"
          variant="ghost"
          accept="image/*,application/pdf,.doc,.docx,.txt,.mp4,.mov,.mp3,.zip"
          className="h-6 w-6"
        />
      </div>
    );
  }

  if (col.type === "url") {
    if (editing) {
      return (
        <input
          autoFocus
          className="w-full h-8 bg-transparent border-none text-xs px-2 text-blue-400 focus:outline-none"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        />
      );
    }
    return (
      <div className="px-2 py-1 text-xs cursor-text min-h-[32px] flex items-center" onClick={() => setEditing(true)}>
        {value
          ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate" onClick={e => e.stopPropagation()}>{value}</a>
          : <span className="text-muted-foreground">—</span>}
      </div>
    );
  }

  // text / number / email / phone / person
  if (editing) {
    return (
      <input
        autoFocus
        type={col.type === "number" ? "number" : "text"}
        className="w-full h-8 bg-transparent border-none text-xs px-2 focus:outline-none"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
      />
    );
  }
  return (
    <div
      className={`px-2 py-1 text-xs cursor-text min-h-[32px] flex items-center truncate ${col.fixed ? "font-medium" : ""}`}
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
    >
      {value !== undefined && value !== "" && value !== null
        ? String(value)
        : <span className="text-muted-foreground">—</span>}
    </div>
  );
}

// AddPropertyModal is imported from @/components/database/AddPropertyModal

// ─────────────────────────────────────────────────────────────
// Customize Layout panel (like Notion's "Customize" drawer)
// ─────────────────────────────────────────────────────────────
function CustomizePanel({ columns, hidden, onToggle, onClose }) {
  return (
    <div className="fixed right-0 top-0 h-full w-72 bg-card border-l border-border shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm">Customize layout</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-xs text-muted-foreground mb-3">Select features to show or hide</p>
        <div className="space-y-1">
          {columns.filter(c => !c.fixed).map(col => {
            const TypeMeta = COL_TYPES.find(t => t.value === col.type);
            const Icon = TypeMeta?.icon || AlignLeft;
            const isHidden = hidden.has(col.id);
            return (
              <button
                key={col.id}
                onClick={() => onToggle(col.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isHidden ? "opacity-50" : "bg-muted/50"
                } hover:bg-accent`}
              >
                <Icon className={`w-4 h-4 ${TypeMeta?.color || "text-muted-foreground"}`} />
                <span className="flex-1 text-left text-xs">{col.label}</span>
                {isHidden
                  ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                  : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DB preset gallery picker
// ─────────────────────────────────────────────────────────────
function NewDatabaseDialog({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [preset, setPreset] = useState(null);
  const [step, setStep] = useState(1); // 1=pick preset, 2=name

  const pick = p => { setPreset(p); setStep(2); };
  const submit = () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    onCreate(name.trim(), preset);
    setName(""); setPreset(null); setStep(1); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => { onClose(); setStep(1); setName(""); setPreset(null); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{step === 1 ? "Choose a template" : `Name your database`}</DialogTitle>
          <DialogDescription className="sr-only">Create a new database from a template.</DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="grid grid-cols-2 gap-3 py-2 max-h-[420px] overflow-y-auto pr-1">
            {DB_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => pick(p)}
                className={`text-left rounded-xl p-4 bg-gradient-to-br ${p.color} border border-border hover:border-primary/40 hover:shadow-md transition-all`}
              >
                <div className="text-2xl mb-2">{p.icon}</div>
                <div className="font-semibold text-sm mb-0.5">{p.label}</div>
                <div className="text-xs text-muted-foreground">{p.description}</div>
                {/* Mini column preview */}
                <div className="mt-3 flex gap-1 flex-wrap">
                  {p.columns.slice(0, 4).map(c => {
                    const Meta = COL_TYPES.find(t => t.value === c.type);
                    const Icon = Meta?.icon || AlignLeft;
                    return (
                      <span key={c.id} className="inline-flex items-center gap-1 bg-black/20 rounded px-1.5 py-0.5 text-[10px]">
                        <Icon className={`w-2.5 h-2.5 ${Meta?.color || ""}`} />
                        {c.label}
                      </span>
                    );
                  })}
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <span className="text-2xl">{preset?.icon}</span>
              <div>
                <p className="font-medium text-sm">{preset?.label}</p>
                <p className="text-xs text-muted-foreground">{preset?.columns?.length} properties</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Database name</label>
              <Input
                autoFocus
                placeholder={preset?.label || "Untitled database"}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 2 && <Button variant="outline" onClick={() => setStep(1)}>Back</Button>}
          {step === 1 && <Button variant="outline" onClick={onClose}>Cancel</Button>}
          {step === 2 && <Button onClick={submit}>Create database</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export default function Databases() {
  const { currentOrg, user } = useWorkspace();
  const queryClient = useQueryClient();
  const csvRef = useRef(null);

  const [activePage, setActivePage] = useState(null);
  const [columns, setColumns]       = useState([]);
  const [rows, setRows]             = useState([]);
  const [activeView, setActiveView] = useState("table");
  const [search, setSearch]         = useState("");
  const [hidden, setHidden]         = useState(new Set());
  const [showAddProp, setShowAddProp]     = useState(false);
  const [showNewDb, setShowNewDb]         = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [isLocked, setIsLocked]           = useState(false);
  const [activeTab, setActiveTab]         = useState("all");
  const [editingOptionsCol, setEditingOptionsCol] = useState(null);

  // ── Firestore ───────────────────────────────────────────────
  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["db-pages", currentOrg?.id],
    queryFn: () => Page.filter({ org_id: currentOrg?.id, is_database: true }),
    enabled: !!currentOrg?.id,
  });

  const saveMut = useMutation({
    mutationFn: ({ id, cols, rws }) =>
      Page.update(id, withLastEditedBy({ content: JSON.stringify({ columns: cols, rows: rws }) }, user)),
    onSuccess: () => queryClient.invalidateQueries(["db-pages"]),
  });

  const persist = useCallback((cols, rws) => {
    if (!activePage) return;
    saveMut.mutate({ id: activePage.id, cols, rws });
  }, [activePage, saveMut]);

  // ── Open a database ─────────────────────────────────────────
  const openDb = page => {
    setActivePage(page);
    try {
      const parsed = JSON.parse(page.content || "{}");
      setColumns(parsed.columns?.length ? parsed.columns : EMPTY_PRESET.columns);
      setRows(parsed.rows || []);
    } catch {
      setColumns(EMPTY_PRESET.columns);
      setRows([]);
    }
    setHidden(new Set());
    setSearch("");
    setActiveView("table");
  };

  // ── Create database ─────────────────────────────────────────
  const createDb = async (name, preset) => {
    const cols = preset?.columns || EMPTY_PRESET.columns;
    const newPage = await Page.create({
      org_id: currentOrg.id,
      title: name,
      is_database: true,
      icon: preset?.icon || "🗄️",
      content: JSON.stringify({ columns: cols, rows: [] }),
    });
    queryClient.invalidateQueries(["db-pages"]);
    toast.success(`"${name}" created`);
    openDb({ ...newPage, content: JSON.stringify({ columns: cols, rows: [] }) });
  };

  // ── Row / column mutations ───────────────────────────────────
  const addRow = () => {
    const nr = { id: `r_${Date.now()}`, data: {} };
    const rws = [...rows, nr];
    setRows(rws); persist(columns, rws);
  };

  const deleteRow = id => {
    const rws = rows.filter(r => r.id !== id);
    setRows(rws); persist(columns, rws); toast.success("Row deleted");
  };

  const updateCell = (rowId, colId, val) => {
    const rws = rows.map(r => r.id === rowId ? { ...r, data: { ...r.data, [colId]: val } } : r);
    setRows(rws); persist(columns, rws);
  };

  const addColumn = col => {
    const cols = [...columns, col];
    setColumns(cols); persist(cols, rows);
  };

  const deleteColumn = id => {
    const cols = columns.filter(c => c.id !== id);
    setColumns(cols); persist(cols, rows);
  };

  const updateColumn = (id, patch) => {
    const cols = columns.map(c => c.id === id ? { ...c, ...patch } : c);
    setColumns(cols); persist(cols, rows);
  };

  const toggleHide = id => {
    setHidden(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // ── CSV ──────────────────────────────────────────────────────
  const handleExport = () => {
    const vis = columns.filter(c => !hidden.has(c.id));
    downloadCSV(toCSV(vis, filteredRows), `${activePage?.title || "database"}.csv`);
    toast.success("Exported to CSV");
  };

  const handleImport = e => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const { headers, rows: csvRows } = fromCSV(ev.target.result);
      if (!headers.length) { toast.error("Invalid CSV"); return; }
      const cols = [
        { id: "title", label: headers[0], type: "text", fixed: true },
        ...headers.slice(1).map((h, i) => ({ id: `ci_${i}`, label: h, type: "text" })),
      ];
      const rws = csvRows.map(row => ({
        id: `r_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        data: Object.fromEntries(cols.map((c, i) => [c.id, row[headers[i]] || ""])),
      }));
      setColumns(cols); setRows(rws); persist(cols, rws);
      toast.success(`Imported ${rws.length} rows`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Derived ──────────────────────────────────────────────────
  const filteredRows = rows.filter(row => {
    if (!search) return true;
    return columns.some(c => String(row.data?.[c.id] || "").toLowerCase().includes(search.toLowerCase()));
  });

  const visibleCols = columns.filter(c => !hidden.has(c.id));

  // ─────────────────────────────────────────────────────────────
  // GALLERY (no database selected)
  // ─────────────────────────────────────────────────────────────
  if (!activePage) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Databases</h1>
            <Badge variant="secondary" className="text-[11px]">{pages.length}</Badge>
          </div>
          <Button onClick={() => setShowNewDb(true)} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" /> New database
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-6 border-b border-border">
          {["all", "recent", "shared"].map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2.5 text-sm border-b-2 transition-colors capitalize ${
                activeTab === t
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "all" ? "All databases" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Gallery grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading…</div>
          ) : pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
              <Database className="w-14 h-14 text-muted-foreground/20" />
              <p className="font-medium text-muted-foreground">No databases yet</p>
              <p className="text-sm text-muted-foreground/70">Create one to start organising your work</p>
              <Button className="mt-2 gap-1.5" onClick={() => setShowNewDb(true)}>
                <Plus className="w-4 h-4" /> New database
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pages.map(page => {
                let preview = { columns: [], rows: [] };
                try { preview = JSON.parse(page.content || "{}"); } catch {}
                const presetMeta = DB_PRESETS.find(p => p.id === page.database_preset);
                return (
                  <button
                    key={page.id}
                    onClick={() => openDb(page)}
                    className="text-left border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-md transition-all group"
                  >
                    {/* Mini table preview */}
                    <div className="bg-muted/40 border-b border-border p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{page.icon || "🗄️"}</span>
                        <span className="font-semibold text-sm truncate">{page.title}</span>
                      </div>
                      <div className="border border-border/60 rounded-lg overflow-hidden bg-card/50 text-[10px]">
                        <div className="flex border-b border-border/40 bg-muted/60 px-2 py-1 gap-3">
                          {(preview.columns || []).slice(0, 3).map(c => (
                            <span key={c.id} className="flex-1 text-muted-foreground truncate">{c.label}</span>
                          ))}
                        </div>
                        {(preview.rows || []).slice(0, 3).map((r, i) => (
                          <div key={i} className="flex border-b border-border/30 px-2 py-1 gap-3 last:border-0">
                            {(preview.columns || []).slice(0, 3).map(c => (
                              <span key={c.id} className="flex-1 text-foreground/70 truncate">
                                {typeof r.data?.[c.id] === "boolean"
                                  ? (r.data[c.id] ? "✓" : "")
                                  : String(r.data?.[c.id] || "").slice(0, 18) || "—"}
                              </span>
                            ))}
                          </div>
                        ))}
                        {(preview.rows || []).length === 0 && (
                          <div className="px-2 py-2 text-muted-foreground/50 italic">No rows yet</div>
                        )}
                      </div>
                    </div>
                    <div className="px-3 py-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{(preview.rows || []).length} rows</span>
                      <span>·</span>
                      <span>{(preview.columns || []).length} properties</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <NewDatabaseDialog open={showNewDb} onClose={() => setShowNewDb(false)} onCreate={createDb} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // TABLE VIEW
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Hidden CSV input */}
      <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImport} />

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 px-6 py-2.5 border-b border-border text-sm">
        <button onClick={() => setActivePage(null)} className="text-muted-foreground hover:text-foreground transition-colors">
          Databases
        </button>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium flex items-center gap-1.5">
          {activePage.icon} {activePage.title}
        </span>
        {isLocked && <Lock className="w-3.5 h-3.5 text-muted-foreground ml-1" />}
        {saveMut.isPending && <span className="text-[11px] text-muted-foreground ml-auto">Saving…</span>}
      </div>

      {/* Page title row */}
      <div className="px-6 pt-5 pb-1">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{activePage.icon || "🗄️"}</span>
          <h1 className="text-2xl font-bold">{activePage.title}</h1>
        </div>
      </div>

      {/* View tabs + toolbar */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-border gap-2 flex-wrap">
        {/* View switcher */}
        <div className="flex items-center gap-0.5">
          {VIEW_TYPES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                activeView === id ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              className="pl-8 pr-3 h-7 text-xs bg-muted rounded-md border-0 focus:outline-none focus:ring-1 focus:ring-ring w-36"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>

          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"><Filter className="w-3.5 h-3.5" />Filter</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"><ArrowUpDown className="w-3.5 h-3.5" />Sort</Button>

          {/* Hide columns */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
                <EyeOff className="w-3.5 h-3.5" />
                Hide
                {hidden.size > 0 && <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">{hidden.size}</Badge>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Toggle properties</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.filter(c => !c.fixed).map(col => {
                const Meta = COL_TYPES.find(t => t.value === col.type);
                const Icon = Meta?.icon || AlignLeft;
                return (
                  <DropdownMenuItem key={col.id} onClick={() => toggleHide(col.id)} className="gap-2">
                    <Icon className={`w-3.5 h-3.5 ${Meta?.color || "text-muted-foreground"}`} />
                    <span className="flex-1 text-xs">{col.label}</span>
                    {hidden.has(col.id) ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Customize */}
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setShowCustomize(true)}>
            <Settings2 className="w-3.5 h-3.5" />Customize
          </Button>

          {/* More actions (⋯) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={handleExport} className="gap-2 text-xs">
                <Download className="w-3.5 h-3.5" /> Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => csvRef.current?.click()} className="gap-2 text-xs">
                <Upload className="w-3.5 h-3.5" /> Import CSV
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-xs">
                <RefreshCw className="w-3.5 h-3.5" /> Merge with CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-xs" onClick={() => setIsLocked(l => !l)}>
                {isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                {isLocked ? "Unlock database" : "Lock database"}
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-xs">
                <Copy className="w-3.5 h-3.5" /> Duplicate database
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-xs text-destructive focus:text-destructive"
                onClick={async () => {
                  await Page.delete(activePage.id);
                  queryClient.invalidateQueries(["db-pages"]);
                  setActivePage(null);
                  toast.success("Database deleted");
                }}
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete database
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* New row */}
          <Button size="sm" className="h-7 text-xs gap-1 ml-1" onClick={addRow} disabled={isLocked}>
            <Plus className="w-3.5 h-3.5" /> New
          </Button>
        </div>
      </div>

      {/* ── TABLE VIEW ── */}
      {activeView === "table" && (
        <DatabaseTableErrorBoundary>
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm min-w-max">
            <thead>
              <tr className="border-b border-border sticky top-0 bg-background z-10">
                {/* # column */}
                <th className="w-10 border-r border-border/40 px-2 py-2 text-xs text-muted-foreground font-normal text-right bg-muted/20" />

                {visibleCols.map(col => {
                  const Meta = COL_TYPES.find(t => t.value === col.type);
                  const Icon = Meta?.icon || AlignLeft;
                  return (
                    <th key={col.id} className="border-r border-border/40 px-0 min-w-[140px] bg-muted/20">
                      <div className="flex items-center justify-between px-2 py-2 group/th">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                          <Icon className={`w-3.5 h-3.5 ${Meta?.color || ""}`} />
                          {col.label}
                        </div>
                        {!col.fixed && !isLocked && (
                          <ColumnHeaderDropdown
                            onHide={() => toggleHide(col.id)}
                            onDelete={() => deleteColumn(col.id)}
                            onEditOptions={
                              ['status', 'select', 'multiselect'].includes(col.type)
                                ? () => setEditingOptionsCol(col)
                                : undefined
                            }
                          />
                        )}
                      </div>
                    </th>
                  );
                })}

                {/* + add column */}
                {!isLocked && (
                  <th className="w-10 bg-muted/20">
                    <button
                      onClick={() => setShowAddProp(true)}
                      className="w-full h-full flex items-center justify-center py-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="Add property"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row, idx) => (
                <tr key={row.id} className="border-b border-border/40 hover:bg-accent/20 group/row transition-colors">
                  {/* Row number / delete */}
                  <td className="w-10 border-r border-border/40 px-2 text-xs text-muted-foreground text-right">
                    <span className="group-hover/row:hidden">{idx + 1}</span>
                    {!isLocked && (
                      <button
                        onClick={() => deleteRow(row.id)}
                        className="hidden group-hover/row:flex items-center justify-end text-muted-foreground hover:text-destructive transition-colors w-full"
                        title="Delete row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>

                  {visibleCols.map(col => (
                    <td key={col.id} className="border-r border-border/40 p-0">
                      {isLocked
                        ? <div className="px-2 py-1 text-xs min-h-[32px] flex items-center">{String(row.data?.[col.id] ?? "—")}</div>
                        : <Cell col={col} value={row.data?.[col.id]} onChange={val => updateCell(row.id, col.id, val)} />
                      }
                    </td>
                  ))}

                  {!isLocked && <td />}
                </tr>
              ))}

              {/* Add row */}
              {!isLocked && (
                <tr>
                  <td />
                  <td colSpan={visibleCols.length + 1} className="px-3 py-2">
                    <button
                      onClick={addRow}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> New row
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Footer */}
          <div className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border/50 flex items-center gap-3">
            <span>{filteredRows.length} {filteredRows.length === 1 ? "row" : "rows"}</span>
            {search && <span className="opacity-60">(filtered from {rows.length})</span>}
            {hidden.size > 0 && <span className="opacity-60">{hidden.size} hidden {hidden.size === 1 ? "property" : "properties"}</span>}
          </div>
        </div>
        </DatabaseTableErrorBoundary>
      )}

      {/* ── LIST VIEW ── */}
      {activeView === "list" && (
        <div className="flex-1 overflow-auto divide-y divide-border/50">
          {filteredRows.map((row, idx) => (
            <div key={row.id} className="flex items-center gap-4 px-6 py-3 hover:bg-accent/20 transition-colors group">
              <span className="text-xs text-muted-foreground w-5">{idx + 1}</span>
              <span className="font-medium text-sm flex-1 truncate">{row.data?.title || <span className="text-muted-foreground italic">Untitled</span>}</span>
              {columns.find(c => c.type === "status") && (
                (() => {
                  const sc = columns.find(c => c.type === "status");
                  const sv = row.data?.[sc.id];
                  const opt = STATUS_OPTS.find(o => o.label === sv);
                  return sv ? (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className={`w-2 h-2 rounded-full ${opt?.dot || "bg-gray-400"}`} />
                      {sv}
                    </div>
                  ) : null;
                })()
              )}
              {!isLocked && (
                <button onClick={() => deleteRow(row.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          {!isLocked && (
            <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-6 py-3 w-full transition-colors">
              <Plus className="w-3.5 h-3.5" /> New row
            </button>
          )}
        </div>
      )}

      {/* ── BOARD VIEW ── */}
      {activeView === "board" && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <LayoutGrid className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-sm">Board view coming soon</p>
            <p className="text-xs mt-1 opacity-60">Switch to Table or List for now</p>
          </div>
        </div>
      )}

      {/* Customize panel */}
      {showCustomize && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowCustomize(false)} />
          <CustomizePanel columns={columns} hidden={hidden} onToggle={toggleHide} onClose={() => setShowCustomize(false)} />
        </>
      )}

      {/* Add property modal */}
      <AddPropertyModal open={showAddProp} onClose={() => setShowAddProp(false)} onAdd={addColumn} />

      {editingOptionsCol && (
        <StatusOptionsPanel
          open={!!editingOptionsCol}
          onClose={() => setEditingOptionsCol(null)}
          options={
            editingOptionsCol.options?.filter((o) => typeof o === 'object') ??
            DEFAULT_STATUS_OPTIONS
          }
          onSave={(newOpts) => {
            updateColumn(editingOptionsCol.id, { options: newOpts });
            setEditingOptionsCol(null);
          }}
        />
      )}
    </div>
  );
}
