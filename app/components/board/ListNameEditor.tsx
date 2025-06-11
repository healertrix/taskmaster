'use client';

import React, { useState } from 'react';
import { Edit3, Loader2 } from 'lucide-react';

interface ListNameEditorProps {
  listName: string;
  onSave: (name: string) => Promise<boolean>;
}

export function ListNameEditor({ listName, onSave }: ListNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(listName);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (editName.trim() === listName || !editName.trim()) {
      setIsEditing(false);
      setEditName(listName);
      return;
    }

    setIsSaving(true);
    const success = await onSave(editName);
    setIsSaving(false);

    if (success) {
      setIsEditing(false);
    } else {
      setEditName(listName); // Revert on failure
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditName(listName);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className='flex items-center gap-2 flex-1'>
        <input
          type='text'
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className='text-sm font-semibold bg-white/10 border border-white/20 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white/30 text-white placeholder:text-white/60 flex-1'
          autoFocus
          disabled={isSaving}
          placeholder='List name'
          aria-label='Edit list name'
          maxLength={100}
        />
        {isSaving && <Loader2 className='w-4 h-4 animate-spin text-white/80' />}
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className='text-sm font-semibold text-foreground flex items-center gap-2 hover:bg-white/10 px-2 py-1 rounded transition-colors group flex-1 text-left'
      title='Click to edit list name'
    >
      <span className='flex-1 truncate'>{listName}</span>
      <Edit3 className='w-3 h-3 opacity-0 group-hover:opacity-70 transition-opacity text-white/80' />
    </button>
  );
}
