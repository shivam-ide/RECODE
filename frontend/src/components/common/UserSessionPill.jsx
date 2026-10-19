import React from 'react';
import { useAuth } from '../../services/useAuth';

/**
 * UserSessionPill: Top-right navbar profile/session badge.
 * - When in Guest Session (isGuest === true or user === null):
 *   Renders blue cyan dot, exact text "Guest Session", and generic person icon.
 * - When Authenticated (isGuest === false and user !== null):
 *   Renders user's name and user initial badge.
 */
export default function UserSessionPill({
  className = '',
  onClick,
}) {
  const { user, isGuest, guestSessionId } = useAuth();

  const isActuallyGuest = isGuest || !user;

  // Name calculation
  const displayName = isActuallyGuest
    ? 'Guest Session'
    : (user.user_metadata?.full_name ||
       user.user_metadata?.name ||
       user.email?.split('@')[0] ||
       user.email ||
       'User');

  // Initial calculation
  const userInitial = !isActuallyGuest && user
    ? (user.user_metadata?.full_name || user.email || 'U').trim().charAt(0).toUpperCase()
    : null;

  return (
    <div
      id="headerUserBadge"
      onClick={onClick}
      className={`bg-[#212121] border border-[#303030] rounded-full pl-3 pr-1 py-1 flex items-center gap-2 hover:border-[#3F3F3F] transition-colors cursor-pointer select-none ${className}`}
      title={
        isActuallyGuest
          ? (guestSessionId ? `Guest Session ID: ${guestSessionId}` : 'Guest Session')
          : `Signed in as ${user.email}`
      }
    >
      {/* Cyan/Blue Dot */}
      <span className="w-1.5 h-1.5 rounded-full bg-[#02C8F0] shrink-0" />

      {/* Profile/Session Label */}
      <span
        className={`text-xs font-medium select-none truncate max-w-[130px] sm:max-w-[200px] ${
          isActuallyGuest ? 'text-[#AAAAAA]' : 'text-[#F1F1F1]'
        }`}
      >
        {displayName}
      </span>

      {/* Avatar Circle */}
      <div className="w-6 h-6 rounded-full bg-[#181818] border border-[#303030] flex items-center justify-center text-[#AAAAAA] shrink-0 overflow-hidden">
        {isActuallyGuest ? (
          <span
            className="material-symbols-outlined text-[15px] text-[#AAAAAA] leading-none select-none flex items-center justify-center"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}
          >
            person
          </span>
        ) : user?.user_metadata?.avatar_url ? (
          <img
            src={user.user_metadata.avatar_url}
            alt={displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="font-mono text-[11px] font-semibold text-[#02C8F0] leading-none">
            {userInitial}
          </span>
        )}
      </div>
    </div>
  );
}
