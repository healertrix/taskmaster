'use client';

import { useEffect, useState } from 'react';
import { Edit3, Loader2, Save, X } from 'lucide-react';
import { colorForKey, colorForNumber } from '@/utils/idColor';
import { renderDescription } from '@/components/ui/DescriptionText';
import { DescriptionEditor } from '@/components/ui/DescriptionEditor';

// Shared "Information" modal for both boards and workspaces — description
// view/edit plus created/updated dates. Replaces two near-identical local
// components (DescriptionModal in app/board/[id]/page.tsx and
// WorkspaceDescriptionModal in app/boards/[id]/page.tsx) that had drifted
// slightly apart in styling; one component now, used by both.

const formatAbsoluteDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const formatRelative = (dateString: string) => {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

interface EntityInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'board' | 'workspace';
  name: string;
  // Used to derive the header color dot — the entity's own id (board or
  // workspace), same rule used everywhere else in the app (see
  // utils/idColor.ts).
  colorSeed: string;
  // Feeds the header color dot for both entity types (guaranteed-spread
  // colorForNumber over the hash-based colorForKey fallback). Only shown
  // as a visible "#N" badge next to the name for boards — workspace
  // numbers exist purely for color derivation, not as a shareable id.
  number?: number | null;
  description: string;
  onSave: (description: string) => Promise<boolean>;
  createdAt: string;
  // Boards only — last_activity_at. Falls back to createdAt when null
  // (a brand-new board's "last activity" is reasonably its creation).
  // Omit entirely for workspaces — there's no workspace-level activity
  // signal, so nothing is shown rather than showing a stale/misleading
  // updated_at from just a name/description edit.
  updatedAt?: string | null;
}

export function EntityInfoModal({
  isOpen,
  onClose,
  entityType,
  name,
  colorSeed,
  number,
  description,
  onSave,
  createdAt,
  updatedAt,
}: EntityInfoModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState(description);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEditDescription(description);
      setIsEditing(false);
    }
  }, [isOpen, description]);

  const handleSave = async () => {
    if (editDescription.trim() === description) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    const success = await onSave(editDescription);
    setIsSaving(false);

    if (success) {
      setIsEditing(false);
    } else {
      setEditDescription(description);
    }
  };

  const handleCancelEdit = () => {
    setEditDescription(description);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // ESC key + back-button/gesture handling, and a history entry so a
  // mobile back gesture closes the modal instead of leaving the page.
  useEffect(() => {
    if (!isOpen) return;

    const handleEscapeAction = () => {
      if (isEditing) {
        handleCancelEdit();
      } else {
        onClose();
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleEscapeAction();
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      handleEscapeAction();
      window.history.pushState(null, '', window.location.href);
    };

    window.history.pushState(null, '', window.location.href);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('popstate', handlePopState);
    return () => {
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('popstate', handlePopState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEditing, description, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const dotColor =
    number != null ? colorForNumber(number) : colorForKey(colorSeed);
  const effectiveUpdatedAt =
    entityType === 'board' ? updatedAt || createdAt : null;

  return (
    <div
      className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'
      onClick={handleBackdropClick}
    >
      <div className='bg-card/90 backdrop-blur-xl rounded-xl shadow-2xl border border-border max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col'>
        {/* Header — name is the prominent element; "Board/Workspace
            Information" is a small subtle label above it, not the
            headline. */}
        <div className='flex items-start justify-between gap-3 p-6 border-b border-border'>
          <div className='flex items-start gap-3 min-w-0'>
            <span
              className='w-3 h-3 rounded-full flex-shrink-0 mt-2'
              style={{ backgroundColor: dotColor }}
            />
            <div className='min-w-0'>
              <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                {entityType === 'board' ? 'Board Information' : 'Workspace Information'}
              </p>
              <h2 className='text-xl font-semibold text-foreground truncate'>
                {name}
                {entityType === 'board' && number != null && (
                  <span
                    className='ml-1.5 text-sm font-normal text-muted-foreground align-middle'
                    title='Board number'
                  >
                    #{number}
                  </span>
                )}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className='p-2 hover:bg-muted/50 rounded-lg transition-colors flex-shrink-0'
            title='Close'
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        {/* Created / updated meta row */}
        <div className='flex items-center gap-4 px-6 py-3 text-xs text-muted-foreground border-b border-border/50'>
          <span>Created {formatAbsoluteDate(createdAt)}</span>
          {effectiveUpdatedAt && (
            <span>Updated {formatRelative(effectiveUpdatedAt)}</span>
          )}
        </div>

        {/* Content */}
        <div className='p-6 overflow-y-auto'>
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <label className='text-sm font-medium text-foreground'>
                Description
              </label>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className='text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors'
                >
                  <Edit3 className='w-3 h-3' />
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <div className='space-y-2'>
                <DescriptionEditor
                  value={editDescription}
                  onChange={setEditDescription}
                  onKeyDown={handleKeyDown}
                  placeholder={`Add a description for this ${entityType}... paste a link, or wrap text in **bold** / _italic_ / ==highlight==`}
                  disabled={isSaving}
                  autoFocus
                />
                <div className='flex items-center justify-between'>
                  <p className='text-xs text-muted-foreground'>
                    Ctrl + Enter to save, Escape to cancel
                  </p>
                  <div className='flex items-center gap-2'>
                    <button
                      onClick={handleCancelEdit}
                      className='px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className='px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50'
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className='w-3 h-3 animate-spin' />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className='w-3 h-3' />
                          Save
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className='min-h-[80px] p-3 bg-muted/20 border border-border/50 rounded-lg cursor-pointer hover:bg-muted/30 transition-colors group'
                onClick={() => setIsEditing(true)}
                title='Click to edit description'
              >
                {description && description.trim() ? (
                  <div className='relative'>
                    <p className='text-sm text-foreground whitespace-pre-wrap leading-relaxed pr-5'>
                      {renderDescription(description)}
                    </p>
                    <div className='absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity'>
                      <Edit3 className='w-3 h-3 text-muted-foreground' />
                    </div>
                  </div>
                ) : (
                  <p className='text-sm text-muted-foreground italic'>
                    No description yet — click to add one
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className='px-6 py-4 bg-muted/20 border-t border-border'>
          <div className='flex items-center justify-between text-xs text-muted-foreground'>
            <span>Click outside or press Esc to close</span>
            <span>Ctrl + Enter to save when editing</span>
          </div>
        </div>
      </div>
    </div>
  );
}
