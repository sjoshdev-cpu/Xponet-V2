import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

const EMOJIS = [
  '📄', '📝', '📋', '📊', '📈', '📉', '📑', '📃', '📓', '📔',
  '📕', '📖', '📗', '📘', '📙', '📚', '🗂️', '📁', '📂', '🗃️',
  '👋', '🎉', '🎊', '🎯', '🏆', '⭐', '🌟', '💡', '🔥', '❤️',
  '💜', '💙', '💚', '💛', '🧡', '🤍', '🖤', '🤎', '🩷', '🩵',
  '🏠', '🏢', '🏗️', '🏭', '🏪', '🏫', '🏥', '🏰', '⛪', '🕌',
  '🚀', '✈️', '🚗', '🚌', '🚃', '🛳️', '🚲', '🏃', '🏋️', '⚽',
  '💻', '🖥️', '📱', '⌨️', '🖱️', '🎮', '🎧', '📷', '🎬', '🎨',
  '🐛', '🔧', '⚙️', '🔨', '🛠️', '🔬', '🔭', '💊', '🧪', '🧬',
  '🌍', '🌎', '🌏', '🌐', '🗺️', '🧭', '⛰️', '🏔️', '🌋', '🗻',
  '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍑'
];

export default function EmojiPicker({ children, onSelect }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Input
          placeholder="Search emoji..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm mb-2"
        />
        <div className="grid grid-cols-8 gap-0.5 max-h-48 overflow-y-auto">
          {EMOJIS.map(emoji => (
            <button
              key={emoji}
              className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent transition-colors text-lg"
              onClick={() => { onSelect(emoji); setOpen(false); }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}