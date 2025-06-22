'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import {
  X,
  Edit3,
  Edit2,
  Calendar,
  User,
  Tag,
  Paperclip,
  CheckSquare,
  MessageSquare,
  Trash2,
  Plus,
  Eye,
  Clock,
  Move,
  Activity,
  Send,
  Edit,
  Save,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Calendar as CalendarIcon,
  AlertCircle,
  Search,
  SortAsc,
  SortDesc,
  Filter,
  Settings,
  Check,
  Video,
  Music,
  Link as LinkIcon,
  Play,
  Flag,
  Timer,
  Target,
  List,
  Hash,
  MapPin,
  FileText,
  CheckCircle2,
  LayoutGrid,
} from 'lucide-react';
import { DateTimeRangePicker } from '@/components/ui/DateTimeRangePicker';
import { Checklist } from '@/components/ui/Checklist';
import { AddChecklistModal } from '@/components/ui/AddChecklistModal';
import { AttachmentModal } from './AttachmentModal';
import LabelModal from './LabelModal';
import CardLabels from './CardLabels';
import { CardMemberPicker } from './CardMemberPicker';
import {
  combineDateAndTime,
  extractDate,
  extractTime,
  formatDateTime,
  getRelativeDateTime,
  isOverdue,
  isDueSoon,
} from '@/utils/dateTime';

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
  attachments?: number;
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

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

interface AttachmentData {
  id: string;
  name: string;
  url: string;
  type: string;
  created_at: string;
  created_by: string;
  profiles?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

interface ChecklistData {
  id: string;
  name: string;
  items: ChecklistItem[];
  created_at: string;
  updated_at: string;
}

interface CardMemberData {
  id: string;
  created_at: string;
  profiles: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string;
  };
}

interface CardModalProps {
  card: Card;
  isOpen: boolean;
  onClose: () => void;
  onUpdateCard?: (cardId: string, updates: Partial<Card>) => Promise<boolean>;
  onDeleteCard?: (cardId: string) => Promise<boolean>;
  onArchiveCard?: (cardId: string) => Promise<boolean>;
  onLabelsUpdated?: (labelId?: string, labelData?: any) => void;
  onMembersUpdated?: (memberId?: string, memberData?: any) => void;
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

export function CardModal({
  card,
  isOpen,
  onClose,
  onUpdateCard,
  onDeleteCard,
  onArchiveCard,
  onLabelsUpdated,
  onMembersUpdated,
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
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [shouldCloseAfterSubmit, setShouldCloseAfterSubmit] = useState(false);
  const [editingSavingCommentId, setEditingSavingCommentId] = useState<
    string | null
  >(null);
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

  // Comment filtering and search states
  const [commentSortOrder, setCommentSortOrder] = useState<'newest' | 'oldest'>(
    'newest'
  );
  const [commentSearchQuery, setCommentSearchQuery] = useState('');
  const [showCommentFilters, setShowCommentFilters] = useState(false);

  // Actions dropdown state
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const [isAddToCardDropdownOpen, setIsAddToCardDropdownOpen] = useState(false);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerInitialSelection, setDatePickerInitialSelection] = useState<
    'start' | 'due'
  >('due');
  const [selectedStartDate, setSelectedStartDate] = useState(
    extractDate(card.start_date)
  );
  const [selectedDueDate, setSelectedDueDate] = useState(
    extractDate(card.due_date)
  );
  const [selectedStartTime, setSelectedStartTime] = useState(
    extractTime(card.start_date)
  );
  const [selectedDueTime, setSelectedDueTime] = useState(
    extractTime(card.due_date)
  );
  const [isSavingDates, setIsSavingDates] = useState(false);

  // Checklist state
  const [checklists, setChecklists] = useState<ChecklistData[]>([]);
  const [isLoadingChecklists, setIsLoadingChecklists] = useState(false);
  const [showAddChecklistModal, setShowAddChecklistModal] = useState(false);
  const [isAddingChecklist, setIsAddingChecklist] = useState(false);
  const [isAddingChecklistItem, setIsAddingChecklistItem] = useState(false);
  const [isUpdatingChecklistItem, setIsUpdatingChecklistItem] = useState(false);
  const [isDeletingChecklistItem, setIsDeletingChecklistItem] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [labelsRefreshKey, setLabelsRefreshKey] = useState(0);

  // Attachment state
  const [attachments, setAttachments] = useState<AttachmentData[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [isAddingAttachment, setIsAddingAttachment] = useState(false);
  const [editingAttachment, setEditingAttachment] =
    useState<AttachmentData | null>(null);
  const [showDeleteAttachmentModal, setShowDeleteAttachmentModal] =
    useState(false);
  const [attachmentToDelete, setAttachmentToDelete] =
    useState<AttachmentData | null>(null);
  const [isDeletingAttachment, setIsDeletingAttachment] = useState(false);

  // Member state
  const [cardMembers, setCardMembers] = useState<CardMemberData[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [showDetailedMembers, setShowDetailedMembers] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [showMemberSearch, setShowMemberSearch] = useState(false);

  // Save warning modal state
  const [showSaveWarningModal, setShowSaveWarningModal] = useState(false);

  // Move card modal state
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [isMovingCard, setIsMovingCard] = useState(false);
  const [availableLists, setAvailableLists] = useState<
    Array<{ id: string; name: string; cards_count: number }>
  >([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isListDropdownOpen, setIsListDropdownOpen] = useState(false);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);

  // Check if there are any active save operations
  const hasActiveSaveOperations = () => {
    return (
      isSaving || // Title/description saving
      isSubmittingComment || // Comment being submitted
      editingSavingCommentId !== null || // Comment being edited/saved
      deletingCommentId !== null || // Comment being deleted
      isSavingDates || // Dates being saved
      isAddingChecklist || // Checklist being added
      isAddingChecklistItem || // Checklist item being added
      isUpdatingChecklistItem || // Checklist item being updated
      isDeletingChecklistItem || // Checklist item being deleted
      isAddingAttachment || // Attachment being added
      isDeletingAttachment || // Attachment being deleted
      isSavingMember // Member being added/removed
    );
  };

  // Handle modal close with save operation check
  const handleModalClose = () => {
    if (hasActiveSaveOperations()) {
      // Show custom warning modal
      setShowSaveWarningModal(true);
    } else {
      onClose();
    }
  };

  // Handle force close from warning modal
  const handleForceClose = () => {
    setShowSaveWarningModal(false);
    onClose();
  };

  // Handle cancel from warning modal
  const handleCancelClose = () => {
    setShowSaveWarningModal(false);
  };

  // Reset form when card changes
  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description || '');
    // Reset date states when card changes
    setSelectedStartDate(extractDate(card.start_date));
    setSelectedDueDate(extractDate(card.due_date));
    setSelectedStartTime(extractTime(card.start_date));
    setSelectedDueTime(extractTime(card.due_date));
  }, [card]);

  // Global keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showAddChecklistModal) {
          setShowAddChecklistModal(false);
        } else if (showAttachmentModal) {
          setShowAttachmentModal(false);
        } else if (isEditingTitle) {
          setTitle(card.title);
          setIsEditingTitle(false);
        } else if (isEditingDescription) {
          setDescription(card.description || '');
          setIsEditingDescription(false);
        } else if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else if (showDeleteModal) {
          e.stopPropagation();
          cancelDeleteComment();
        } else if (showDeleteAttachmentModal) {
          e.stopPropagation();
          cancelDeleteAttachment();
        } else if (showSaveWarningModal) {
          e.stopPropagation();
          handleCancelClose();
        } else if (showMoveModal) {
          if (isListDropdownOpen) {
            setIsListDropdownOpen(false);
          } else {
            setShowMoveModal(false);
          }
        } else {
          handleModalClose();
        }
      }
      if (e.key === 'Enter' && e.ctrlKey) {
        if (isEditingTitle) {
          handleSaveTitle();
          // Don't auto-close if there are other save operations
          if (!hasActiveSaveOperations()) {
            onClose();
          }
        } else if (isEditingDescription) {
          handleSaveDescription();
          // Don't auto-close if there are other save operations
          if (!hasActiveSaveOperations()) {
            onClose();
          }
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
    showDeleteModal,
    showDeleteAttachmentModal,
    showAddChecklistModal,
    showAttachmentModal,
    showSaveWarningModal,
    showMoveModal,
    isListDropdownOpen,
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
    return getRelativeDateTime(dateString);
  };

  // Helper function to generate timeline details
  const generateTimelineDetails = (actionData: any) => {
    if (!actionData.changes) return actionData.summary || null;

    const details = [];
    const changes = actionData.changes;

    // Format a date for display (using proper date format instead of relative)
    const formatDateForTimeline = (dateString?: string) => {
      if (!dateString) return null;
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year:
          date.getFullYear() !== new Date().getFullYear()
            ? 'numeric'
            : undefined,
      });
    };

    if (changes.start_date) {
      const { old: oldStart, new: newStart } = changes.start_date;
      if (!oldStart && newStart) {
        details.push(`✓ Start date set to ${formatDateForTimeline(newStart)}`);
      } else if (oldStart && !newStart) {
        details.push(
          `✗ Start date removed (was ${formatDateForTimeline(oldStart)})`
        );
      } else if (oldStart !== newStart) {
        details.push(
          `⟳ Start date: ${formatDateForTimeline(
            oldStart
          )} → ${formatDateForTimeline(newStart)}`
        );
      }
    }

    if (changes.due_date) {
      const { old: oldDue, new: newDue } = changes.due_date;
      if (!oldDue && newDue) {
        details.push(`✓ Due date set to ${formatDateForTimeline(newDue)}`);
      } else if (oldDue && !newDue) {
        details.push(
          `✗ Due date removed (was ${formatDateForTimeline(oldDue)})`
        );
      } else if (oldDue !== newDue) {
        details.push(
          `⟳ Due date: ${formatDateForTimeline(
            oldDue
          )} → ${formatDateForTimeline(newDue)}`
        );
      }
    }

    return details.length > 0 ? details.join('\n') : null;
  };

  // Fetch comments, activities, checklists, attachments, and members only when modal first opens
  useEffect(() => {
    if (isOpen && card) {
      fetchComments();
      fetchActivities();
      fetchChecklists();
      fetchAttachments();
      fetchCardMembers();
      fetchWorkspaceId();
    }
  }, [isOpen, card.id]); // Only depend on card.id, not the entire card object

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

        // Update card's updated_at timestamp to latest activity time
        if (data.activities && data.activities.length > 0 && onUpdateCard) {
          const latestActivity = data.activities[0]; // Activities are sorted by created_at DESC
          await onUpdateCard(card.id, {
            updated_at: latestActivity.created_at,
          });
        }
      } else {
        console.error('Failed to fetch activities:', data.error);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const fetchChecklists = async () => {
    if (!card) return;

    setIsLoadingChecklists(true);
    try {
      const response = await fetch(`/api/cards/${card.id}/checklists`);
      const data = await response.json();

      if (response.ok) {
        setChecklists(data.checklists || []);
      } else {
        console.error('Failed to fetch checklists:', data.error);
      }
    } catch (error) {
      console.error('Error fetching checklists:', error);
    } finally {
      setIsLoadingChecklists(false);
    }
  };

  const fetchAttachments = async () => {
    if (!card) return;

    setIsLoadingAttachments(true);
    try {
      const response = await fetch(`/api/cards/${card.id}/attachments`);
      const data = await response.json();

      if (response.ok) {
        setAttachments(data.attachments || []);
      } else {
        console.error('Failed to fetch attachments:', data.error);
      }
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setIsLoadingAttachments(false);
    }
  };

  const fetchCardMembers = async () => {
    if (!card) return;

    setIsLoadingMembers(true);
    try {
      const response = await fetch(`/api/cards/${card.id}/members`);
      const data = await response.json();

      if (response.ok) {
        setCardMembers(data.members || []);
      } else {
        console.error('Failed to fetch card members:', data.error);
      }
    } catch (error) {
      console.error('Error fetching card members:', error);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const fetchWorkspaceId = async () => {
    if (!card) return;

    try {
      const response = await fetch(`/api/boards/${card.board_id}`);
      const data = await response.json();

      if (response.ok && data.board) {
        setWorkspaceId(data.board.workspace_id);
      } else {
        console.error('Failed to fetch board info:', data.error);
      }
    } catch (error) {
      console.error('Error fetching board info:', error);
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
      const response = await fetch(`/api/cards/${card.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newComment.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setComments((prev) => [data.comment, ...prev]);
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
      case 'attachment_removed':
        return `${userName} removed an attachment`;
      case 'attachment_updated':
        return `${userName} updated an attachment`;
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
      case 'timeline_updated':
        return `${userName} updated the timeline`;
      case 'due_date_set':
        return `${userName} set a due date`;
      case 'due_date_removed':
        return `${userName} removed the due date`;
      case 'start_date_set':
        return `${userName} set a start date`;
      case 'start_date_removed':
        return `${userName} removed the start date`;
      case 'checklist_added':
        return `${userName} added a checklist`;
      case 'checklist_updated':
        return `${userName} updated a checklist`;
      case 'checklist_removed':
        return `${userName} removed a checklist`;
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
        return actionData.label_name && actionData.label_name.trim()
          ? `Label: ${actionData.label_name}`
          : 'Color label (no name)';

      case 'member_added':
      case 'member_removed':
        return actionData.member_name
          ? `Member: ${actionData.member_name}`
          : null;

      case 'timeline_updated':
        return generateTimelineDetails(actionData);

      case 'due_date_set':
        return actionData.due_date
          ? `Due: ${formatDate(actionData.due_date)}`
          : null;

      case 'start_date_set':
        return actionData.start_date
          ? `Start: ${formatDate(actionData.start_date)}`
          : null;

      case 'attachment_added':
        return actionData.attachment_name
          ? `Link: ${actionData.attachment_name}`
          : null;

      case 'attachment_removed':
        return actionData.attachment_name
          ? `Link: ${actionData.attachment_name}`
          : null;

      case 'attachment_updated':
        return actionData.attachment_name
          ? `Link: ${actionData.attachment_name}${
              actionData.old_name &&
              actionData.old_name !== actionData.attachment_name
                ? ` (was: ${actionData.old_name})`
                : ''
            }`
          : null;

      case 'checklist_added':
      case 'checklist_removed':
        return actionData.checklist_title
          ? `Checklist: ${actionData.checklist_title}`
          : null;

      case 'checklist_updated':
        return actionData.checklist_title
          ? `Checklist: ${actionData.checklist_title}${
              actionData.old_title &&
              actionData.old_title !== actionData.checklist_title
                ? ` (was: ${actionData.old_title})`
                : ''
            }`
          : null;

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
      case 'attachment_added':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
      case 'attachment_removed':
        return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
      case 'attachment_updated':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
      case 'label_added':
      case 'label_removed':
        return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';
      case 'timeline_updated':
        return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'due_date_set':
      case 'due_date_removed':
        return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
      case 'start_date_set':
      case 'start_date_removed':
        return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
      case 'checklist_added':
      case 'checklist_updated':
      case 'checklist_removed':
        return 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400';
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

    setEditingSavingCommentId(commentId);

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
      setEditingSavingCommentId(null);
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

  // Comment filtering and search logic
  const filteredAndSortedComments = React.useMemo(() => {
    let filtered = comments;

    // Filter by search query
    if (commentSearchQuery.trim()) {
      const query = commentSearchQuery.toLowerCase();
      filtered = comments.filter(
        (comment) =>
          comment.content.toLowerCase().includes(query) ||
          comment.profiles.full_name?.toLowerCase().includes(query)
      );
    }

    // Sort comments
    const sorted = [...filtered].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();

      if (commentSortOrder === 'newest') {
        return dateB - dateA; // Newest first
      } else {
        return dateA - dateB; // Oldest first
      }
    });

    return sorted;
  }, [comments, commentSearchQuery, commentSortOrder]);

  const handleCommentSearch = (query: string) => {
    setCommentSearchQuery(query);
  };

  const toggleCommentSort = () => {
    setCommentSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'));
  };

  const clearCommentFilters = () => {
    setCommentSearchQuery('');
    setCommentSortOrder('newest');
  };

  // Filter members based on search query
  const filteredCardMembers = React.useMemo(() => {
    if (!memberSearchQuery.trim()) return cardMembers;

    const query = memberSearchQuery.toLowerCase();
    return cardMembers.filter((member) => {
      const name = (member.profiles.full_name || '').toLowerCase();
      const email = (member.profiles.email || '').toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [cardMembers, memberSearchQuery]);

  // Date handling functions
  const handleSaveDates = (dates: {
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
  }) => {
    if (!onUpdateCard) return;

    setIsSavingDates(true);

    const startDateTime = combineDateAndTime(dates.startDate, dates.startTime);
    const endDateTime = combineDateAndTime(dates.endDate, dates.endTime);

    const updates = {
      start_date: startDateTime || null,
      due_date: endDateTime || null,
    };

    onUpdateCard(card.id, updates)
      .then((success) => {
        if (success) {
          setShowDatePicker(false);
          setIsAddToCardDropdownOpen(false);
          // Refresh activities to show the date change activity
          fetchActivities();
          // Local state will be updated by useEffect when card prop changes
        } else {
          alert('Failed to update dates. Please try again.');
        }
      })
      .catch((error) => {
        console.error('Error updating dates:', error);
        alert('Failed to update dates. Please try again.');
      })
      .finally(() => {
        setIsSavingDates(false);
      });
  };

  const handleClearDates = () => {
    handleSaveDates({
      startDate: undefined,
      endDate: undefined,
      startTime: undefined,
      endTime: undefined,
    });
  };

  // Helper functions to open date picker with context
  const openDatePickerForStart = () => {
    setDatePickerInitialSelection('start');
    setShowDatePicker(true);
  };

  const openDatePickerForDue = () => {
    setDatePickerInitialSelection('due');
    setShowDatePicker(true);
  };

  // Checklist handlers
  const handleAddChecklist = async (
    name: string,
    templateItems?: string[]
  ): Promise<boolean> => {
    if (!card) return false;

    setIsAddingChecklist(true);
    try {
      const response = await fetch(`/api/cards/${card.id}/checklists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, templateItems }),
      });

      const data = await response.json();

      if (response.ok) {
        setChecklists((prev) => [...prev, data.checklist]);
        // Refresh activities to show the new checklist activity
        fetchActivities();
        return true;
      } else {
        console.error('Failed to add checklist:', data.error);
        return false;
      }
    } catch (error) {
      console.error('Error adding checklist:', error);
      return false;
    } finally {
      setIsAddingChecklist(false);
    }
  };

  const handleUpdateChecklist = async (
    checklistId: string,
    updates: Partial<ChecklistData>
  ): Promise<boolean> => {
    if (!card) return false;

    try {
      const response = await fetch(
        `/api/cards/${card.id}/checklists/${checklistId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: updates.name }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setChecklists((prev) =>
          prev.map((checklist) =>
            checklist.id === checklistId
              ? { ...checklist, ...updates }
              : checklist
          )
        );
        // Refresh activities to show the checklist update activity
        fetchActivities();
        return true;
      } else {
        console.error('Failed to update checklist:', data.error);
        return false;
      }
    } catch (error) {
      console.error('Error updating checklist:', error);
      return false;
    }
  };

  const handleDeleteChecklist = async (
    checklistId: string
  ): Promise<boolean> => {
    if (!card) return false;

    try {
      const response = await fetch(
        `/api/cards/${card.id}/checklists/${checklistId}`,
        {
          method: 'DELETE',
        }
      );

      if (response.ok) {
        setChecklists((prev) =>
          prev.filter((checklist) => checklist.id !== checklistId)
        );
        // Refresh activities to show the checklist deletion activity
        fetchActivities();
        return true;
      } else {
        const data = await response.json();
        console.error('Failed to delete checklist:', data.error);
        return false;
      }
    } catch (error) {
      console.error('Error deleting checklist:', error);
      return false;
    }
  };

  const handleAddChecklistItem = async (
    checklistId: string,
    text: string
  ): Promise<boolean> => {
    if (!card) return false;

    setIsAddingChecklistItem(true);

    // Create temporary item for optimistic update with a "saving" indicator
    const tempItem: ChecklistItem = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: text,
      completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistic update - add item immediately
    setChecklists((prev) =>
      prev.map((checklist) =>
        checklist.id === checklistId
          ? { ...checklist, items: [...checklist.items, tempItem] }
          : checklist
      )
    );

    try {
      const response = await fetch(
        `/api/cards/${card.id}/checklists/${checklistId}/items`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        // Replace temp item with real item from server
        setChecklists((prev) =>
          prev.map((checklist) =>
            checklist.id === checklistId
              ? {
                  ...checklist,
                  items: checklist.items.map((item) =>
                    item.id === tempItem.id ? data.item : item
                  ),
                }
              : checklist
          )
        );
        return true;
      } else {
        console.error('Failed to add checklist item:', data.error);
        // Remove temp item on error
        setChecklists((prev) =>
          prev.map((checklist) =>
            checklist.id === checklistId
              ? {
                  ...checklist,
                  items: checklist.items.filter(
                    (item) => item.id !== tempItem.id
                  ),
                }
              : checklist
          )
        );
        return false;
      }
    } catch (error) {
      console.error('Error adding checklist item:', error);
      // Remove temp item on error
      setChecklists((prev) =>
        prev.map((checklist) =>
          checklist.id === checklistId
            ? {
                ...checklist,
                items: checklist.items.filter(
                  (item) => item.id !== tempItem.id
                ),
              }
            : checklist
        )
      );
      return false;
    } finally {
      setIsAddingChecklistItem(false);
    }
  };

  const handleUpdateChecklistItem = async (
    checklistId: string,
    itemId: string,
    updates: Partial<ChecklistItem>
  ): Promise<boolean> => {
    if (!card) return false;

    setIsUpdatingChecklistItem(true);

    // Store original values for rollback
    const originalValues: Partial<ChecklistItem> = {};
    setChecklists((prev) => {
      const checklist = prev.find((c) => c.id === checklistId);
      const item = checklist?.items.find((i) => i.id === itemId);
      if (item) {
        Object.keys(updates).forEach((key) => {
          originalValues[key as keyof ChecklistItem] =
            item[key as keyof ChecklistItem];
        });
      }
      return prev;
    });

    // Optimistic update - update UI immediately
    setChecklists((prev) =>
      prev.map((checklist) =>
        checklist.id === checklistId
          ? {
              ...checklist,
              items: checklist.items.map((item) =>
                item.id === itemId ? { ...item, ...updates } : item
              ),
            }
          : checklist
      )
    );

    try {
      const response = await fetch(
        `/api/cards/${card.id}/checklists/${checklistId}/items/${itemId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        }
      );

      const data = await response.json();

      if (response.ok) {
        // Update with server response to ensure consistency
        setChecklists((prev) =>
          prev.map((checklist) =>
            checklist.id === checklistId
              ? {
                  ...checklist,
                  items: checklist.items.map((item) =>
                    item.id === itemId ? data.item : item
                  ),
                }
              : checklist
          )
        );
        return true;
      } else {
        console.error('Failed to update checklist item:', data.error);
        // Revert optimistic update on error using stored original values
        setChecklists((prev) =>
          prev.map((checklist) =>
            checklist.id === checklistId
              ? {
                  ...checklist,
                  items: checklist.items.map((item) =>
                    item.id === itemId ? { ...item, ...originalValues } : item
                  ),
                }
              : checklist
          )
        );
        return false;
      }
    } catch (error) {
      console.error('Error updating checklist item:', error);
      // Revert optimistic update on error using stored original values
      setChecklists((prev) =>
        prev.map((checklist) =>
          checklist.id === checklistId
            ? {
                ...checklist,
                items: checklist.items.map((item) =>
                  item.id === itemId ? { ...item, ...originalValues } : item
                ),
              }
            : checklist
        )
      );
      return false;
    } finally {
      setIsUpdatingChecklistItem(false);
    }
  };

  const handleDeleteChecklistItem = async (
    checklistId: string,
    itemId: string
  ): Promise<boolean> => {
    if (!card) return false;

    setIsDeletingChecklistItem(true);

    // Store the item for potential restoration
    let deletedItem: ChecklistItem | null = null;

    // Optimistic update - remove item immediately
    setChecklists((prev) =>
      prev.map((checklist) => {
        if (checklist.id === checklistId) {
          deletedItem =
            checklist.items.find((item) => item.id === itemId) || null;
          return {
            ...checklist,
            items: checklist.items.filter((item) => item.id !== itemId),
          };
        }
        return checklist;
      })
    );

    try {
      const response = await fetch(
        `/api/cards/${card.id}/checklists/${checklistId}/items/${itemId}`,
        {
          method: 'DELETE',
        }
      );

      if (response.ok) {
        return true;
      } else {
        const data = await response.json();
        console.error('Failed to delete checklist item:', data.error);

        // Restore the item on error
        if (deletedItem) {
          setChecklists((prev) =>
            prev.map((checklist) =>
              checklist.id === checklistId
                ? {
                    ...checklist,
                    items: [...checklist.items, deletedItem!],
                  }
                : checklist
            )
          );
        }
        return false;
      }
    } catch (error) {
      console.error('Error deleting checklist item:', error);

      // Restore the item on error
      if (deletedItem) {
        setChecklists((prev) =>
          prev.map((checklist) =>
            checklist.id === checklistId
              ? {
                  ...checklist,
                  items: [...checklist.items, deletedItem!],
                }
              : checklist
          )
        );
      }
      return false;
    } finally {
      setIsDeletingChecklistItem(false);
    }
  };

  const handleAddAttachment = async (
    name: string,
    url: string,
    type: string
  ): Promise<boolean> => {
    if (!card) return false;

    setIsAddingAttachment(true);
    try {
      const response = await fetch(`/api/cards/${card.id}/attachments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          url: url.trim(),
          type: type.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Add the new attachment to state
        setAttachments((prev) => [data.attachment, ...prev]);
        // Refresh activities to show the new attachment activity
        fetchActivities();
        return true;
      } else {
        console.error('Failed to add attachment:', data.error);
        return false;
      }
    } catch (error) {
      console.error('Error adding attachment:', error);
      return false;
    } finally {
      setIsAddingAttachment(false);
    }
  };

  const handleUpdateAttachment = async (
    attachmentId: string,
    name: string,
    url: string,
    type: string
  ): Promise<boolean> => {
    if (!card) return false;

    setIsAddingAttachment(true);
    try {
      const response = await fetch(
        `/api/cards/${card.id}/attachments/${attachmentId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: name.trim(),
            url: url.trim(),
            type: type.trim(),
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        // Update the attachment in state
        setAttachments((prev) =>
          prev.map((att) => (att.id === attachmentId ? data.attachment : att))
        );
        // Refresh activities to show the update activity
        fetchActivities();
        return true;
      } else {
        console.error('Failed to update attachment:', data.error);
        return false;
      }
    } catch (error) {
      console.error('Error updating attachment:', error);
      return false;
    } finally {
      setIsAddingAttachment(false);
    }
  };

  const handleDeleteAttachment = (attachment: AttachmentData) => {
    setAttachmentToDelete(attachment);
    setShowDeleteAttachmentModal(true);
  };

  const confirmDeleteAttachment = async () => {
    if (!card || !attachmentToDelete) return;

    setIsDeletingAttachment(true);

    try {
      const response = await fetch(
        `/api/cards/${card.id}/attachments/${attachmentToDelete.id}`,
        {
          method: 'DELETE',
        }
      );

      if (response.ok) {
        // Remove attachment from state
        setAttachments((prev) =>
          prev.filter((att) => att.id !== attachmentToDelete.id)
        );
        // Refresh activities to show the deletion activity
        fetchActivities();
        // Close modal
        setShowDeleteAttachmentModal(false);
        setAttachmentToDelete(null);
      } else {
        const data = await response.json();
        console.error('Failed to delete attachment:', data.error);
        alert(`Failed to delete attachment: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting attachment:', error);
      alert(
        `Failed to delete attachment: ${
          error instanceof Error ? error.message : 'Network error'
        }`
      );
    } finally {
      setIsDeletingAttachment(false);
    }
  };

  const cancelDeleteAttachment = () => {
    setShowDeleteAttachmentModal(false);
    setAttachmentToDelete(null);
  };

  const handleEditAttachment = (attachment: AttachmentData) => {
    setEditingAttachment(attachment);
    setShowAttachmentModal(true);
  };

  const handleMemberAdded = (member: CardMemberData) => {
    // Set saving state
    setIsSavingMember(true);

    // Optimistic update - add member immediately
    setCardMembers((prev) => [...prev, member]);
    // Refresh activities to show the member addition
    fetchActivities();

    // Notify parent component about member update
    onMembersUpdated?.(member.profiles.id, {
      action: 'added',
      member: member,
    });

    // Clear saving state after a short delay (will be cleared properly when API responds)
    setTimeout(() => setIsSavingMember(false), 1000);
  };

  const handleRemoveMember = async (profileId: string) => {
    // Find the member being removed for potential rollback
    const memberToRemove = cardMembers.find(
      (member) => member.profiles.id === profileId
    );
    if (!memberToRemove) return;

    // Set saving state
    setIsSavingMember(true);

    // Optimistic update - remove member immediately
    setCardMembers((prev) =>
      prev.filter((member) => member.profiles.id !== profileId)
    );

    try {
      const response = await fetch(
        `/api/cards/${card.id}/members/${profileId}`,
        {
          method: 'DELETE',
        }
      );

      if (response.ok) {
        // Success - refresh activities to show the member removal
        fetchActivities();

        // Notify parent component about member removal
        onMembersUpdated?.(profileId, {
          action: 'removed',
          memberId: profileId,
          member: memberToRemove,
        });
      } else {
        // Rollback on failure
        setCardMembers((prev) => [...prev, memberToRemove]);
        const data = await response.json();
        console.error('Failed to remove member:', data.error);
        alert(`Failed to remove member: ${data.error}`);
      }
    } catch (error) {
      // Rollback on error
      setCardMembers((prev) => [...prev, memberToRemove]);
      console.error('Error removing member:', error);
      alert('Failed to remove member. Please try again.');
    } finally {
      // Clear saving state
      setIsSavingMember(false);
    }
  };

  // Fetch available lists for moving the card
  const fetchAvailableLists = async () => {
    setIsLoadingLists(true);
    try {
      console.log(
        'CardModal - fetchAvailableLists called for card:',
        card.id,
        'in list:',
        card.list_id
      );

      const response = await fetch(`/api/lists?board_id=${card.board_id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch board lists');
      }

      console.log('CardModal - Raw API response:', data);
      console.log(
        'CardModal - Card list_id:',
        card.list_id,
        'type:',
        typeof card.list_id
      );

      // Prepare the lists data with card counts, excluding current list
      const allLists = data.lists || [];
      const listsWithCounts = [];

      for (const list of allLists) {
        const listId = String(list.id);
        const currentId = String(card.list_id);
        const isCurrentList = listId === currentId;

        console.log(`CardModal - Processing list "${list.name}":`, {
          listId,
          currentId,
          isCurrentList,
          shouldInclude: !isCurrentList,
        });

        if (!isCurrentList) {
          listsWithCounts.push({
            id: list.id,
            name: list.name,
            cards_count: list.cards?.length || 0,
          });
        } else {
          console.log(`CardModal - EXCLUDING current list "${list.name}"`);
        }
      }

      console.log('CardModal - Final filtered lists:', listsWithCounts);
      setAvailableLists(listsWithCounts);

      // Set default selection to first available list (since current list is excluded)
      if (listsWithCounts.length > 0) {
        setSelectedListId(listsWithCounts[0].id);
      }
    } catch (error) {
      console.error('Error fetching lists:', error);
    } finally {
      setIsLoadingLists(false);
    }
  };

  // Handle moving the card
  const handleMoveCard = async () => {
    if (!selectedListId || isMovingCard) return;

    setIsMovingCard(true);

    try {
      const response = await fetch(`/api/cards/${card.id}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          list_id: selectedListId,
          position: 999999, // Move to end of list
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to move card');
      }

      // Close the move modal and card modal
      setShowMoveModal(false);
      onClose(); // Close the card modal

      // Refresh the page to show the updated board state
      window.location.reload();
    } catch (error) {
      console.error('Error moving card:', error);
      // Handle error - could show a toast notification here
    } finally {
      setIsMovingCard(false);
    }
  };

  // Handle opening move modal
  const handleOpenMoveModal = () => {
    console.log(
      'CardModal - Opening move modal for card:',
      card.id,
      'in list:',
      card.list_id
    );
    // Clear any existing lists first
    setAvailableLists([]);
    setSelectedListId('');
    setShowMoveModal(true);
    fetchAvailableLists();
  };

  // Handle ESC key for move modal
  useEffect(() => {
    if (!showMoveModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showMoveModal) {
        e.preventDefault();
        e.stopPropagation();
        setShowMoveModal(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [showMoveModal]);

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
      case 'attachment_removed':
        return <Trash2 className='w-4 h-4' />;
      case 'attachment_updated':
        return <Edit className='w-4 h-4' />;
      case 'label_added':
      case 'label_removed':
        return <Tag className='w-4 h-4' />;
      case 'member_added':
      case 'member_removed':
        return <User className='w-4 h-4' />;
      case 'timeline_updated':
        return <Calendar className='w-4 h-4' />;
      case 'start_date_set':
        return <Play className='w-4 h-4' />;
      case 'start_date_removed':
        return <Timer className='w-4 h-4' />;
      case 'due_date_set':
        return <Flag className='w-4 h-4' />;
      case 'due_date_removed':
        return <Target className='w-4 h-4' />;
      case 'checklist_added':
        return <CheckSquare className='w-4 h-4' />;
      case 'checklist_updated':
        return <Edit className='w-4 h-4' />;
      case 'checklist_removed':
        return <X className='w-4 h-4' />;
      default:
        return <Activity className='w-4 h-4' />;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'
      onClick={(e) => {
        // Only close if clicking the backdrop (not the modal content)
        if (e.target === e.currentTarget) {
          handleModalClose();
        }
      }}
    >
      <div className='bg-card rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] border border-border overflow-hidden flex flex-col'>
        {/* Header */}
        <div className='flex items-start gap-4 p-6 border-b border-border bg-muted/30 flex-shrink-0'>
          <div className='flex-1'>
            {/* Card Title */}
            <div className='flex items-center gap-2 mb-2'>
              <Edit3 className='w-5 h-5 text-muted-foreground' />
              <div className='flex items-center gap-2 flex-1'>
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
                {hasActiveSaveOperations() && (
                  <div className='flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full border border-amber-200 whitespace-nowrap'>
                    <div className='w-2 h-2 bg-amber-500 rounded-full animate-pulse'></div>
                    Saving...
                  </div>
                )}
              </div>
            </div>

            {/* Breadcrumb */}
            <p className='text-sm text-muted-foreground mb-3'>
              in list{' '}
              <span className='font-medium text-foreground'>{listName}</span> on{' '}
              <span className='font-medium text-foreground'>{boardName}</span>
            </p>

            {/* Labels Section */}
            <div className='flex items-center gap-3'>
              <div
                className='flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors'
                onClick={() => setShowLabelModal(true)}
                title='Manage labels'
              >
                <Tag className='w-4 h-4 text-muted-foreground' />
                <span className='text-sm font-medium text-foreground'>
                  Labels
                </span>
              </div>
              <div
                className='flex-1 cursor-pointer hover:bg-muted/30 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors'
                onClick={() => setShowLabelModal(true)}
                title='Click to manage labels'
              >
                <CardLabels
                  key={labelsRefreshKey}
                  cardId={card.id}
                  maxVisible={8}
                  showNames={true}
                  size='md'
                />
              </div>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={handleModalClose}
            className={`p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors ${
              hasActiveSaveOperations()
                ? 'animate-pulse bg-amber-50 border border-amber-200'
                : ''
            }`}
            title={
              hasActiveSaveOperations()
                ? 'Saving in progress...'
                : 'Close modal'
            }
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        <div className='flex gap-6 p-6 flex-1 overflow-hidden'>
          {/* Left Side - Main Content */}
          <div className='flex-1 space-y-6 overflow-y-auto pr-4'>
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

            {/* Additional Card Information */}
            <div className='mt-8'>
              {/* Members Section */}
              <div className='mb-6'>
                <div className='flex items-center justify-between mb-4'>
                  <div className='flex items-center gap-2'>
                    <User className='w-4 h-4 text-muted-foreground' />
                    <h3 className='text-sm font-medium text-foreground'>
                      Members
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowMemberPicker(true)}
                    className='flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors'
                    title='Add member'
                  >
                    <Plus className='w-3 h-3' />
                    Add
                  </button>
                </div>

                {isLoadingMembers ? (
                  <div className='flex items-center justify-center py-6'>
                    <div className='w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin' />
                  </div>
                ) : cardMembers.length > 0 ? (
                  <div className='space-y-3'>
                    {/* Stacked Avatars Display */}
                    <div className='flex items-center gap-2'>
                      <div className='flex -space-x-2'>
                        {cardMembers.slice(0, 5).map((member, index) => (
                          <div
                            key={member.id}
                            className='relative group/avatar'
                            style={{
                              zIndex: cardMembers.length - index,
                              animationDelay: `${index * 100}ms`,
                            }}
                          >
                            <div className='relative'>
                              <UserAvatar profile={member.profiles} size={40} />
                              <div className='absolute inset-0 rounded-full border-2 border-white dark:border-gray-800 group-hover/avatar:border-primary transition-colors'></div>
                            </div>

                            {/* Hover Tooltip - Simple right positioning */}
                            <div className='absolute left-full top-1/2 transform -translate-y-1/2 ml-3 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-xl opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-200 pointer-events-none z-[100] whitespace-nowrap'>
                              <div className='font-medium'>
                                {member.profiles.full_name || 'Unknown User'}
                              </div>
                              <div className='text-xs text-gray-300'>
                                {member.profiles.email}
                              </div>
                              {/* Left arrow pointing to avatar */}
                              <div className='absolute right-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-900'></div>
                            </div>
                          </div>
                        ))}
                        {cardMembers.length > 5 && (
                          <div className='w-10 h-10 rounded-full bg-muted border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs font-medium text-muted-foreground'>
                            +{cardMembers.length - 5}
                          </div>
                        )}
                      </div>
                      <span className='text-sm text-muted-foreground ml-2'>
                        {cardMembers.length} member
                        {cardMembers.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Detailed Member List (Initially Hidden) */}
                    <div className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <button
                          onClick={() => {
                            setShowDetailedMembers(!showDetailedMembers);
                            // Clear search when hiding details
                            if (showDetailedMembers) {
                              setMemberSearchQuery('');
                              setShowMemberSearch(false);
                            }
                          }}
                          className='flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors'
                        >
                          {showDetailedMembers ? (
                            <>
                              <ChevronUp className='w-4 h-4' />
                              Hide details
                            </>
                          ) : (
                            <>
                              <ChevronDown className='w-4 h-4' />
                              Show details
                            </>
                          )}
                        </button>

                        {showDetailedMembers && cardMembers.length > 0 && (
                          <button
                            onClick={() => {
                              setShowMemberSearch(!showMemberSearch);
                              // Clear search when toggling search off
                              if (showMemberSearch) {
                                setMemberSearchQuery('');
                              }
                            }}
                            className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all duration-200'
                            title='Search members'
                          >
                            <Search className='w-4 h-4' />
                          </button>
                        )}
                      </div>

                      {showDetailedMembers && (
                        <div className='space-y-2 animate-in slide-in-from-top-2 duration-200'>
                          {/* Search Input */}
                          {showMemberSearch && (
                            <div className='relative'>
                              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                              <input
                                type='text'
                                placeholder='Search by name or email...'
                                value={memberSearchQuery}
                                onChange={(e) =>
                                  setMemberSearchQuery(e.target.value)
                                }
                                className='w-full pl-10 pr-4 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary'
                                autoFocus
                              />
                              {memberSearchQuery && (
                                <button
                                  onClick={() => setMemberSearchQuery('')}
                                  className='absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground'
                                  title='Clear search'
                                >
                                  <X className='w-4 h-4' />
                                </button>
                              )}
                            </div>
                          )}

                          {/* Members List */}
                          {filteredCardMembers.length > 0 ? (
                            filteredCardMembers.map((member, index) => (
                              <div
                                key={member.id}
                                className='flex items-center gap-3 p-2.5 bg-gradient-to-r from-muted/20 to-muted/30 rounded-xl border border-border/30 hover:border-border/60 hover:from-muted/30 hover:to-muted/40 transition-all duration-200 group animate-slide-in-left'
                                style={{
                                  animationDelay: `${index * 50}ms`,
                                }}
                              >
                                <UserAvatar
                                  profile={member.profiles}
                                  size={36}
                                />
                                <div className='flex-1 min-w-0'>
                                  <p className='text-sm font-semibold text-foreground truncate'>
                                    {member.profiles.full_name ||
                                      'Unknown User'}
                                  </p>
                                  <p className='text-xs text-muted-foreground truncate opacity-80'>
                                    {member.profiles.email}
                                  </p>
                                </div>
                                <div className='flex items-center gap-1'>
                                  <button
                                    onClick={() =>
                                      handleRemoveMember(member.profiles.id)
                                    }
                                    className='p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100'
                                    title='Remove member'
                                  >
                                    <X className='w-3.5 h-3.5' />
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className='text-center py-4 text-muted-foreground'>
                              <Search className='w-8 h-8 mx-auto mb-2 opacity-50' />
                              <p className='text-sm'>No members found</p>
                              <p className='text-xs opacity-75'>
                                Try adjusting your search terms
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className='text-center py-8 text-muted-foreground'>
                    <div className='w-12 h-12 mx-auto mb-3 bg-muted/30 rounded-full flex items-center justify-center'>
                      <User className='w-6 h-6 opacity-60' />
                    </div>
                    <p className='text-sm font-medium'>No members assigned</p>
                    <p className='text-xs opacity-70 mt-1'>
                      Click "Add" to assign workspace members
                    </p>
                  </div>
                )}
              </div>

              {/* Card Dates Section - Compact Timeline */}
              {(card.start_date || card.due_date) && (
                <div className='mb-6'>
                  <div className='flex items-center gap-2 mb-3'>
                    <Calendar className='w-4 h-4 text-muted-foreground' />
                    <h3 className='text-sm font-medium text-foreground'>
                      Timeline
                    </h3>
                  </div>

                  <div className='bg-muted/30 rounded-xl p-4 space-y-3'>
                    {/* Compact Date Display */}
                    <div className='flex items-center justify-between gap-4'>
                      {/* Start Date */}
                      {card.start_date ? (
                        <div
                          onClick={openDatePickerForStart}
                          className='flex-1 flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors group'
                        >
                          <div className='w-6 h-6 bg-green-100 text-green-600 rounded-md flex items-center justify-center dark:bg-green-900/40 dark:text-green-400'>
                            <Calendar className='w-3 h-3' />
                          </div>
                          <div className='flex-1 min-w-0'>
                            <div className='text-xs font-medium text-green-800 dark:text-green-200'>
                              Start
                            </div>
                            <div className='text-xs text-green-600 dark:text-green-400 truncate'>
                              {formatDate(card.start_date)}
                            </div>
                          </div>
                          <Edit2 className='w-3 h-3 text-green-600 dark:text-green-400 opacity-0 group-hover:opacity-100 transition-opacity' />
                        </div>
                      ) : (
                        <div
                          onClick={openDatePickerForStart}
                          className='flex-1 flex items-center gap-2 p-2 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-green-400 hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-colors group'
                        >
                          <div className='w-6 h-6 bg-muted text-muted-foreground rounded-md flex items-center justify-center'>
                            <Calendar className='w-3 h-3' />
                          </div>
                          <div className='flex-1'>
                            <div className='text-xs text-muted-foreground'>
                              Add start date
                            </div>
                          </div>
                          <Plus className='w-3 h-3 text-muted-foreground group-hover:text-green-600 transition-colors' />
                        </div>
                      )}

                      {/* Timeline connector */}
                      <div className='flex items-center'>
                        <div className='w-8 h-px bg-gradient-to-r from-green-300 to-amber-300 dark:from-green-600 dark:to-amber-600'></div>
                        <ChevronRight className='w-3 h-3 text-muted-foreground mx-1' />
                      </div>

                      {/* Due Date */}
                      {card.due_date ? (
                        <div
                          onClick={openDatePickerForDue}
                          className={`flex-1 flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:opacity-80 transition-all group ${
                            card.due_status === 'complete'
                              ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
                              : card.due_status === 'overdue'
                              ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30'
                              : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded-md flex items-center justify-center ${
                              card.due_status === 'complete'
                                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
                                : card.due_status === 'overdue'
                                ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                                : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
                            }`}
                          >
                            <Clock className='w-3 h-3' />
                          </div>
                          <div className='flex-1 min-w-0'>
                            <div
                              className={`text-xs font-medium flex items-center gap-1 ${
                                card.due_status === 'complete'
                                  ? 'text-emerald-800 dark:text-emerald-200'
                                  : card.due_status === 'overdue'
                                  ? 'text-red-800 dark:text-red-200'
                                  : 'text-amber-800 dark:text-amber-200'
                              }`}
                            >
                              Due
                              {card.due_status === 'complete' && (
                                <Check className='w-3 h-3 text-emerald-600' />
                              )}
                            </div>
                            <div
                              className={`text-xs truncate ${
                                card.due_status === 'complete'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : card.due_status === 'overdue'
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {formatDate(card.due_date)}
                            </div>
                          </div>
                          <Edit2
                            className={`w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity ${
                              card.due_status === 'complete'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : card.due_status === 'overdue'
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          />
                        </div>
                      ) : (
                        <div
                          onClick={openDatePickerForDue}
                          className='flex-1 flex items-center gap-2 p-2 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors group'
                        >
                          <div className='w-6 h-6 bg-muted text-muted-foreground rounded-md flex items-center justify-center'>
                            <Clock className='w-3 h-3' />
                          </div>
                          <div className='flex-1'>
                            <div className='text-xs text-muted-foreground'>
                              Add due date
                            </div>
                          </div>
                          <Plus className='w-3 h-3 text-muted-foreground group-hover:text-amber-600 transition-colors' />
                        </div>
                      )}
                    </div>

                    {/* Status indicator */}
                    {card.due_status && (
                      <div className='flex justify-center'>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            card.due_status === 'complete'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : card.due_status === 'overdue'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}
                        >
                          {card.due_status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Checklists Section */}
              <div className='mb-6'>
                <div className='flex items-center justify-between mb-4'>
                  <div className='flex items-center gap-2'>
                    <CheckSquare className='w-4 h-4 text-muted-foreground' />
                    <h3 className='text-sm font-medium text-foreground'>
                      Checklists
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowAddChecklistModal(true)}
                    className='flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors'
                    disabled={isAddingChecklist}
                    title='Add checklist'
                  >
                    <Plus className='w-3 h-3' />
                    Add
                  </button>
                </div>

                {isLoadingChecklists ? (
                  <div className='flex items-center justify-center py-8'>
                    <div className='w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin' />
                  </div>
                ) : checklists.length > 0 ? (
                  <div className='space-y-4'>
                    {checklists.map((checklist) => (
                      <Checklist
                        key={checklist.id}
                        checklist={checklist}
                        onUpdateChecklist={handleUpdateChecklist}
                        onDeleteChecklist={handleDeleteChecklist}
                        onAddItem={handleAddChecklistItem}
                        onUpdateItem={handleUpdateChecklistItem}
                        onDeleteItem={handleDeleteChecklistItem}
                        isLoading={false}
                      />
                    ))}
                  </div>
                ) : (
                  <div className='text-center py-6 text-muted-foreground'>
                    <CheckSquare className='w-8 h-8 mx-auto mb-2 opacity-50' />
                    <p className='text-xs'>No checklists yet</p>
                    <p className='text-xs mt-1 opacity-75'>
                      Add a checklist to track your progress
                    </p>
                  </div>
                )}
              </div>

              {/* Attachments Section */}
              <div>
                <div className='flex items-center justify-between mb-3'>
                  <div className='flex items-center gap-2'>
                    <Paperclip className='w-5 h-5 text-muted-foreground' />
                    <h3 className='text-base font-medium text-foreground'>
                      Attachments
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowAttachmentModal(true)}
                    className='flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors'
                    title='Add attachment'
                  >
                    <Plus className='w-3 h-3' />
                    Add
                  </button>
                </div>

                {isLoadingAttachments ? (
                  <div className='flex items-center justify-center py-8'>
                    <div className='w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin' />
                  </div>
                ) : attachments.length > 0 ? (
                  <div className='space-y-3'>
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className='flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors group'
                      >
                        <div className='w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0'>
                          {attachment.type === 'image' ? (
                            <Image className='w-4 h-4 text-primary' />
                          ) : attachment.type === 'document' ? (
                            <FileText className='w-4 h-4 text-primary' />
                          ) : attachment.type === 'video' ? (
                            <Video className='w-4 h-4 text-primary' />
                          ) : attachment.type === 'audio' ? (
                            <Music className='w-4 h-4 text-primary' />
                          ) : attachment.type === 'archive' ? (
                            <Archive className='w-4 h-4 text-primary' />
                          ) : (
                            <LinkIcon className='w-4 h-4 text-primary' />
                          )}
                        </div>
                        <div className='flex-1 min-w-0'>
                          <a
                            href={attachment.url}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-sm font-medium text-foreground hover:text-primary transition-colors block truncate'
                            title={attachment.name}
                          >
                            {attachment.name}
                          </a>
                          <div className='flex items-center gap-2 text-xs text-muted-foreground mt-1'>
                            <span>
                              Added {formatDate(attachment.created_at)}
                            </span>
                            {attachment.profiles && (
                              <>
                                <span>•</span>
                                <span>
                                  by{' '}
                                  {attachment.profiles.full_name || 'Unknown'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                          <button
                            onClick={() => handleEditAttachment(attachment)}
                            className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors'
                            title='Edit attachment'
                          >
                            <Edit className='w-3 h-3' />
                          </button>
                          <button
                            onClick={() => handleDeleteAttachment(attachment)}
                            className='p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors'
                            title='Delete attachment'
                          >
                            <Trash2 className='w-3 h-3' />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='text-center py-6 text-muted-foreground'>
                    <Paperclip className='w-8 h-8 mx-auto mb-2 opacity-50' />
                    <p className='text-xs'>No attachments yet</p>
                    <p className='text-xs mt-1 opacity-75'>
                      Add links to files, documents, or resources
                    </p>
                  </div>
                )}
              </div>

              {/* Created info */}
              <div className='text-sm text-muted-foreground space-y-2 pt-4 border-t border-border'>
                <div className='flex items-center gap-2'>
                  <CalendarIcon className='w-4 h-4' />
                  <span>Created {formatDate(card.created_at)}</span>
                </div>
                <div className='flex items-center gap-2'>
                  <Edit className='w-4 h-4' />
                  <span>Updated {formatDate(card.updated_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Comments and Activities */}
          <div className='w-96 flex-shrink-0 border-l border-border pl-6 flex flex-col'>
            {/* Sticky Action Buttons */}
            <div className='flex gap-2 mb-4 sticky top-0 bg-card z-30 py-2'>
              {/* Add to Card Dropdown */}
              <div className='relative flex-1'>
                <button
                  onClick={() =>
                    setIsAddToCardDropdownOpen(!isAddToCardDropdownOpen)
                  }
                  className='w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 shadow-sm hover:shadow-md font-medium text-sm'
                  title='Add to card'
                >
                  <Plus className='w-4 h-4' />
                  Add to card
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isAddToCardDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isAddToCardDropdownOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className='fixed inset-0 z-10'
                      onClick={() => setIsAddToCardDropdownOpen(false)}
                    />

                    {/* Dropdown Menu */}
                    <div className='absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-20 py-2'>
                      <div className='px-3 py-2'>
                        <div className='space-y-1'>
                          <button
                            onClick={() => {
                              setShowMemberPicker(true);
                              setIsAddToCardDropdownOpen(false);
                            }}
                            className='w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted rounded-lg transition-colors'
                          >
                            <User className='w-4 h-4 text-muted-foreground' />
                            Members
                          </button>
                          <button
                            onClick={() => {
                              setShowLabelModal(true);
                              setIsAddToCardDropdownOpen(false);
                            }}
                            className='w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted rounded-lg transition-colors'
                          >
                            <Tag className='w-4 h-4 text-muted-foreground' />
                            Labels
                          </button>
                          <button
                            onClick={() => {
                              setShowAddChecklistModal(true);
                              setIsAddToCardDropdownOpen(false);
                            }}
                            className='w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted rounded-lg transition-colors'
                          >
                            <CheckSquare className='w-4 h-4 text-muted-foreground' />
                            Checklist
                          </button>
                          <button
                            onClick={() => {
                              openDatePickerForDue(); // Default to due date for general "Dates" button
                              setIsAddToCardDropdownOpen(false);
                            }}
                            className='w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted rounded-lg transition-colors'
                          >
                            <Calendar className='w-4 h-4 text-muted-foreground' />
                            Dates
                          </button>
                          <button
                            onClick={() => {
                              setShowAttachmentModal(true);
                              setIsAddToCardDropdownOpen(false);
                            }}
                            className='w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted rounded-lg transition-colors'
                          >
                            <Paperclip className='w-4 h-4 text-muted-foreground' />
                            Attachment
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Actions Dropdown */}
              <div className='relative flex-1'>
                <button
                  onClick={() =>
                    setIsActionsDropdownOpen(!isActionsDropdownOpen)
                  }
                  className='w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-all duration-200 shadow-sm hover:shadow-md font-medium text-sm'
                  title='Card actions'
                >
                  <Settings className='w-4 h-4' />
                  Actions
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isActionsDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isActionsDropdownOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className='fixed inset-0 z-10'
                      onClick={() => setIsActionsDropdownOpen(false)}
                    />

                    {/* Dropdown Menu */}
                    <div className='absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-20 py-2'>
                      <div className='px-3 py-2'>
                        <div className='space-y-1'>
                          <button
                            onClick={() => {
                              setIsActionsDropdownOpen(false);
                              handleOpenMoveModal();
                            }}
                            className='w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted rounded-lg transition-colors'
                          >
                            <Move className='w-4 h-4 text-muted-foreground' />
                            Move
                          </button>

                          {onDeleteCard && (
                            <div className='border-t border-border my-2 pt-2'>
                              <button
                                onClick={() => {
                                  setIsActionsDropdownOpen(false);
                                  setShowDeleteConfirm(true);
                                }}
                                className='w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors'
                              >
                                <Trash2 className='w-4 h-4' />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Date Time Range Picker */}
            {showDatePicker && (
              <DateTimeRangePicker
                startDate={selectedStartDate}
                endDate={selectedDueDate}
                startTime={selectedStartTime}
                endTime={selectedDueTime}
                onSaveDateTime={handleSaveDates}
                onClose={() => setShowDatePicker(false)}
                isLoading={isSavingDates}
                initialSelection={datePickerInitialSelection}
              />
            )}

            {/* Sticky Tab Design */}
            <div className='flex gap-1 mb-4 p-1 bg-muted rounded-lg sticky top-16 bg-card z-20'>
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
              <div className='flex flex-col flex-1 overflow-hidden'>
                {/* Enhanced Add comment form */}
                <div className='bg-muted/30 rounded-xl p-4 border border-border/50 mb-4'>
                  <div className='w-full'>
                    <form onSubmit={handleSubmitComment} className='space-y-3'>
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
                            disabled={!newComment.trim() || isSubmittingComment}
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

                {/* Scrollable Content Area */}
                <div className='flex-1 overflow-y-auto pr-2 space-y-4'>
                  {/* Comment Filters and Search */}
                  {comments.length > 0 && (
                    <div className='bg-background rounded-lg border border-border p-4 space-y-3'>
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-2'>
                          <Filter className='w-4 h-4 text-muted-foreground' />
                          <span className='text-sm font-medium text-foreground'>
                            Filter & Search Comments
                          </span>
                          <span className='text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded'>
                            {filteredAndSortedComments.length} of{' '}
                            {comments.length}
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            setShowCommentFilters(!showCommentFilters)
                          }
                          className='text-xs text-primary hover:text-primary/80 transition-colors'
                        >
                          {showCommentFilters ? 'Hide filters' : 'Show filters'}
                        </button>
                      </div>

                      {showCommentFilters && (
                        <div className='space-y-3 pt-2 border-t border-border/50'>
                          {/* Search Input */}
                          <div className='relative'>
                            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                            <input
                              type='text'
                              placeholder='Search comments by content or author...'
                              value={commentSearchQuery}
                              onChange={(e) =>
                                handleCommentSearch(e.target.value)
                              }
                              className='w-full pl-10 pr-4 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all'
                            />
                            {commentSearchQuery && (
                              <button
                                onClick={() => handleCommentSearch('')}
                                className='absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors'
                                title='Clear search'
                              >
                                <X className='w-4 h-4' />
                              </button>
                            )}
                          </div>

                          {/* Sort Options */}
                          <div className='flex items-center gap-3'>
                            <span className='text-xs font-medium text-muted-foreground'>
                              Sort by:
                            </span>
                            <div className='flex gap-1'>
                              <button
                                onClick={() => setCommentSortOrder('newest')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
                                  commentSortOrder === 'newest'
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                              >
                                <SortDesc className='w-3 h-3' />
                                Newest first
                              </button>
                              <button
                                onClick={() => setCommentSortOrder('oldest')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
                                  commentSortOrder === 'oldest'
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                              >
                                <SortAsc className='w-3 h-3' />
                                Oldest first
                              </button>
                            </div>
                          </div>

                          {/* Clear Filters */}
                          {(commentSearchQuery ||
                            commentSortOrder !== 'newest') && (
                            <div className='flex justify-end'>
                              <button
                                onClick={clearCommentFilters}
                                className='text-xs text-muted-foreground hover:text-foreground transition-colors'
                              >
                                Clear all filters
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Comments List */}
                  <div className='space-y-4'>
                    {isLoadingComments ? (
                      <div className='flex justify-center py-8'>
                        <div className='w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin' />
                      </div>
                    ) : filteredAndSortedComments.length > 0 ? (
                      filteredAndSortedComments.map((comment) => (
                        <div
                          key={comment.id}
                          className='group bg-background rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden'
                        >
                          <div className='p-4'>
                            <div className='flex justify-between items-start mb-2'>
                              <div className='flex items-center gap-2'>
                                <UserAvatar
                                  profile={comment.profiles}
                                  size={24}
                                />
                                <span className='font-medium text-sm text-foreground'>
                                  {comment.profiles.full_name || 'Unknown User'}
                                </span>
                                <span className='text-xs text-muted-foreground'>
                                  {formatTimestamp(comment.created_at)}
                                  {comment.is_edited && ' (edited)'}
                                </span>
                              </div>

                              {/* Comment Actions */}
                              <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                                <button
                                  onClick={() => handleEditComment(comment)}
                                  className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors'
                                  title='Edit comment'
                                >
                                  <Edit className='w-3 h-3' />
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteComment(comment.id)
                                  }
                                  className='p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors'
                                  title='Delete comment'
                                >
                                  <Trash2 className='w-3 h-3' />
                                </button>
                              </div>
                            </div>

                            {/* Comment Content */}
                            {editingCommentId === comment.id ? (
                              <div className='space-y-3'>
                                <textarea
                                  value={editingCommentContent}
                                  onChange={(e) =>
                                    setEditingCommentContent(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (
                                      e.key === 'Enter' &&
                                      e.ctrlKey &&
                                      editingCommentContent.trim() &&
                                      editingSavingCommentId !== comment.id
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
                                  className='w-full p-3 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm bg-background min-h-[80px]'
                                  disabled={
                                    editingSavingCommentId === comment.id
                                  }
                                  aria-label='Edit comment'
                                  placeholder='Edit your comment...'
                                  autoFocus
                                />
                                <div className='flex justify-between items-center mb-2'>
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
                                </div>
                                <div className='flex gap-2'>
                                  <button
                                    onClick={() =>
                                      handleSaveEditComment(comment.id)
                                    }
                                    disabled={
                                      !editingCommentContent.trim() ||
                                      editingSavingCommentId === comment.id
                                    }
                                    className='flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow disabled:hover:shadow-sm'
                                  >
                                    {editingSavingCommentId === comment.id ? (
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
                                  <button
                                    onClick={() => {
                                      setEditingCommentId(null);
                                      setEditingCommentContent('');
                                    }}
                                    disabled={
                                      editingSavingCommentId === comment.id
                                    }
                                    className='px-4 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm rounded-md transition-colors disabled:opacity-50'
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className='group cursor-pointer hover:bg-muted/30 rounded-md p-2 -m-2 transition-colors'
                                onClick={() => handleEditComment(comment)}
                                title='Click to edit comment'
                              >
                                <p className='text-sm text-foreground whitespace-pre-wrap leading-relaxed'>
                                  {comment.content}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className='text-center py-8'>
                        <MessageSquare className='w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50' />
                        <p className='text-sm text-muted-foreground'>
                          {commentSearchQuery
                            ? 'No comments match your search.'
                            : 'No comments yet. Be the first to add one!'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'activities' && (
              <div className='flex-1 overflow-y-auto pr-2 space-y-4'>
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
                        onClick={() => setShowAllActivities(!showAllActivities)}
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
                        ).map((activity) => {
                          const isExpanded = expandedActivities.has(
                            activity.id
                          );
                          const detailedInfo =
                            getDetailedActivityInfo(activity);
                          const hasDetails = detailedInfo || activity.comments;

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
                              <div className='flex-1 min-w-0'>
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
                                      <div className='flex-1 min-w-0'>
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
                                          {formatTimestamp(activity.created_at)}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Expanded details */}
                                    {isExpanded && (
                                      <div className='mt-3 pt-3 border-t border-border/50 space-y-2'>
                                        {detailedInfo && (
                                          <div className='p-3 bg-muted/30 rounded-md'>
                                            <div className='flex items-center gap-2 mb-2'>
                                              {activity.action_type ===
                                              'timeline_updated' ? (
                                                <Calendar className='w-4 h-4 text-indigo-500 flex-shrink-0' />
                                              ) : activity.action_type.includes(
                                                  'label'
                                                ) ? (
                                                <Tag className='w-4 h-4 text-orange-500 flex-shrink-0' />
                                              ) : activity.action_type.includes(
                                                  'attachment'
                                                ) ? (
                                                <Paperclip className='w-4 h-4 text-blue-500 flex-shrink-0' />
                                              ) : activity.action_type.includes(
                                                  'checklist'
                                                ) ? (
                                                <CheckSquare className='w-4 h-4 text-teal-500 flex-shrink-0' />
                                              ) : (
                                                <Calendar className='w-4 h-4 text-indigo-500 flex-shrink-0' />
                                              )}
                                              <span className='text-xs font-medium text-muted-foreground'>
                                                {activity.action_type ===
                                                'timeline_updated'
                                                  ? 'Timeline Changes'
                                                  : activity.action_type.includes(
                                                      'label'
                                                    )
                                                  ? 'Label Details'
                                                  : activity.action_type.includes(
                                                      'attachment'
                                                    )
                                                  ? 'Attachment Details'
                                                  : activity.action_type.includes(
                                                      'checklist'
                                                    )
                                                  ? 'Checklist Details'
                                                  : 'Details'}
                                              </span>
                                            </div>
                                            <div className='space-y-1'>
                                              {detailedInfo
                                                .split('\n')
                                                .map((line, index) => (
                                                  <div
                                                    key={index}
                                                    className='text-sm text-foreground font-mono'
                                                  >
                                                    {line}
                                                  </div>
                                                ))}
                                            </div>
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

                                        <div className='flex items-center gap-4 text-xs text-muted-foreground'>
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
                  <div className='text-center py-8'>
                    <Activity className='w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50' />
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

        {/* Delete Attachment Confirmation Modal */}
        {showDeleteAttachmentModal && attachmentToDelete && (
          <div className='fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4'>
            <div className='bg-card rounded-xl shadow-2xl border border-border max-w-md w-full'>
              <div className='p-6'>
                <div className='flex items-center gap-3 mb-4'>
                  <div className='w-10 h-10 bg-red-100 rounded-full flex items-center justify-center'>
                    <Paperclip className='w-5 h-5 text-red-600' />
                  </div>
                  <div>
                    <h3 className='text-lg font-semibold text-foreground'>
                      Delete Attachment
                    </h3>
                    <p className='text-sm text-muted-foreground'>
                      This action cannot be undone
                    </p>
                  </div>
                </div>

                <p className='text-sm text-foreground mb-2'>
                  Are you sure you want to delete this attachment?
                </p>
                <div className='p-3 bg-muted/30 rounded-lg border border-border/50 mb-6'>
                  <p className='text-sm font-medium text-foreground truncate'>
                    {attachmentToDelete.name}
                  </p>
                  <p className='text-xs text-muted-foreground truncate'>
                    {attachmentToDelete.url}
                  </p>
                </div>

                <div className='flex gap-3 justify-end'>
                  <button
                    onClick={cancelDeleteAttachment}
                    className='px-4 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-md transition-colors'
                    disabled={isDeletingAttachment}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteAttachment}
                    disabled={isDeletingAttachment}
                    className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors'
                  >
                    {isDeletingAttachment ? (
                      <>
                        <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className='w-4 h-4' />
                        Delete Attachment
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Checklist Modal */}
        <AddChecklistModal
          isOpen={showAddChecklistModal}
          onClose={() => setShowAddChecklistModal(false)}
          onAddChecklist={handleAddChecklist}
          isLoading={isAddingChecklist}
          existingChecklists={checklists}
        />

        {/* Label Modal */}
        <LabelModal
          isOpen={showLabelModal}
          onClose={() => setShowLabelModal(false)}
          cardId={card.id}
          boardId={card.board_id}
          onLabelsUpdated={(labelId, labelData) => {
            // Refresh the labels display by updating the key
            setLabelsRefreshKey((prev) => prev + 1);
            // Refresh activities to show the label change activity
            fetchActivities();
            // Notify parent component to refresh board data
            onLabelsUpdated?.(labelId, labelData);
          }}
        />

        {/* Save Warning Modal */}
        {showSaveWarningModal && (
          <div className='fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4'>
            <div className='bg-card rounded-xl shadow-2xl border border-border max-w-md w-full'>
              <div className='p-6'>
                <div className='flex items-center gap-3 mb-4'>
                  <div className='w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center'>
                    <div className='w-3 h-3 bg-amber-500 rounded-full animate-pulse'></div>
                  </div>
                  <div>
                    <h3 className='text-lg font-semibold text-foreground'>
                      Saving in Progress
                    </h3>
                    <p className='text-sm text-muted-foreground'>
                      Please wait for changes to save
                    </p>
                  </div>
                </div>

                <p className='text-sm text-foreground mb-6'>
                  Some changes are still being saved. Closing now may result in
                  data loss. Would you like to wait for the save operations to
                  complete or close anyway?
                </p>

                <div className='flex gap-3 justify-end'>
                  <button
                    onClick={handleCancelClose}
                    className='px-4 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-md transition-colors'
                  >
                    Wait for Save
                  </button>
                  <button
                    onClick={handleForceClose}
                    className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors'
                  >
                    <X className='w-4 h-4' />
                    Close Anyway
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Card Member Picker Modal */}
        <CardMemberPicker
          isOpen={showMemberPicker}
          onClose={() => setShowMemberPicker(false)}
          workspaceId={workspaceId}
          boardId={card.board_id}
          cardId={card.id}
          currentMembers={cardMembers}
          onMemberAdded={handleMemberAdded}
          autoCloseAfterAdd={false}
          allowMultipleSelections={true}
        />

        {/* Attachment Modal */}
        <AttachmentModal
          isOpen={showAttachmentModal}
          onClose={() => {
            setShowAttachmentModal(false);
            setEditingAttachment(null);
          }}
          onAddAttachment={handleAddAttachment}
          onUpdateAttachment={handleUpdateAttachment}
          isLoading={isAddingAttachment}
          editingAttachment={editingAttachment}
        />

        {/* Move Card Modal */}
        {showMoveModal && (
          <>
            {/* Backdrop */}
            <div
              className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[70]'
              onClick={() => !isMovingCard && setShowMoveModal(false)}
            />

            <div className='fixed inset-0 z-[80] flex items-center justify-center p-4 pointer-events-none'>
              <div className='bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200 pointer-events-auto'>
                {/* Header */}
                <div className='bg-gradient-to-r from-primary to-primary/90 px-6 py-4'>
                  <div className='flex items-center justify-between text-white'>
                    <div className='flex items-center gap-3'>
                      <div className='w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center'>
                        <Move className='w-4 h-4' />
                      </div>
                      <div>
                        <h3 className='text-lg font-semibold'>Move Card</h3>
                        <p className='text-sm text-white/80'>
                          Choose destination list
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowMoveModal(false)}
                      className='p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200'
                      title='Close modal'
                      aria-label='Close modal'
                      disabled={isMovingCard}
                    >
                      <X className='w-5 h-5' />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className='p-6'>
                  {isLoadingLists ? (
                    <div className='flex items-center justify-center py-12'>
                      <div className='flex items-center gap-3'>
                        <div className='w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin' />
                        <span className='text-sm text-muted-foreground font-medium'>
                          Loading lists...
                        </span>
                      </div>
                    </div>
                  ) : availableLists.length === 0 ? (
                    <div className='text-center py-12'>
                      <div className='w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4'>
                        <LayoutGrid className='w-8 h-8 text-muted-foreground' />
                      </div>
                      <p className='text-sm text-muted-foreground'>
                        No other lists available to move to
                      </p>
                    </div>
                  ) : (
                    <div className='space-y-4'>
                      {/* Current location info - more compact */}
                      <div className='text-sm text-muted-foreground'>
                        Moving from{' '}
                        <span className='font-medium text-foreground'>
                          "{listName}"
                        </span>
                      </div>

                      {/* List Selection */}
                      <div className='space-y-2'>
                        <label className='block text-sm font-medium text-foreground'>
                          Move to list
                        </label>

                        <div className='relative'>
                          <button
                            ref={dropdownButtonRef}
                            onClick={() =>
                              !isMovingCard &&
                              setIsListDropdownOpen(!isListDropdownOpen)
                            }
                            className='w-full bg-background border-2 border-border hover:border-primary/50 rounded-xl px-4 py-3 text-left flex items-center justify-between transition-all duration-200 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 group'
                            disabled={isMovingCard}
                          >
                            <div className='flex items-center gap-3'>
                              {selectedListId ? (
                                <>
                                  <div className='w-3 h-3 bg-gradient-to-r from-green-400 to-blue-500 rounded-full' />
                                  <span className='font-medium text-foreground'>
                                    {
                                      availableLists.find(
                                        (list) => list.id === selectedListId
                                      )?.name
                                    }
                                  </span>
                                  <span className='text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full'>
                                    {
                                      availableLists.find(
                                        (list) => list.id === selectedListId
                                      )?.cards_count
                                    }{' '}
                                    cards
                                  </span>
                                </>
                              ) : (
                                <>
                                  <div className='w-3 h-3 bg-muted rounded-full' />
                                  <span className='text-muted-foreground'>
                                    Choose a list...
                                  </span>
                                </>
                              )}
                            </div>
                            <ChevronDown
                              className={`w-5 h-5 text-muted-foreground transition-transform duration-200 group-hover:text-foreground ${
                                isListDropdownOpen ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {availableLists.length > 0 && (
                    <div className='flex gap-3 justify-end mt-8 pt-6 border-t border-border'>
                      <button
                        onClick={() => setShowMoveModal(false)}
                        className='px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all duration-200'
                        disabled={isMovingCard}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleMoveCard}
                        disabled={!selectedListId || isMovingCard}
                        className='px-6 py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2'
                      >
                        {isMovingCard ? (
                          <>
                            <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                            Moving...
                          </>
                        ) : (
                          <>
                            <Move className='w-4 h-4' />
                            Move Card
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Custom Dropdown - positioned outside modal to avoid clipping */}
        {showMoveModal && isListDropdownOpen && (
          <>
            <div
              className='fixed inset-0 z-[100]'
              onClick={() => setIsListDropdownOpen(false)}
            />
            <div
              className='fixed bg-card border-2 border-border rounded-xl shadow-2xl z-[101] overflow-hidden max-h-64 overflow-y-auto'
              style={{
                top: dropdownButtonRef.current
                  ? `${
                      dropdownButtonRef.current.getBoundingClientRect().bottom +
                      8
                    }px`
                  : '50%',
                left: dropdownButtonRef.current
                  ? `${
                      dropdownButtonRef.current.getBoundingClientRect().left
                    }px`
                  : '50%',
                width: dropdownButtonRef.current
                  ? `${
                      dropdownButtonRef.current.getBoundingClientRect().width
                    }px`
                  : '300px',
              }}
            >
              {availableLists.map((list, index) => (
                <button
                  key={list.id}
                  onClick={() => {
                    setSelectedListId(list.id);
                    setIsListDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-muted/80 transition-colors duration-200 flex items-center gap-3 border-b border-border/50 last:border-b-0 ${
                    selectedListId === list.id
                      ? 'bg-primary/10 dark:bg-primary/10'
                      : ''
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-full ${
                      index % 4 === 0
                        ? 'bg-gradient-to-r from-red-400 to-pink-500'
                        : index % 4 === 1
                        ? 'bg-gradient-to-r from-blue-400 to-purple-500'
                        : index % 4 === 2
                        ? 'bg-gradient-to-r from-green-400 to-blue-500'
                        : 'bg-gradient-to-r from-yellow-400 to-orange-500'
                    }`}
                  />
                  <div className='flex-1'>
                    <div className='font-medium text-foreground'>
                      {list.name}
                    </div>
                  </div>
                  <span className='text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full'>
                    {list.cards_count} cards
                  </span>
                  {selectedListId === list.id && (
                    <CheckCircle2 className='w-4 h-4 text-primary' />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
