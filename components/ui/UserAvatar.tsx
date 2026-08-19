'use client';

// Shared avatar rendering — same pattern already used ad hoc inside
// CardMemberPicker.tsx (photo if avatar_url is set, else initials on a
// solid circle), pulled out here so the homepage's Team tasks widget and
// /profile/tasks can both show assignee avatars without duplicating it a
// second and third time.
export function UserAvatar({
  profile,
  size = 24,
}: {
  profile: { full_name: string | null; avatar_url?: string | null };
  size?: number;
}) {
  const getInitials = () => {
    if (profile.full_name) {
      return profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return 'U';
  };

  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.full_name || 'User'}
        className='rounded-full object-cover flex-shrink-0 ring-2 ring-card'
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className='rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold flex-shrink-0 ring-2 ring-card'
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {getInitials()}
    </div>
  );
}
