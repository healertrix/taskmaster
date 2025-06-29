'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Paperclip,
  Link,
  Upload,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  AlertCircle,
} from 'lucide-react';

interface AttachmentData {
  id: string;
  name: string;
  url: string;
  type: string;
  created_at: string;
  created_by: string;
}

interface AttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAttachment: (
    name: string,
    url: string,
    type: string
  ) => Promise<boolean>;
  onUpdateAttachment?: (
    attachmentId: string,
    name: string,
    url: string,
    type: string
  ) => Promise<boolean>;
  isLoading?: boolean;
  editingAttachment?: AttachmentData | null;
}

export function AttachmentModal({
  isOpen,
  onClose,
  onAddAttachment,
  onUpdateAttachment,
  isLoading = false,
  editingAttachment = null,
}: AttachmentModalProps) {
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentType, setAttachmentType] = useState('link');
  const [urlError, setUrlError] = useState('');

  // Populate form when editing
  useEffect(() => {
    if (editingAttachment) {
      setAttachmentName(editingAttachment.name);
      setAttachmentUrl(editingAttachment.url);
      setAttachmentType(editingAttachment.type);
      setUrlError('');
    } else {
      setAttachmentName('');
      setAttachmentUrl('');
      setAttachmentType('link');
      setUrlError('');
    }
  }, [editingAttachment, isOpen]);

  const handleClose = () => {
    if (!isLoading) {
      setAttachmentName('');
      setAttachmentUrl('');
      setAttachmentType('link');
      setUrlError('');
      onClose();
    }
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
  }, [isOpen, isLoading]);

  const isValidUrl = (string: string): boolean => {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  };

  const generateDisplayName = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // Extract filename from path
      const filename = pathname.split('/').pop() || '';

      if (filename && filename.includes('.')) {
        // Remove file extension for cleaner display
        return filename.replace(/\.[^/.]+$/, '');
      }

      // Use domain name if no filename
      return urlObj.hostname.replace('www.', '');
    } catch (_) {
      return 'Attachment';
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setAttachmentUrl(url);

    if (url.trim()) {
      if (isValidUrl(url.trim())) {
        setUrlError('');
        // Auto-generate display name if none provided and not editing
        if (!attachmentName.trim() && !editingAttachment) {
          setAttachmentName(generateDisplayName(url.trim()));
        }
      } else {
        setUrlError(
          'Please enter a valid URL (must start with http:// or https://)'
        );
      }
    } else {
      setUrlError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedUrl = attachmentUrl.trim();
    if (!trimmedUrl || isLoading) return;

    // Validate URL
    if (!isValidUrl(trimmedUrl)) {
      setUrlError(
        'Please enter a valid URL (must start with http:// or https://)'
      );
      return;
    }

    // Use provided name or generate one from URL
    const finalName = attachmentName.trim() || generateDisplayName(trimmedUrl);

    // Detect attachment type based on URL
    const detectedType = detectAttachmentType(trimmedUrl);

    let success = false;

    if (editingAttachment && onUpdateAttachment) {
      // Update existing attachment
      success = await onUpdateAttachment(
        editingAttachment.id,
        finalName,
        trimmedUrl,
        detectedType
      );
    } else {
      // Add new attachment
      success = await onAddAttachment(finalName, trimmedUrl, detectedType);
    }

    if (success) {
      handleClose();
    }
  };

  const detectAttachmentType = (url: string): string => {
    const lowerUrl = url.toLowerCase();

    // Image types
    if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|$)/)) {
      return 'image';
    }

    // Document types
    if (lowerUrl.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt)(\?|$)/)) {
      return 'document';
    }

    // Video types
    if (lowerUrl.match(/\.(mp4|avi|mov|wmv|flv|webm|mkv)(\?|$)/)) {
      return 'video';
    }

    // Audio types
    if (lowerUrl.match(/\.(mp3|wav|ogg|flac|aac|m4a)(\?|$)/)) {
      return 'audio';
    }

    // Archive types
    if (lowerUrl.match(/\.(zip|rar|7z|tar|gz|bz2)(\?|$)/)) {
      return 'archive';
    }

    // Default to link
    return 'link';
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image className='w-4 h-4' />;
      case 'document':
        return <FileText className='w-4 h-4' />;
      case 'video':
        return <Video className='w-4 h-4' />;
      case 'audio':
        return <Music className='w-4 h-4' />;
      case 'archive':
        return <Archive className='w-4 h-4' />;
      default:
        return <Link className='w-4 h-4' />;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'image':
        return 'Image';
      case 'document':
        return 'Document';
      case 'video':
        return 'Video';
      case 'audio':
        return 'Audio';
      case 'archive':
        return 'Archive';
      default:
        return 'Link';
    }
  };

  if (!isOpen) return null;

  const previewType = detectAttachmentType(attachmentUrl);
  const isUrlValid = !attachmentUrl.trim() || isValidUrl(attachmentUrl.trim());
  const isEditing = !!editingAttachment;

  return (
    <div className='fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4'>
      <div className='bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm sm:max-w-lg max-h-[85vh] overflow-y-auto animate-in fade-in-50 zoom-in-95 duration-200'>
        {/* Header */}
        <div className='bg-gradient-to-r from-primary to-primary/90 px-6 py-4'>
          <div className='flex items-center justify-between text-white'>
            <div className='flex items-center gap-3'>
              <div className='w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center'>
                <Paperclip className='w-4 h-4' />
              </div>
              <div>
                <h3 className='text-lg font-semibold'>
                  {isEditing ? 'Edit Attachment' : 'Add Attachment'}
                </h3>
                <p className='text-sm text-white/80'>
                  {isEditing
                    ? 'Update the attachment details'
                    : 'Attach a link or reference to this card'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className='p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200'
              title='Close modal'
              disabled={isLoading}
            >
              <X className='w-5 h-5' />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className='p-6'>
          <form onSubmit={handleSubmit} className='space-y-6'>
            {/* Attachment URL - Now first and required */}
            <div>
              <label
                htmlFor='attachment-url'
                className='block text-sm font-medium text-foreground mb-3'
              >
                <div className='flex items-center gap-2'>
                  <Link className='w-4 h-4 text-muted-foreground' />
                  URL or Link <span className='text-red-500'>*</span>
                </div>
              </label>
              <input
                id='attachment-url'
                type='text'
                value={attachmentUrl}
                onChange={handleUrlChange}
                placeholder='https://example.com/document.pdf'
                className={`w-full bg-background border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 ${
                  urlError ? 'border-red-500' : 'border-border'
                }`}
                autoFocus
                disabled={isLoading}
              />
              {urlError && (
                <div className='flex items-center gap-2 mt-2 text-red-500'>
                  <AlertCircle className='w-4 h-4' />
                  <p className='text-xs'>{urlError}</p>
                </div>
              )}
              <p className='text-xs text-muted-foreground mt-2'>
                Enter a URL to link to files, documents, or web pages
              </p>
            </div>

            {/* Attachment Name - Now optional */}
            <div>
              <label
                htmlFor='attachment-name'
                className='block text-sm font-medium text-foreground mb-3'
              >
                <div className='flex items-center gap-2'>
                  <FileText className='w-4 h-4 text-muted-foreground' />
                  Display Name{' '}
                  <span className='text-xs text-muted-foreground'>
                    (optional)
                  </span>
                </div>
              </label>
              <input
                id='attachment-name'
                type='text'
                value={attachmentName}
                onChange={(e) => setAttachmentName(e.target.value)}
                placeholder={
                  isEditing
                    ? 'Enter a display name'
                    : 'Auto-generated from URL if left empty'
                }
                className='w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200'
                disabled={isLoading}
                maxLength={100}
              />
              <div className='flex justify-between items-center mt-2'>
                <p className='text-xs text-muted-foreground'>
                  {isEditing
                    ? 'Update the display name'
                    : 'Leave empty to auto-generate from URL'}
                </p>
                <span className='text-xs text-muted-foreground'>
                  {attachmentName.length}/100
                </span>
              </div>
            </div>

            {/* Type Preview */}
            {attachmentUrl && isUrlValid && (
              <div className='p-3 bg-muted/30 rounded-lg border border-border/50'>
                <div className='flex items-center gap-3'>
                  <div className='w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center'>
                    {getTypeIcon(previewType)}
                  </div>
                  <div>
                    <p className='text-sm font-medium text-foreground'>
                      Detected Type: {getTypeName(previewType)}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      Display name:{' '}
                      {attachmentName.trim() ||
                        generateDisplayName(attachmentUrl.trim())}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
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
                disabled={!attachmentUrl.trim() || !isUrlValid || isLoading}
                className='flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md'
              >
                {isLoading ? (
                  <>
                    <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                    {isEditing ? 'Updating...' : 'Adding...'}
                  </>
                ) : (
                  <>
                    <Paperclip className='w-4 h-4' />
                    {isEditing ? 'Update Attachment' : 'Add Attachment'}
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
