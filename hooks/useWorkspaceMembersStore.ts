import { create } from 'zustand';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  profile_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
  profile: Profile;
}

export interface WorkspaceSettings {
  membership_restriction: 'anyone' | 'admins_only' | 'owner_only';
  board_creation_simplified: 'any_member' | 'admins_only' | 'owner_only';
  board_deletion_simplified: 'any_member' | 'admins_only' | 'owner_only';
}

export interface Workspace {
  id: string;
  name: string;
  color: string;
  owner_id: string;
  settings?: WorkspaceSettings;
}

export interface Invitation {
  id: string;
  workspace_id: string;
  email: string;
  role: 'admin' | 'member';
  invited_by: string;
  created_at: string;
  status: 'pending' | 'accepted' | 'declined';
}

interface WorkspaceMembersState {
  workspace: Workspace | null;
  members: WorkspaceMember[];
  invitations: Invitation[];
  settings: WorkspaceSettings | null;
  setWorkspace: (workspace: Workspace) => void;
  setMembers: (members: WorkspaceMember[]) => void;
  setInvitations: (invitations: Invitation[]) => void;
  setSettings: (settings: WorkspaceSettings) => void;
  addMember: (member: WorkspaceMember) => void;
  removeMember: (profileId: string) => void;
  updateMemberRole: (profileId: string, role: 'admin' | 'member') => void;
}

export const useWorkspaceMembersStore = create<WorkspaceMembersState>(
  (set) => ({
    workspace: null,
    members: [],
    invitations: [],
    settings: null,
    setWorkspace: (workspace) => set({ workspace }),
    setMembers: (members) => set({ members }),
    setInvitations: (invitations) => set({ invitations }),
    setSettings: (settings) => set({ settings }),
    addMember: (member) =>
      set((state) => ({ members: [...state.members, member] })),
    removeMember: (profileId) =>
      set((state) => ({
        members: state.members.filter((m) => m.profile_id !== profileId),
      })),
    updateMemberRole: (profileId, role) =>
      set((state) => ({
        members: state.members.map((m) =>
          m.profile_id === profileId ? { ...m, role } : m
        ),
      })),
  })
);
