import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const GRADIENT_PRESETS = [
  { label: 'Ocean', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { label: 'Sunset', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { label: 'Forest', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { label: 'Fire', value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { label: 'Night', value: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' },
  { label: 'Peach', value: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' },
];

export default function CoverImage({ coverUrl, coverPosition = 50, onUpdate }) {
  const [hovered, setHovered] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [position, setPosition] = useState(coverPosition);
  const [isDragging, setIsDragging] = useState(false);
  const coverRef = useRef(null);

  const isGradient = coverUrl?.startsWith('linear-gradient');

  const handleMouseMove = (e) => {
    if (!isDragging || !coverRef.current) return;
    const rect = coverRef.current.getBoundingClientRect();
    const pct = Math.round(Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)));
    setPosition(pct);
    onUpdate({ cover_url: coverUrl, cover_position: pct });
  };

  return (
    <>
      <div
        ref={coverRef}
        className="relative h-[250px] w-full bg-cover overflow-hidden group cursor-row-resize"
        style={isGradient ? { background: coverUrl } : { backgroundImage: `url(${coverUrl})`, backgroundPositionY: `${position}%` }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setIsDragging(false); }}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseMove={handleMouseMove}
      >
        {hovered && (
          <div className="absolute bottom-3 right-3 flex gap-2" onMouseDown={e => e.stopPropagation()}>
            <Button size="sm" variant="secondary" className="h-7 text-xs shadow-md" onClick={() => setShowModal(true)}>
              Change cover
            </Button>
            {!isGradient && (
              <Button size="sm" variant="secondary" className="h-7 text-xs shadow-md" onMouseDown={() => setIsDragging(true)}>
                Reposition
              </Button>
            )}
          </div>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change cover</DialogTitle>
            <DialogDescription className="sr-only">Select a gradient or upload a custom cover image.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Gradient presets</Label>
              <div className="grid grid-cols-3 gap-2">
                {GRADIENT_PRESETS.map(g => (
                  <button
                    key={g.label}
                    onClick={() => { onUpdate({ cover_url: g.value, cover_position: 50 }); setShowModal(false); }}
                    className={cn('h-14 rounded-lg border-2 transition-all hover:scale-105', coverUrl === g.value ? 'border-primary' : 'border-transparent')}
                    style={{ background: g.value }}
                    title={g.label}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Image URL</Label>
              <div className="flex gap-2">
                <Input
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="https://..."
                  className="flex-1"
                />
                <Button size="sm" onClick={() => { if (urlInput) { onUpdate({ cover_url: urlInput, cover_position: 50 }); setShowModal(false); } }}>
                  Apply
                </Button>
              </div>
            </div>
            {coverUrl && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => { onUpdate({ cover_url: null }); setShowModal(false); }}>
                Remove cover
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}