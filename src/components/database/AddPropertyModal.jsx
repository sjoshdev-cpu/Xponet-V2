// Shared "Add a property" dialog — used by Databases.jsx and DocumentHub.jsx
// onAdd receives: { id, label, type, options? }
// DocumentHub callers should remap `id` → `key` before persisting to Firestore.
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input }  from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast }  from 'sonner';
import {
  AlignLeft, Hash, ToggleLeft, Check, Calendar, User,
  FileText, Link, Mail, Phone, Columns3,
} from 'lucide-react';

// ─── Column type catalogue ───────────────────────────────────────────────────
export const COL_TYPES = [
  { value: 'text',        label: 'Text',          icon: AlignLeft,  color: 'text-gray-400'   },
  { value: 'number',      label: 'Number',        icon: Hash,       color: 'text-blue-400'   },
  { value: 'select',      label: 'Select',        icon: ToggleLeft, color: 'text-purple-400' },
  { value: 'multiselect', label: 'Multi-select',  icon: Columns3,   color: 'text-indigo-400' },
  { value: 'status',      label: 'Status',        icon: Check,      color: 'text-green-400'  },
  { value: 'date',        label: 'Date',          icon: Calendar,   color: 'text-amber-400'  },
  { value: 'person',      label: 'Person',        icon: User,       color: 'text-pink-400'   },
  { value: 'files',       label: 'Files & media', icon: FileText,   color: 'text-yellow-400' },
  { value: 'url',         label: 'URL',           icon: Link,       color: 'text-cyan-400'   },
  { value: 'email',       label: 'Email',         icon: Mail,       color: 'text-red-400'    },
  { value: 'phone',       label: 'Phone',         icon: Phone,      color: 'text-teal-400'   },
  { value: 'checkbox',    label: 'Checkbox',      icon: Check,      color: 'text-emerald-400'},
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function AddPropertyModal({ open, onClose, onAdd }) {
  const [type,    setType]    = useState('text');
  const [label,   setLabel]   = useState('');
  const [options, setOptions] = useState('');

  const submit = () => {
    if (!label.trim()) { toast.error('Property name required'); return; }
    onAdd({
      id:      `c_${Date.now()}`,
      label:   label.trim(),
      type,
      options: ['select', 'multiselect'].includes(type)
        ? options.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
    });
    setLabel(''); setType('text'); setOptions(''); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a property</DialogTitle>
          <DialogDescription className="sr-only">Add a new property to this database.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Name</label>
            <Input
              autoFocus
              placeholder="Property name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>

          {/* Type picker */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Type</label>
            <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
              {COL_TYPES.map(({ value, label: lbl, icon: Icon, color }) => (
                <button
                  key={value}
                  onClick={() => setType(value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors border ${
                    type === value
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-transparent bg-muted hover:bg-accent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${type === value ? 'text-primary' : color}`} />
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Options — shown only for select / multiselect */}
          {['select', 'multiselect'].includes(type) && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                Options <span className="opacity-60">(comma-separated)</span>
              </label>
              <Input
                placeholder="Option A, Option B, Option C"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Add property</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
