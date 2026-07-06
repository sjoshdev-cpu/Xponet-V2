// Panel for adding / renaming / recoloring / deleting status or select options.
// Props:
//   open     – boolean
//   onClose  – () => void
//   options  – [{ id, name, color }]
//   onSave   – (newOptions) => void
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input }  from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import { COLOR_PALETTE, OPTION_COLORS_HEX, colorHex } from './db-constants.js';
import { genId } from './db-utils.js';

export default function StatusOptionsPanel({ open, onClose, options = [], onSave }) {
  const [opts, setOpts] = useState(() => options.map((o) => ({ ...o })));
  // ID of the option whose name input should be auto-focused (set when adding a new row)
  const [focusingId, setFocusingId] = useState(null);
  // ID of the option whose color popover is currently open
  const [openColorId, setOpenColorId] = useState(null);

  const addOpt = () => {
    const nextColor = OPTION_COLORS_HEX[opts.length % OPTION_COLORS_HEX.length];
    const newOpt = { id: genId(), name: 'New option', color: nextColor };
    setOpts((prev) => [...prev, newOpt]);
    setFocusingId(newOpt.id); // signal the new row's input to auto-focus
  };

  const updateOpt = (id, key, val) =>
    setOpts((prev) => prev.map((o) => (o.id === id ? { ...o, [key]: val } : o)));

  const removeOpt = (id) =>
    setOpts((prev) => prev.filter((o) => o.id !== id));

  const handleSave = () => {
    onSave(opts.filter((o) => (o.name ?? o.label ?? '').trim()));
    onClose();
  };

  // Sync internal state when the panel is reopened with different options
  const handleOpenChange = (v) => {
    if (!v) onClose();
    else {
      setOpts(options.map((o) => ({ ...o })));
      setFocusingId(null);
      setOpenColorId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit options</DialogTitle>
          <DialogDescription className="sr-only">
            Add, rename, recolor, or delete options for this property.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 max-h-64 overflow-y-auto py-1 pr-1">
          {opts.map((opt) => (
            <div key={opt.id} className="flex items-center gap-2">
              <GripVertical className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 cursor-grab" />

              {/* Color dot — clicking opens a popover with 8 preset color circles */}
              <Popover
                open={openColorId === opt.id}
                onOpenChange={(v) => setOpenColorId(v ? opt.id : null)}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Change color — current: ${opt.color ?? 'gray'}`}
                    className="w-5 h-5 rounded-full flex-shrink-0 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                    style={{ backgroundColor: colorHex(opt.color) }}
                  />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2.5" align="start" side="bottom">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Color</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        title={c.label}
                        onClick={() => {
                          updateOpt(opt.id, 'color', c.key);
                          setOpenColorId(null);
                        }}
                        className={`w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${
                          opt.color === c.key ? 'ring-2 ring-ring ring-offset-1' : ''
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Option name — inline editable; Enter saves, blur keeps changes in state */}
              <Input
                value={opt.name ?? opt.label ?? ''}
                onChange={(e) => updateOpt(opt.id, 'name', e.target.value)}
                autoFocus={focusingId === opt.id}
                onFocus={() => { if (focusingId === opt.id) setFocusingId(null); }}
                className="h-7 flex-1 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
                  if (e.key === 'Escape') { e.currentTarget.blur(); }
                }}
              />

              {/* Delete */}
              <button
                type="button"
                onClick={() => removeOpt(opt.id)}
                className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                aria-label="Delete option"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <Button variant="ghost" size="sm" onClick={addOpt} className="gap-1.5 w-fit -mt-1">
          <Plus className="w-3.5 h-3.5" /> Add option
        </Button>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
