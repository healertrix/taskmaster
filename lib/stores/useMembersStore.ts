import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  WorkspaceMember,
  Profile,
} from '@/hooks/queries/useWorkspaceMembersQuery';

interface MembersState {
  // Cache for workspace members
  membersCache: Record<string, WorkspaceMember[]>;

  // Cache for profile search results
  searchCache: Record<string, Profile[]>;

  // UI state
  selectedMember: Profile | null;
  addMemberRole: 'admin' | 'member';
  searchQuery: string;

  // Modal states
  showAddMemberModal: boolean;
  showRemoveConfirm: boolean;
  showChangeRoleModal: boolean;
  memberToRemove: WorkspaceMember | null;
  memberToChangeRole: WorkspaceMember | null;
  newRole: 'admin' | 'member';
  openMemberActions: string | null;

  // Loading states
  isSearching: boolean;
  isAddingMember: boolean;
  isRemovingMember: boolean;
  isChangingRole: boolean;

  // Actions
  setMembersCache: (workspaceId: string, members: WorkspaceMember[]) => void;
  getMembersFromCache: (workspaceId: string) => WorkspaceMember[] | null;
  updateMemberInCache: (
    workspaceId: string,
    profileId: string,
    updates: Partial<WorkspaceMember>
  ) => void;
  removeMemberFromCache: (workspaceId: string, profileId: string) => void;
  addMemberToCache: (workspaceId: string, member: WorkspaceMember) => void;

  setSearchCache: (key: string, results: Profile[]) => void;
  getSearchFromCache: (key: string) => Profile[] | null;

  setSelectedMember: (member: Profile | null) => void;
  setAddMemberRole: (role: 'admin' | 'member') => void;
  setSearchQuery: (query: string) => void;

  setShowAddMemberModal: (show: boolean) => void;
  setShowRemoveConfirm: (show: boolean) => void;
  setShowChangeRoleModal: (show: boolean) => void;
  setMemberToRemove: (member: WorkspaceMember | null) => void;
  setMemberToChangeRole: (member: WorkspaceMember | null) => void;
  setNewRole: (role: 'admin' | 'member') => void;
  setOpenMemberActions: (id: string | null) => void;

  setIsSearching: (searching: boolean) => void;
  setIsAddingMember: (adding: boolean) => void;
  setIsRemovingMember: (removing: boolean) => void;
  setIsChangingRole: (changing: boolean) => void;

  // Reset functions
  resetAddMemberState: () => void;
  resetModals: () => void;
  clearCache: (workspaceId?: string) => void;
}

export const useMembersStore = create<MembersState>()(
  devtools(
    (set, get) => ({
      // Initial state
      membersCache: {},
      searchCache: {},
      selectedMember: null,
      addMemberRole: 'member',
      searchQuery: '',
      showAddMemberModal: false,
      showRemoveConfirm: false,
      showChangeRoleModal: false,
      memberToRemove: null,
      memberToChangeRole: null,
      newRole: 'member',
      openMemberActions: null,
      isSearching: false,
      isAddingMember: false,
      isRemovingMember: false,
      isChangingRole: false,

      // Cache actions
      setMembersCache: (workspaceId, members) =>
        set((state) => ({
          membersCache: {
            ...state.membersCache,
            [workspaceId]: members,
          },
        })),

      getMembersFromCache: (workspaceId) => {
        const state = get();
        return state.membersCache[workspaceId] || null;
      },

      updateMemberInCache: (workspaceId, profileId, updates) =>
        set((state) => {
          const members = state.membersCache[workspaceId];
          if (!members) return state;

          const updatedMembers = members.map((member) =>
            member.profile_id === profileId ? { ...member, ...updates } : member
          );

          return {
            membersCache: {
              ...state.membersCache,
              [workspaceId]: updatedMembers,
            },
          };
        }),

      removeMemberFromCache: (workspaceId, profileId) =>
        set((state) => {
          const members = state.membersCache[workspaceId];
          if (!members) return state;

          const updatedMembers = members.filter(
            (member) => member.profile_id !== profileId
          );

          return {
            membersCache: {
              ...state.membersCache,
              [workspaceId]: updatedMembers,
            },
          };
        }),

      addMemberToCache: (workspaceId, member) =>
        set((state) => {
          const members = state.membersCache[workspaceId] || [];
          const updatedMembers = [...members, member];

          return {
            membersCache: {
              ...state.membersCache,
              [workspaceId]: updatedMembers,
            },
          };
        }),

      setSearchCache: (key, results) =>
        set((state) => ({
          searchCache: {
            ...state.searchCache,
            [key]: results,
          },
        })),

      getSearchFromCache: (key) => {
        const state = get();
        return state.searchCache[key] || null;
      },

      // UI state setters
      setSelectedMember: (member) => set({ selectedMember: member }),
      setAddMemberRole: (role) => set({ addMemberRole: role }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      // Modal setters
      setShowAddMemberModal: (show) => set({ showAddMemberModal: show }),
      setShowRemoveConfirm: (show) => set({ showRemoveConfirm: show }),
      setShowChangeRoleModal: (show) => set({ showChangeRoleModal: show }),
      setMemberToRemove: (member) => set({ memberToRemove: member }),
      setMemberToChangeRole: (member) => set({ memberToChangeRole: member }),
      setNewRole: (role) => set({ newRole: role }),
      setOpenMemberActions: (id) => set({ openMemberActions: id }),

      // Loading state setters
      setIsSearching: (searching) => set({ isSearching: searching }),
      setIsAddingMember: (adding) => set({ isAddingMember: adding }),
      setIsRemovingMember: (removing) => set({ isRemovingMember: removing }),
      setIsChangingRole: (changing) => set({ isChangingRole: changing }),

      // Reset functions
      resetAddMemberState: () =>
        set({
          selectedMember: null,
          addMemberRole: 'member',
          searchQuery: '',
        }),

      resetModals: () =>
        set({
          showAddMemberModal: false,
          showRemoveConfirm: false,
          showChangeRoleModal: false,
          memberToRemove: null,
          memberToChangeRole: null,
          newRole: 'member',
          openMemberActions: null,
        }),

      clearCache: (workspaceId) =>
        set((state) => {
          if (workspaceId) {
            const { [workspaceId]: removed, ...restMembers } =
              state.membersCache;
            return { membersCache: restMembers };
          }
          return { membersCache: {}, searchCache: {} };
        }),
    }),
    {
      name: 'members-store',
    }
  )
);
 