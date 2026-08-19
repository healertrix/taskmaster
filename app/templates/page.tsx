'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardHeader } from '../components/dashboard/header';
import { TemplateEditor } from '../components/templates/TemplateEditor';
import { useTemplates, type BoardTemplate } from '@/hooks/useTemplates';
import { validateTemplateStructure, EMPTY_TEMPLATE_STRUCTURE, type TemplateStructure } from '@/utils/boardTemplates';
import {
  LayoutTemplate,
  Plus,
  Loader2,
  Trash2,
  ArrowLeft,
  AlertTriangle,
  Save,
  Sparkles,
} from 'lucide-react';

type View = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; template: BoardTemplate };

export default function TemplatesPage() {
  const { personalTemplates, starterTemplates, isLoading, refetch } = useTemplates();
  const [view, setView] = useState<View>({ mode: 'list' });

  return (
    <div className='min-h-screen dot-pattern-dark'>
      <DashboardHeader />
      <main className='container mx-auto max-w-3xl px-3 sm:px-4 pt-20 sm:pt-24 pb-8 sm:pb-16'>
        {view.mode === 'list' ? (
          <TemplatesList
            personalTemplates={personalTemplates}
            starterTemplates={starterTemplates}
            isLoading={isLoading}
            onCreate={() => setView({ mode: 'create' })}
            onEdit={(template) => setView({ mode: 'edit', template })}
          />
        ) : (
          <TemplateForm
            key={view.mode === 'edit' ? view.template.id : 'new'}
            existing={view.mode === 'edit' ? view.template : null}
            onDone={() => {
              refetch();
              setView({ mode: 'list' });
            }}
            onCancel={() => setView({ mode: 'list' })}
          />
        )}
      </main>
    </div>
  );
}

function TemplatesList({
  personalTemplates,
  starterTemplates,
  isLoading,
  onCreate,
  onEdit,
}: {
  personalTemplates: BoardTemplate[];
  starterTemplates: BoardTemplate[];
  isLoading: boolean;
  onCreate: () => void;
  onEdit: (template: BoardTemplate) => void;
}) {
  const router = useRouter();

  return (
    <>
      <button
        onClick={() => router.back()}
        className='p-2 -ml-2 mb-6 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
        aria-label='Back'
        title='Back'
      >
        <ArrowLeft className='w-4 h-4' />
      </button>

      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-xl sm:text-2xl font-bold text-foreground heading-enter'>
            Board templates
          </h1>
          <p className='text-sm text-muted-foreground mt-1'>
            Reusable list/label/custom-field setups, usable when creating a board in any workspace
          </p>
        </div>
        <button
          onClick={onCreate}
          className='flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex-shrink-0'
        >
          <Plus className='w-4 h-4' /> New template
        </button>
      </div>

      {isLoading ? (
        <div className='flex items-center justify-center py-16'>
          <Loader2 className='w-6 h-6 animate-spin text-muted-foreground' />
        </div>
      ) : (
        <div className='space-y-8'>
          {personalTemplates.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 text-center bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl'>
              <div className='w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4'>
                <LayoutTemplate className='w-8 h-8 text-muted-foreground' />
              </div>
              <p className='text-sm text-muted-foreground'>No templates yet</p>
              <p className='text-xs text-muted-foreground mt-1'>
                Build one here, or save an existing board as a template from its settings
              </p>
            </div>
          ) : (
            <div className='grid gap-3 sm:grid-cols-2'>
              {personalTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => onEdit(template)}
                  className='text-left p-4 bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl hover:border-primary/50 transition-colors'
                >
                  <div className='flex items-center gap-2 mb-2'>
                    <LayoutTemplate className='w-4 h-4 text-primary flex-shrink-0' />
                    <h3 className='font-medium text-sm text-foreground truncate'>
                      {template.name}
                    </h3>
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    {template.structure.lists.length} list
                    {template.structure.lists.length === 1 ? '' : 's'} ·{' '}
                    {template.structure.labels.length} label
                    {template.structure.labels.length === 1 ? '' : 's'} ·{' '}
                    {template.structure.customFields.length} custom field
                    {template.structure.customFields.length === 1 ? '' : 's'}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Read-only — shared across every account, not something any
              one user's edit/delete should apply to. Not clickable into
              the editor at all (attempting to save/delete one would just
              fail against RLS, since these rows have no owner for the
              existing "manage your own" policy to match against — see the
              starter_board_templates migration). */}
          {starterTemplates.length > 0 && (
            <div>
              <h2 className='text-sm font-semibold text-foreground mb-1'>
                Starter templates
              </h2>
              <p className='text-xs text-muted-foreground mb-3'>
                Built-in, available to everyone — pick one when creating a board instead of
                editing it here.
              </p>
              <div className='grid gap-3 sm:grid-cols-2'>
                {starterTemplates.map((template) => (
                  <div
                    key={template.id}
                    className='p-4 bg-card/40 border border-border/40 rounded-2xl'
                  >
                    <div className='flex items-center gap-2 mb-2'>
                      <Sparkles className='w-4 h-4 text-muted-foreground flex-shrink-0' />
                      <h3 className='font-medium text-sm text-foreground truncate'>
                        {template.name}
                      </h3>
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      {template.structure.lists.length} list
                      {template.structure.lists.length === 1 ? '' : 's'} ·{' '}
                      {template.structure.labels.length} label
                      {template.structure.labels.length === 1 ? '' : 's'} ·{' '}
                      {template.structure.customFields.length} custom field
                      {template.structure.customFields.length === 1 ? '' : 's'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function TemplateForm({
  existing,
  onDone,
  onCancel,
}: {
  existing: BoardTemplate | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(existing?.name || '');
  const [structure, setStructure] = useState<TemplateStructure>(
    existing?.structure || EMPTY_TEMPLATE_STRUCTURE
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }
    try {
      validateTemplateStructure(structure);
    } catch (validationError) {
      setError(
        validationError instanceof Error ? validationError.message : 'Invalid template'
      );
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const url = existing ? `/api/templates/${existing.id}` : '/api/templates';
      const response = await fetch(url, {
        method: existing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), structure }),
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to save template');
        return;
      }
      onDone();
    } catch (err) {
      console.error('Failed to save template:', err);
      setError('Failed to save template. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!existing) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/templates/${existing.id}`, {
        method: 'DELETE',
      });
      if (response.ok) onDone();
    } catch (err) {
      console.error('Failed to delete template:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <div className='flex items-center justify-between mb-6'>
        <button
          onClick={onCancel}
          className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
        >
          <ArrowLeft className='w-4 h-4' /> Back to templates
        </button>
        {existing && (
          <button
            onClick={() => {
              setDeleteConfirmName('');
              setShowDeleteConfirm(true);
            }}
            className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors'
          >
            <Trash2 className='w-3.5 h-3.5' /> Delete template
          </button>
        )}
      </div>

      <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-5'>
        <TemplateEditor
          name={name}
          onNameChange={setName}
          structure={structure}
          onStructureChange={setStructure}
        />

        {error && <p className='text-sm text-destructive mt-4'>{error}</p>}

        <button
          onClick={save}
          disabled={isSaving || !name.trim()}
          className='w-full flex items-center justify-center gap-2 mt-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
        >
          {isSaving ? (
            <>
              <Loader2 className='w-4 h-4 animate-spin' /> Saving...
            </>
          ) : (
            <>
              <Save className='w-4 h-4' /> {existing ? 'Save changes' : 'Create template'}
            </>
          )}
        </button>
      </div>

      {/* Delete confirmation — same type-the-name-to-confirm pattern as
          board deletion, not the lighter custom-fields-style confirm,
          per explicit request. */}
      {showDeleteConfirm && existing && (
        <div className='fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6'>
          <div className='bg-card/90 backdrop-blur-xl rounded-lg shadow-xl max-w-lg w-full p-6 border border-destructive/30'>
            <div className='flex items-center gap-3 mb-6'>
              <div className='w-12 h-12 rounded-full bg-destructive/15 flex items-center justify-center'>
                <Trash2 className='w-6 h-6 text-destructive' />
              </div>
              <div>
                <h3 className='text-xl font-bold text-foreground'>Delete template</h3>
                <p className='text-sm text-muted-foreground'>
                  This action cannot be undone
                </p>
              </div>
            </div>

            <div className='p-4 bg-destructive/10 border border-destructive/30 rounded-lg mb-6'>
              <p className='text-sm text-destructive/90 flex items-center gap-2'>
                <AlertTriangle className='w-4 h-4 flex-shrink-0' />
                Boards already created from this template are unaffected — only the
                template itself is deleted.
              </p>
            </div>

            <label className='block text-sm font-medium text-foreground mb-2'>
              Type the template name{' '}
              <span className='font-bold text-destructive'>&ldquo;{existing.name}&rdquo;</span>{' '}
              to confirm:
            </label>
            <input
              type='text'
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={existing.name}
              className='w-full p-3 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive focus:border-transparent mb-6'
              disabled={isDeleting}
              autoFocus
            />

            <div className='flex gap-3'>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className='flex-1 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting || deleteConfirmName !== existing.name}
                className='flex-1 px-4 py-2.5 text-sm font-medium bg-destructive hover:bg-destructive/90 disabled:bg-destructive/50 disabled:cursor-not-allowed text-destructive-foreground rounded-lg transition-colors flex items-center justify-center gap-2'
              >
                {isDeleting ? (
                  <>
                    <Loader2 className='w-4 h-4 animate-spin' /> Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className='w-4 h-4' /> Delete template permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
