'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Plus, Copy, List, Sparkles } from 'lucide-react';

interface AddChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddChecklist: (name: string, templateItems?: string[]) => Promise<boolean>;
  isLoading?: boolean;
  existingChecklists?: Array<{
    id: string;
    name: string;
    items: Array<{ text: string; completed: boolean }>;
  }>;
}

export function AddChecklistModal({
  isOpen,
  onClose,
  onAddChecklist,
  isLoading = false,
  existingChecklists = [],
}: AddChecklistModalProps) {
  const [checklistName, setChecklistName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('none');
  const [showTemplates, setShowTemplates] = useState(false);

  // Predefined templates
  const predefinedTemplates = [
    {
      id: 'project-setup',
      name: 'Project Setup',
      items: [
        'Define project requirements',
        'Set up development environment',
        'Create project structure',
        'Initialize version control',
        'Set up CI/CD pipeline',
      ],
    },
    {
      id: 'code-review',
      name: 'Code Review',
      items: [
        'Check code functionality',
        'Review code style and formatting',
        'Verify error handling',
        'Test edge cases',
        'Update documentation',
      ],
    },
    {
      id: 'deployment',
      name: 'Deployment',
      items: [
        'Run all tests',
        'Build production version',
        'Deploy to staging',
        'Perform smoke tests',
        'Deploy to production',
        'Monitor system health',
      ],
    },
  ];

  const allTemplates = [
    ...predefinedTemplates,
    ...existingChecklists.map((checklist) => ({
      id: checklist.id,
      name: checklist.name,
      items: checklist.items.map((item) => item.text),
      isExisting: true,
    })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checklistName.trim() && !isLoading) {
      let templateItems: string[] | undefined;

      if (selectedTemplate !== 'none') {
        const template = allTemplates.find((t) => t.id === selectedTemplate);
        templateItems = template?.items;
      }

      const success = await onAddChecklist(checklistName.trim(), templateItems);
      if (success) {
        setChecklistName('');
        setSelectedTemplate('none');
        setShowTemplates(false);
        onClose();
      }
    }
  };

  const handleClose = () => {
    setChecklistName('');
    setSelectedTemplate('none');
    setShowTemplates(false);
    onClose();
  };

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4'>
      <div className='bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm sm:max-w-lg max-h-[85vh] overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200'>
        {/* Header */}
        <div className='bg-gradient-to-r from-primary to-primary/90 px-6 py-4'>
          <div className='flex items-center justify-between text-white'>
            <div className='flex items-center gap-3'>
              <div className='w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center'>
                <CheckSquare className='w-4 h-4' />
              </div>
              <div>
                <h3 className='text-lg font-semibold'>Add Checklist</h3>
                <p className='text-sm text-white/80'>
                  Create a new checklist for this card
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className='p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200'
              title='Close modal'
              aria-label='Close modal'
            >
              <X className='w-5 h-5' />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className='p-6'>
          <form onSubmit={handleSubmit} className='space-y-6'>
            {/* Checklist Name */}
            <div>
              <label
                htmlFor='checklist-name'
                className='block text-sm font-medium text-foreground mb-3'
              >
                <div className='flex items-center gap-2'>
                  <List className='w-4 h-4 text-muted-foreground' />
                  Checklist Title
                </div>
              </label>
              <input
                id='checklist-name'
                type='text'
                value={checklistName}
                onChange={(e) => setChecklistName(e.target.value)}
                placeholder='Enter checklist title...'
                className='w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200'
                autoFocus
                disabled={isLoading}
                maxLength={100}
              />
              <div className='flex justify-between items-center mt-2'>
                <p className='text-xs text-muted-foreground'>
                  Give your checklist a clear, descriptive name
                </p>
                <span className='text-xs text-muted-foreground'>
                  {checklistName.length}/100
                </span>
              </div>
            </div>

            {/* Template Section */}
            <div>
              <div className='flex items-center justify-between mb-3'>
                <label className='block text-sm font-medium text-foreground'>
                  <div className='flex items-center gap-2'>
                    <Copy className='w-4 h-4 text-muted-foreground' />
                    Copy items from...
                  </div>
                </label>
                {allTemplates.length > 0 && (
                  <button
                    type='button'
                    onClick={() => setShowTemplates(!showTemplates)}
                    className='text-xs text-primary hover:text-primary/80 font-medium transition-colors'
                  >
                    {showTemplates ? 'Hide templates' : 'Show templates'}
                  </button>
                )}
              </div>

              <div className='relative'>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className='w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 appearance-none cursor-pointer'
                  disabled={isLoading}
                  aria-label='Select checklist template'
                >
                  <option value='none'>Start with empty checklist</option>
                  {predefinedTemplates.length > 0 && (
                    <optgroup label='Templates'>
                      {predefinedTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} ({template.items.length} items)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {existingChecklists.length > 0 && (
                    <optgroup label='Existing Checklists'>
                      {existingChecklists.map((checklist) => (
                        <option key={checklist.id} value={checklist.id}>
                          {checklist.name} ({checklist.items.length} items)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                  <svg
                    className='w-4 h-4 text-muted-foreground'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M19 9l-7 7-7-7'
                    />
                  </svg>
                </div>
              </div>

              {/* Template Preview */}
              {showTemplates && selectedTemplate !== 'none' && (
                <div className='mt-4 p-4 bg-muted/30 border border-border rounded-lg'>
                  <div className='flex items-center gap-2 mb-3'>
                    <Sparkles className='w-4 h-4 text-primary' />
                    <span className='text-sm font-medium text-foreground'>
                      Template Preview
                    </span>
                  </div>
                  <div className='space-y-2 max-h-32 overflow-y-auto'>
                    {allTemplates
                      .find((t) => t.id === selectedTemplate)
                      ?.items.slice(0, 5)
                      .map((item, index) => (
                        <div
                          key={index}
                          className='flex items-center gap-2 text-sm text-muted-foreground'
                        >
                          <div className='w-3 h-3 border border-border rounded-sm flex-shrink-0' />
                          <span className='truncate'>{item}</span>
                        </div>
                      ))}
                    {allTemplates.find((t) => t.id === selectedTemplate)?.items
                      .length > 5 && (
                      <div className='text-xs text-muted-foreground pl-5'>
                        +
                        {allTemplates.find((t) => t.id === selectedTemplate)
                          ?.items.length - 5}{' '}
                        more items...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className='flex gap-3 pt-4 border-t border-border'>
              <button
                type='button'
                onClick={handleClose}
                className='flex-1 px-4 py-3 bg-secondary text-secondary-foreground text-sm font-medium rounded-lg hover:bg-secondary/80 transition-all duration-200 border border-border'
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={!checklistName.trim() || isLoading}
                className='flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md'
              >
                {isLoading ? (
                  <>
                    <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className='w-4 h-4' />
                    Create Checklist
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
