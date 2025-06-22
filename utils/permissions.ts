type WorkspaceSettings = {
  membership_restriction: 'anyone' | 'admins_only' | 'owner_only';
  board_creation_simplified: 'any_member' | 'admins_only' | 'owner_only';
  board_deletion_simplified: 'any_member' | 'admins_only' | 'owner_only';
};

export function canUserCreateBoards(
  workspaceSettings: WorkspaceSettings | null,
  userRole: 'owner' | 'admin' | 'member'
): boolean {
  if (!workspaceSettings) {
    // Default to admin/owner only if settings not loaded
    return userRole === 'owner' || userRole === 'admin';
  }

  const boardCreationSetting = workspaceSettings.board_creation_simplified;

  switch (boardCreationSetting) {
    case 'owner_only':
      return userRole === 'owner';
    case 'admins_only':
      return userRole === 'owner' || userRole === 'admin';
    case 'any_member':
      return (
        userRole === 'owner' || userRole === 'admin' || userRole === 'member'
      );
    default:
      return userRole === 'owner' || userRole === 'admin';
  }
}

export function canUserDeleteBoards(
  workspaceSettings: WorkspaceSettings | null,
  userRole: 'owner' | 'admin' | 'member'
): boolean {
  if (!workspaceSettings) {
    return userRole === 'owner' || userRole === 'admin';
  }

  const boardDeletionSetting = workspaceSettings.board_deletion_simplified;

  switch (boardDeletionSetting) {
    case 'owner_only':
      return userRole === 'owner';
    case 'admins_only':
      return userRole === 'owner' || userRole === 'admin';
    case 'any_member':
      return (
        userRole === 'owner' || userRole === 'admin' || userRole === 'member'
      );
    default:
      return userRole === 'owner' || userRole === 'admin';
  }
}

export function canUserInviteMembers(
  workspaceSettings: WorkspaceSettings | null,
  userRole: 'owner' | 'admin' | 'member'
): boolean {
  if (!workspaceSettings) {
    return userRole === 'owner' || userRole === 'admin';
  }

  const membershipRestriction = workspaceSettings.membership_restriction;

  switch (membershipRestriction) {
    case 'owner_only':
      return userRole === 'owner';
    case 'admins_only':
      return userRole === 'owner' || userRole === 'admin';
    case 'anyone':
      return (
        userRole === 'owner' || userRole === 'admin' || userRole === 'member'
      );
    default:
      return userRole === 'owner' || userRole === 'admin';
  }
}
