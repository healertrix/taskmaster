'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import {
  X,
  Edit3,
  Calendar,
  User,
  Tag,
  Paperclip,
  CheckSquare,
  MessageSquare,
  Archive,
  Trash2,
  Plus,
  Eye,
  Clock,
  MapPin,
  Vote,
  Copy,
  Move,
  Share2,
  MoreHorizontal,
  Bookmark,
  ExternalLink,
  Activity,
  Send,
  Edit,
  Save,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  Calendar as CalendarIcon,
  AlertCircle,
} from 'lucide-react';

interface Card {
  id: string;
  title: string;
  description?: string;
  position: number;
  created_at: string;
  updated_at: string;
  start_date?: string;
  due_date?: string;
  due_status?: 'due_soon' | 'overdue' | 'complete' | null;
  created_by: string;
  is_archived: boolean;
  is_watched: boolean;
  cover?: any;
  board_id: string;
  list_id: string;
  profiles?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
  profiles: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface ActivityData {
  id: string;
  action_type: string;
  action_data: any;
  created_at: string;
  profiles: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  comments?: {
    id: string;
    content: string;
  } | null;
}

interface CardModalProps {
  card: Card;
  isOpen: boolean;
  onClose: () => void;
  onUpdateCard?: (cardId: string, updates: Partial<Card>) => Promise<boolean>;
  onDeleteCard?: (cardId: string) => Promise<boolean>;
  onArchiveCard?: (cardId: string) => Promise<boolean>;
  listName?: string;
  boardName?: string;
}

// Avatar Components with proper error handling
const UserAvatar = ({
  profile,
  size = 32,
}: {
  profile: { full_name: string | null; avatar_url: string | null };
  size?: number;
}) => {
  const [imageError, setImageError] = useState(false);
  const sizeClass =
    size === 32 ? 'w-8 h-8' : size === 24 ? 'w-6 h-6' : 'w-10 h-10';

  if (profile.avatar_url && !imageError) {
    return (
      <Image
        src={profile.avatar_url}
        alt={profile.full_name || 'User'}
        width={size}
        height={size}
        className={`${sizeClass} rounded-full object-cover`}
        onError={() => setImageError(true)}
      />
    );
  }

  const initials =
    profile.full_name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() || 'U';
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-teal-500',
  ];
  const colorIndex = profile.full_name?.charCodeAt(0) % colors.length || 0;

  return (
    <div
      className={`${sizeClass} rounded-full ${colors[colorIndex]} flex items-center justify-center text-white text-sm font-bold shadow-sm`}
    >
      {initials}
    </div>
  );
};

const CurrentUserAvatar = ({
  user,
  size = 32,
}: {
  user: any;
  size?: number;
}) => {
  const [imageError, setImageError] = useState(false);
  const sizeClass =
    size === 32 ? 'w-8 h-8' : size === 24 ? 'w-6 h-6' : 'w-10 h-10';

  if (user?.user_metadata?.avatar_url && !imageError) {
    return (
      <Image
        src={user.user_metadata.avatar_url}
        alt={user.user_metadata?.full_name || 'You'}
        width={size}
        height={size}
        className={`${sizeClass} rounded-full object-cover`}
        onError={() => setImageError(true)}
      />
    );
  }

  const getInitials = () => {
    if (!user?.user_metadata?.full_name) return 'Y';
    return user.user_metadata.full_name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div
      className={`${sizeClass} rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold shadow-sm`}
    >
      {getInitials()}
    </div>
  );
};

export function CardModal({
  card,
  isOpen,
  onClose,
  onUpdateCard,
  onDeleteCard,
  onArchiveCard,
  listName = 'List',
  boardName = 'Board',
}: CardModalProps) {
  const { user: currentUser } = useAuth();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || '');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [shouldCloseAfterSubmit, setShouldCloseAfterSubmit] = useState(false);
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'comments' | 'activities'>(
    'comments'
  );
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null
  );
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(
    new Set()
  );
  const [showAllActivities, setShowAllActivities] = useState(false);

  // Reset form when card changes
  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description || '');
  }, [card]);

  // Global keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isEditingTitle) {
          setTitle(card.title);
          setIsEditingTitle(false);
        } else if (isEditingDescription) {
          setDescription(card.description || '');
          setIsEditingDescription(false);
        } else if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else {
          onClose();
        }
      }
      if (e.key === 'Enter' && e.ctrlKey) {
        if (isEditingTitle) {
          handleSaveTitle();
          onClose();
        } else if (isEditingDescription) {
          handleSaveDescription();
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    isEditingTitle,
    isEditingDescription,
    showDeleteConfirm,
    title,
    description,
  ]);

  // Handle save title
  const handleSaveTitle = async () => {
    if (title.trim() && title !== card.title && onUpdateCard) {
      setIsSaving(true);
      const success = await onUpdateCard(card.id, { title: title.trim() });
      if (success) {
        setIsEditingTitle(false);
      }
      setIsSaving(false);
    } else {
      setIsEditingTitle(false);
    }
  };

  // Handle save description
  const handleSaveDescription = async () => {
    if (description !== card.description && onUpdateCard) {
      setIsSaving(true);
      const success = await onUpdateCard(card.id, {
        description: description.trim() || null,
      });
      if (success) {
        setIsEditingDescription(false);
      }
      setIsSaving(false);
    } else {
      setIsEditingDescription(false);
    }
  };

  // Handle key presses
  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setTitle(card.title);
      setIsEditingTitle(false);
    }
  };

  const handleDescriptionKeyPress = (e: React.KeyboardEvent) => {
    // Escape to cancel editing
    if (e.key === 'Escape') {
      setDescription(card.description || '');
      setIsEditingDescription(false);
    }
    // Ctrl+Enter to save
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      handleSaveDescription();
    }
  };

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Fetch comments and activities when modal opens
  useEffect(() => {
    if (isOpen && card) {
      fetchComments();
      fetchActivities();
    }
  }, [isOpen, card]);

  const fetchComments = async () => {
    if (!card) return;

    setIsLoadingComments(true);
    try {
      const response = await fetch(`/api/cards/${card.id}/comments`);
      const data = await response.json();

      if (response.ok) {
        setComments(data.comments || []);
      } else {
        console.error('Failed to fetch comments:', data.error);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const fetchActivities = async () => {
    if (!card) return;

    setIsLoadingActivities(true);
    try {
      const response = await fetch(`/api/cards/${card.id}/activities`);
      const data = await response.json();

      if (response.ok) {
        setActivities(data.activities || []);
      } else {
        console.error('Failed to fetch activities:', data.error);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !card || isSubmittingComment) return;

    setIsSubmittingComment(true);

    // Close modal immediately if Ctrl+Enter was used
    if (shouldCloseAfterSubmit) {
      onClose();
      setShouldCloseAfterSubmit(false);
    }

    try {
      console.log('Submitting comment for card:', card.id);
      console.log('Comment content:', newComment.trim());

      const response = await fetch(`/api/cards/${card.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newComment.trim(),
        }),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok) {
        setComments((prev) => [...prev, data.comment]);
        setNewComment('');
        // Refresh activities to show the new comment activity
        fetchActivities();
      } else {
        console.error('Failed to create comment:', data.error);
        alert(`Failed to add comment: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating comment:', error);
      alert(
        `Failed to add comment: ${
          error instanceof Error ? error.message : 'Network error'
        }`
      );
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const formatActivityMessage = (activity: ActivityData): string => {
    const userName = activity.profiles.full_name || 'Unknown User';
    const actionData = activity.action_data || {};

    switch (activity.action_type) {
      case 'card_created':
        return `${userName} created this card`;
      case 'card_updated':
        return `${userName} updated this card`;
      case 'comment_added':
        return `${userName} commented on this card`;
      case 'comment_updated':
        return `${userName} edited a comment`;
      case 'comment_deleted':
        return `${userName} deleted a comment`;
      case 'attachment_added':
        return `${userName} added an attachment`;
      case 'card_moved':
        return `${userName} moved this card`;
      case 'card_archived':
        return `${userName} archived this card`;
      case 'label_added':
        return `${userName} added a label`;
      case 'label_removed':
        return `${userName} removed a label`;
      case 'member_added':
        return `${userName} added a member to this card`;
      case 'member_removed':
        return `${userName} removed a member from this card`;
      case 'due_date_set':
        return `${userName} set a due date`;
      case 'due_date_removed':
        return `${userName} removed the due date`;
      case 'checklist_added':
        return `${userName} added a checklist`;
      case 'checklist_completed':
        return `${userName} completed a checklist`;
      default:
        return `${userName} performed an action`;
    }
  };

  const getDetailedActivityInfo = (activity: ActivityData) => {
    const actionData = activity.action_data || {};

    switch (activity.action_type) {
      case 'card_updated':
        const changes = [];
        if (actionData.title_changed) changes.push('title');
        if (actionData.description_changed) changes.push('description');
        if (actionData.due_date_changed) changes.push('due date');
        return changes.length > 0
          ? `Updated: ${changes.join(', ')}`
          : 'Made changes to the card';

      case 'card_moved':
        return actionData.from_list && actionData.to_list
          ? `From "${actionData.from_list}" to "${actionData.to_list}"`
          : 'Moved to a different list';

      case 'label_added':
      case 'label_removed':
        return actionData.label_name ? `Label: ${actionData.label_name}` : null;

      case 'member_added':
      case 'member_removed':
        return actionData.member_name
          ? `Member: ${actionData.member_name}`
          : null;

      case 'due_date_set':
        return actionData.due_date
          ? `Due: ${formatDate(actionData.due_date)}`
          : null;

      case 'attachment_added':
        return actionData.file_name ? `File: ${actionData.file_name}` : null;

      default:
        return null;
    }
  };

  const toggleActivityExpansion = (activityId: string) => {
    const newExpanded = new Set(expandedActivities);
    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId);
    } else {
      newExpanded.add(activityId);
    }
    setExpandedActivities(newExpanded);
  };

  const getActivityTypeColor = (actionType: string) => {
    switch (actionType) {
      case 'comment_added':
      case 'comment_updated':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
      case 'comment_deleted':
        return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
      case 'card_created':
      case 'card_updated':
        return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
      case 'card_moved':
        return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
      case 'label_added':
      case 'label_removed':
        return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';
      case 'due_date_set':
      case 'due_date_removed':
        return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    );

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60)
      );
      return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  const handleEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentContent(comment.content);
  };

  const handleSaveEditComment = async (commentId: string) => {
    if (!editingCommentContent.trim()) return;

    setSavingCommentId(commentId);

    try {
      const response = await fetch(
        `/api/cards/${card?.id}/comments/${commentId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: editingCommentContent.trim(),
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === commentId ? data.comment : comment
          )
        );
        setEditingCommentId(null);
        setEditingCommentContent('');
        // Refresh activities to show the comment edit activity
        fetchActivities();
      } else {
        console.error('Failed to update comment:', data);
        const errorMessage = data.error || 'Unknown error';
        alert(`Failed to update comment: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error updating comment:', error);
      alert('Failed to update comment. Please try again.');
    } finally {
      setSavingCommentId(null);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setCommentToDelete(commentId);
    setShowDeleteModal(true);
  };

  const confirmDeleteComment = async () => {
    if (!commentToDelete) return;

    setDeletingCommentId(commentToDelete);
    setShowDeleteModal(false);

    try {
      const response = await fetch(
        `/api/cards/${card?.id}/comments/${commentToDelete}`,
        {
          method: 'DELETE',
        }
      );

      if (response.ok) {
        setComments((prev) =>
          prev.filter((comment) => comment.id !== commentToDelete)
        );
        // Refresh activities to reflect the deletion
        fetchActivities();
      } else {
        const data = await response.json();
        alert(`Failed to delete comment: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment. Please try again.');
    } finally {
      setDeletingCommentId(null);
      setCommentToDelete(null);
    }
  };

  const cancelDeleteComment = () => {
    setShowDeleteModal(false);
    setCommentToDelete(null);
  };

  const getActivityIcon = (actionType: string) => {
    switch (actionType) {
      case 'comment_added':
        return <MessageSquare className='w-4 h-4' />;
      case 'comment_updated':
        return <Edit className='w-4 h-4' />;
      case 'comment_deleted':
        return <Trash2 className='w-4 h-4' />;
      case 'card_created':
        return <Plus className='w-4 h-4' />;
      case 'card_updated':
        return <Edit3 className='w-4 h-4' />;
      case 'card_moved':
        return <Move className='w-4 h-4' />;
      case 'attachment_added':
        return <Paperclip className='w-4 h-4' />;
      case 'label_added':
      case 'label_removed':
        return <Tag className='w-4 h-4' />;
      case 'member_added':
      case 'member_removed':
        return <User className='w-4 h-4' />;
      case 'due_date_set':
      case 'due_date_removed':
        return <Calendar className='w-4 h-4' />;
      case 'checklist_added':
        return <CheckSquare className='w-4 h-4' />;
      default:
        return <Activity className='w-4 h-4' />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
      <div className='bg-card rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] border border-border overflow-hidden flex flex-col'>
        {/* Header */}
        <div className='flex items-start gap-4 p-6 border-b border-border bg-muted/30 flex-shrink-0'>
          <div className='flex-1'>
            {/* Card Title */}
            <div className='flex items-center gap-2 mb-2'>
              <Edit3 className='w-5 h-5 text-muted-foreground' />
              {isEditingTitle ? (
                <input
                  type='text'
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={handleTitleKeyPress}
                  className='flex-1 text-lg font-semibold bg-background text-foreground border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary'
                  autoFocus
                  disabled={isSaving}
                  title='Edit card title'
                />
              ) : (
                <h2
                  className='text-lg font-semibold text-foreground cursor-pointer hover:bg-muted/50 rounded-md px-3 py-2 -mx-3 -my-2 transition-colors'
                  onClick={() => setIsEditingTitle(true)}
                >
                  {card.title}
                </h2>
              )}
            </div>

            {/* Breadcrumb */}
            <p className='text-sm text-muted-foreground'>
              in list{' '}
              <span className='font-medium text-foreground'>{listName}</span> on{' '}
              <span className='font-medium text-foreground'>{boardName}</span>
            </p>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors'
            title='Close modal'
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        <div className='flex gap-6 p-6 flex-1 overflow-hidden'>
          {/* Main Content - Scrollable */}
          <div className='flex-1 space-y-6 overflow-y-auto pr-2'>
            {/* Description */}
            <div>
              <div className='flex items-center gap-2 mb-3'>
                <MessageSquare className='w-5 h-5 text-muted-foreground' />
                <h3 className='text-base font-medium text-foreground'>
                  Description
                </h3>
              </div>

              {isEditingDescription ? (
                <div className='space-y-3'>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={handleDescriptionKeyPress}
                    className='w-full min-h-[120px] bg-background text-foreground border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none'
                    placeholder='Add a more detailed description...'
                    disabled={isSaving}
                  />
                  <div className='flex gap-2'>
                    <button
                      onClick={handleSaveDescription}
                      disabled={isSaving}
                      className='px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-md transition-colors disabled:opacity-50'
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setDescription(card.description || '');
                        setIsEditingDescription(false);
                      }}
                      disabled={isSaving}
                      className='px-3 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium rounded-md transition-colors'
                    >
                      Cancel
                    </button>
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Press Ctrl+Enter to save quickly
                  </p>
                </div>
              ) : (
                <div
                  className='min-h-[80px] bg-muted/50 border border-border rounded-md px-3 py-2 cursor-pointer hover:bg-muted transition-colors'
                  onClick={() => setIsEditingDescription(true)}
                >
                  {card.description ? (
                    <p className='text-sm text-foreground whitespace-pre-wrap'>
                      {card.description}
                    </p>
                  ) : (
                    <p className='text-sm text-muted-foreground'>
                      Add a more detailed description...
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Updated Comments and Activity section */}
            <div className='mt-8'>
              {/* Improved Tab Design */}
              <div className='flex gap-1 mb-6 p-1 bg-muted rounded-lg'>
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                    activeTab === 'comments'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  }`}
                >
                  <MessageSquare className='w-4 h-4' />
                  Comments
                  <span className='bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-semibold'>
                    {comments.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('activities')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                    activeTab === 'activities'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  }`}
                >
                  <Activity className='w-4 h-4' />
                  Activity
                  <span className='bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-semibold'>
                    {activities.length}
                  </span>
                </button>
              </div>

              {activeTab === 'comments' && (
                <div className='space-y-6'>
                  {/* Enhanced Add comment form */}
                  <div className='bg-muted/30 rounded-xl p-4 border border-border/50'>
                    <div className='flex gap-3'>
                      <div className='flex-shrink-0'>
                        <CurrentUserAvatar user={currentUser} size={32} />
                      </div>
                      <div className='flex-1'>
                        <form
                          onSubmit={handleSubmitComment}
                          className='space-y-3'
                        >
                          <div className='relative'>
                            <textarea
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              onKeyDown={(e) => {
                                if (
                                  e.key === 'Enter' &&
                                  e.ctrlKey &&
                                  newComment.trim() &&
                                  !isSubmittingComment
                                ) {
                                  e.preventDefault();
                                  setShouldCloseAfterSubmit(true);
                                  handleSubmitComment(e);
                                }
                              }}
                              placeholder='Write a comment...'
                              className='w-full p-3 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-sm bg-background placeholder-muted-foreground min-h-[80px]'
                              disabled={isSubmittingComment}
                            />
                            {newComment.trim() && (
                              <div className='absolute bottom-3 right-3 text-xs text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded'>
                                {newComment.length}/1000
                              </div>
                            )}
                          </div>
                          <div className='flex justify-between items-center'>
                            <div className='text-xs text-muted-foreground'>
                              Press{' '}
                              <kbd className='px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono border'>
                                Ctrl
                              </kbd>{' '}
                              +{' '}
                              <kbd className='px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono border'>
                                Enter
                              </kbd>{' '}
                              to submit
                            </div>
                            <div className='flex gap-2'>
                              {newComment.trim() && (
                                <button
                                  type='button'
                                  onClick={() => setNewComment('')}
                                  className='px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors'
                                >
                                  Cancel
                                </button>
                              )}
                              <button
                                type='submit'
                                disabled={
                                  !newComment.trim() || isSubmittingComment
                                }
                                className='flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow disabled:hover:shadow-sm'
                              >
                                {isSubmittingComment ? (
                                  <>
                                    <div className='w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin' />
                                    Posting...
                                  </>
                                ) : (
                                  <>
                                    <Send className='w-3 h-3' />
                                    Comment
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Comments list */}
                  {isLoadingComments ? (
                    <div className='flex justify-center py-8'>
                      <div className='w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin' />
                    </div>
                  ) : comments.length > 0 ? (
                    <div className='space-y-4'>
                      {comments.map((comment) => (
                        <div key={comment.id} className='group'>
                          <div className='flex gap-3'>
                            <div className='flex-shrink-0'>
                              <UserAvatar
                                profile={comment.profiles}
                                size={32}
                              />
                            </div>
                            <div className='flex-1 min-w-0'>
                              <div className='bg-background rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow duration-200'>
                                <div className='p-4'>
                                  <div className='flex justify-between items-start mb-2'>
                                    <div className='flex items-center gap-2'>
                                      <span className='font-medium text-sm text-foreground'>
                                        {comment.profiles.full_name ||
                                          'Unknown User'}
                                      </span>
                                      <span className='text-xs text-muted-foreground'>
                                        {formatTimestamp(comment.created_at)}
                                        {comment.is_edited && ' (edited)'}
                                      </span>
                                    </div>

                                    {/* Comment Actions */}
                                    <div className='opacity-0 group-hover:opacity-100 transition-opacity duration-200'>
                                      <div className='flex items-center gap-1'>
                                        <button
                                          onClick={() =>
                                            handleDeleteComment(comment.id)
                                          }
                                          disabled={
                                            deletingCommentId === comment.id
                                          }
                                          className='p-1 text-muted-foreground hover:text-red-500 transition-colors rounded disabled:opacity-50'
                                          title='Delete comment'
                                        >
                                          {deletingCommentId === comment.id ? (
                                            <div className='w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin' />
                                          ) : (
                                            <Trash2 className='w-3 h-3' />
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Comment Content */}
                                  {editingCommentId === comment.id ? (
                                    <div className='space-y-3'>
                                      <div className='relative'>
                                        <textarea
                                          value={editingCommentContent}
                                          onChange={(e) =>
                                            setEditingCommentContent(
                                              e.target.value
                                            )
                                          }
                                          onKeyDown={(e) => {
                                            if (
                                              e.key === 'Enter' &&
                                              e.ctrlKey &&
                                              editingCommentContent.trim()
                                            ) {
                                              e.preventDefault();
                                              handleSaveEditComment(comment.id);
                                            }
                                            if (e.key === 'Escape') {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setEditingCommentId(null);
                                              setEditingCommentContent('');
                                            }
                                          }}
                                          className='w-full p-3 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-sm bg-background placeholder-muted-foreground min-h-[80px]'
                                          placeholder='Edit your comment...'
                                          aria-label='Edit comment'
                                          autoFocus
                                        />
                                        {editingCommentContent.trim() && (
                                          <div className='absolute bottom-3 right-3 text-xs text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded'>
                                            {editingCommentContent.length}/1000
                                          </div>
                                        )}
                                      </div>
                                      <div className='flex justify-between items-center'>
                                        <div className='text-xs text-muted-foreground'>
                                          Press{' '}
                                          <kbd className='px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono border'>
                                            Ctrl
                                          </kbd>{' '}
                                          +{' '}
                                          <kbd className='px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono border'>
                                            Enter
                                          </kbd>{' '}
                                          to save or{' '}
                                          <kbd className='px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono border'>
                                            Esc
                                          </kbd>{' '}
                                          to cancel
                                        </div>
                                        <div className='flex gap-2'>
                                          <button
                                            onClick={() => {
                                              setEditingCommentId(null);
                                              setEditingCommentContent('');
                                            }}
                                            className='px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors'
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            onClick={() =>
                                              handleSaveEditComment(comment.id)
                                            }
                                            disabled={
                                              !editingCommentContent.trim() ||
                                              savingCommentId === comment.id
                                            }
                                            className='flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow disabled:hover:shadow-sm'
                                          >
                                            {savingCommentId === comment.id ? (
                                              <>
                                                <div className='w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin' />
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
                                    <p
                                      className='text-sm text-foreground whitespace-pre-wrap leading-relaxed cursor-pointer hover:bg-muted/40 rounded p-1 -m-1 transition-colors'
                                      onClick={() => handleEditComment(comment)}
                                      title='Click to edit'
                                    >
                                      {comment.content}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className='text-center py-12'>
                      <div className='w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4'>
                        <MessageSquare className='w-8 h-8 text-muted-foreground' />
                      </div>
                      <h3 className='font-medium text-foreground mb-1'>
                        No comments yet
                      </h3>
                      <p className='text-sm text-muted-foreground'>
                        Be the first to add a comment!
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'activities' && (
                <div className='space-y-4'>
                  {isLoadingActivities ? (
                    <div className='flex justify-center py-8'>
                      <div className='w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin' />
                    </div>
                  ) : activities.length > 0 ? (
                    <div className='space-y-1'>
                      {/* Activity Summary */}
                      <div className='flex items-center justify-between mb-4 p-3 bg-muted/30 rounded-lg border border-border/50'>
                        <div className='flex items-center gap-2'>
                          <div className='w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center'>
                            <Activity className='w-4 h-4 text-primary' />
                          </div>
                          <div>
                            <h4 className='text-sm font-medium text-foreground'>
                              {activities.length}{' '}
                              {activities.length === 1
                                ? 'activity'
                                : 'activities'}
                            </h4>
                            <p className='text-xs text-muted-foreground'>
                              Latest:{' '}
                              {activities[0] &&
                                formatTimestamp(activities[0].created_at)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            setShowAllActivities(!showAllActivities)
                          }
                          className='text-xs text-primary hover:text-primary/80 transition-colors'
                        >
                          {showAllActivities ? 'Show less' : 'Show all'}
                        </button>
                      </div>

                      {/* Timeline */}
                      <div className='relative'>
                        {/* Timeline line */}
                        <div className='absolute left-6 top-0 bottom-0 w-px bg-border' />

                        <div className='space-y-4'>
                          {(showAllActivities
                            ? activities
                            : activities.slice(0, 5)
                          ).map((activity, index) => {
                            const isExpanded = expandedActivities.has(
                              activity.id
                            );
                            const detailedInfo =
                              getDetailedActivityInfo(activity);
                            const hasDetails =
                              detailedInfo || activity.comments;

                            return (
                              <div
                                key={activity.id}
                                className='relative flex gap-4 group'
                              >
                                {/* Timeline dot */}
                                <div className='relative z-10 flex-shrink-0'>
                                  <div className='w-12 h-12 rounded-full border-2 border-background bg-card shadow-sm flex items-center justify-center'>
                                    <UserAvatar
                                      profile={activity.profiles}
                                      size={24}
                                    />
                                  </div>
                                  <div
                                    className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-background flex items-center justify-center ${getActivityTypeColor(
                                      activity.action_type
                                    )}`}
                                  >
                                    {getActivityIcon(activity.action_type)}
                                  </div>
                                </div>

                                {/* Content */}
                                <div className='flex-1 min-w-0 pb-4'>
                                  <div className='bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-200'>
                                    <div
                                      className={`p-4 ${
                                        hasDetails ? 'cursor-pointer' : ''
                                      }`}
                                      onClick={() =>
                                        hasDetails &&
                                        toggleActivityExpansion(activity.id)
                                      }
                                    >
                                      <div className='flex items-start justify-between'>
                                        <div className='flex-1'>
                                          <div className='flex items-center gap-2 mb-1'>
                                            <p className='text-sm font-medium text-foreground'>
                                              {formatActivityMessage(activity)}
                                            </p>
                                            {hasDetails && (
                                              <button className='text-muted-foreground hover:text-foreground transition-colors'>
                                                {isExpanded ? (
                                                  <ChevronDown className='w-4 h-4' />
                                                ) : (
                                                  <ChevronRight className='w-4 h-4' />
                                                )}
                                              </button>
                                            )}
                                          </div>

                                          {/* Quick preview of details */}
                                          {!isExpanded && detailedInfo && (
                                            <p className='text-xs text-muted-foreground truncate'>
                                              {detailedInfo}
                                            </p>
                                          )}
                                        </div>

                                        <div className='flex items-center gap-2 ml-2'>
                                          <span className='text-xs text-muted-foreground whitespace-nowrap'>
                                            {formatTimestamp(
                                              activity.created_at
                                            )}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Expanded details */}
                                      {isExpanded && (
                                        <div className='mt-3 pt-3 border-t border-border/50 space-y-2'>
                                          {detailedInfo && (
                                            <div className='flex items-center gap-2 p-2 bg-muted/30 rounded-md'>
                                              <AlertCircle className='w-4 h-4 text-muted-foreground flex-shrink-0' />
                                              <span className='text-sm text-foreground'>
                                                {detailedInfo}
                                              </span>
                                            </div>
                                          )}

                                          {activity.comments && (
                                            <div className='p-3 bg-muted/20 rounded-md border border-border/30'>
                                              <div className='flex items-center gap-2 mb-2'>
                                                <MessageSquare className='w-4 h-4 text-muted-foreground' />
                                                <span className='text-xs font-medium text-muted-foreground'>
                                                  Comment
                                                </span>
                                              </div>
                                              <p className='text-sm text-foreground italic'>
                                                "{activity.comments.content}"
                                              </p>
                                            </div>
                                          )}

                                          <div className='flex items-center gap-4 text-xs text-muted-foreground pt-2'>
                                            <div className='flex items-center gap-1'>
                                              <CalendarIcon className='w-3 h-3' />
                                              {formatDate(activity.created_at)}
                                            </div>
                                            <div className='flex items-center gap-1'>
                                              <User className='w-3 h-3' />
                                              {activity.profiles.full_name ||
                                                'Unknown User'}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Show more activities button */}
                        {!showAllActivities && activities.length > 5 && (
                          <div className='relative flex gap-4 mt-4'>
                            <div className='w-12 flex-shrink-0' />
                            <button
                              onClick={() => setShowAllActivities(true)}
                              className='flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors'
                            >
                              <ChevronDown className='w-4 h-4' />
                              Show {activities.length - 5} more activities
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className='text-center py-12'>
                      <div className='w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4'>
                        <Activity className='w-8 h-8 text-muted-foreground' />
                      </div>
                      <h3 className='font-medium text-foreground mb-1'>
                        No activity yet
                      </h3>
                      <p className='text-sm text-muted-foreground'>
                        Activity will appear here as actions are taken on this
                        card.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className='w-64 space-y-6 flex-shrink-0 overflow-y-auto max-h-[70vh] pr-1'>
            {/* Add to card */}
            <div>
              <h4 className='text-sm font-medium text-foreground mb-3'>
                Add to card
              </h4>
              <div className='space-y-2'>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <User className='w-4 h-4' />
                  Members
                </button>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <Tag className='w-4 h-4' />
                  Labels
                </button>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <CheckSquare className='w-4 h-4' />
                  Checklist
                </button>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <Calendar className='w-4 h-4' />
                  Dates
                </button>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <Paperclip className='w-4 h-4' />
                  Attachment
                </button>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <MapPin className='w-4 h-4' />
                  Location
                </button>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <Vote className='w-4 h-4' />
                  Voting
                </button>
              </div>
            </div>

            <div className='border-t border-border my-2'></div>

            {/* Actions */}
            <div>
              <h4 className='text-sm font-medium text-foreground mb-3'>
                Actions
              </h4>
              <div className='space-y-2'>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <Move className='w-4 h-4' />
                  Move
                </button>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <Copy className='w-4 h-4' />
                  Copy
                </button>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <Share2 className='w-4 h-4' />
                  Share
                </button>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <Eye className='w-4 h-4' />
                  Watch
                </button>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <MoreHorizontal className='w-4 h-4' />
                  More actions
                </button>
                {(onArchiveCard || onDeleteCard) && (
                  <div className='border-t border-border my-2'></div>
                )}
                {onArchiveCard && (
                  <button
                    onClick={() => onArchiveCard(card.id)}
                    className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'
                  >
                    <Archive className='w-4 h-4' />
                    Archive
                  </button>
                )}
                {onDeleteCard && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className='w-full flex items-center gap-3 px-3 py-2.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm rounded-md transition-colors'
                  >
                    <Trash2 className='w-4 h-4' />
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Due Date (if exists) */}
            {card.due_date && (
              <div>
                <h4 className='text-sm font-medium text-foreground mb-3'>
                  Due Date
                </h4>
                <div
                  className={`px-3 py-2 rounded-md text-sm ${
                    card.due_status === 'complete'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : card.due_status === 'overdue'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}
                >
                  <div className='flex items-center gap-2'>
                    <Clock className='w-4 h-4' />
                    {formatDate(card.due_date)}
                  </div>
                  {card.due_status && (
                    <div className='text-xs mt-1 capitalize'>
                      {card.due_status.replace('_', ' ')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Created info */}
            <div className='text-xs text-muted-foreground space-y-1 pt-4 border-t border-border'>
              <div>Created {formatDate(card.created_at)}</div>
              <div>Updated {formatDate(card.updated_at)}</div>
            </div>
          </div>
        </div>
        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className='fixed inset-0 bg-black/60 z-50 flex items-center justify-center'>
            <div className='bg-card rounded-lg shadow-xl p-6 w-full max-w-sm border border-border flex flex-col items-center'>
              <Trash2 className='w-10 h-10 text-destructive mb-4' />
              <h3 className='text-lg font-semibold mb-2 text-center'>
                Delete this card?
              </h3>
              <p className='text-sm text-muted-foreground mb-4 text-center'>
                This action cannot be undone. Are you sure you want to delete
                this card?
              </p>
              <div className='flex gap-3 mt-2'>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    onDeleteCard && onDeleteCard(card.id);
                  }}
                  className='px-4 py-2 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors text-sm font-medium'
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Comment Confirmation Modal */}
        {showDeleteModal && (
          <div className='fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4'>
            <div className='bg-card rounded-xl shadow-2xl border border-border max-w-md w-full'>
              <div className='p-6'>
                <div className='flex items-center gap-3 mb-4'>
                  <div className='w-10 h-10 bg-red-100 rounded-full flex items-center justify-center'>
                    <Trash2 className='w-5 h-5 text-red-600' />
                  </div>
                  <div>
                    <h3 className='text-lg font-semibold text-foreground'>
                      Delete Comment
                    </h3>
                    <p className='text-sm text-muted-foreground'>
                      This action cannot be undone
                    </p>
                  </div>
                </div>

                <p className='text-sm text-foreground mb-6'>
                  Are you sure you want to delete this comment? This will
                  permanently remove the comment from the card.
                </p>

                <div className='flex gap-3 justify-end'>
                  <button
                    onClick={cancelDeleteComment}
                    className='px-4 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-md transition-colors'
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteComment}
                    disabled={deletingCommentId !== null}
                    className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors'
                  >
                    {deletingCommentId ? (
                      <>
                        <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className='w-4 h-4' />
                        Delete Comment
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
