import React, { useEffect, useMemo, useState } from 'react';
import { Avatar } from '@vibe/core';
import { useMsal } from '@azure/msal-react';
import { useBoardMembersOptional } from '@/context/BoardMembersContext';
import { useGraphUserPhoto } from '@/hooks/useGraphUserPhoto';
import { getUserInitials } from '@/utils/userInitials';
import { cn } from '@/lib/utils';
import { radiusPill } from '@/lib/radius';

export interface UserAvatarProps {
  /** Email, display name, or Monday user id */
  userId?: string | null;
  name?: string | null;
  photoUrl?: string | null;
  size?: 'xs' | 'small' | 'medium' | 'large';
  className?: string;
  showName?: boolean;
  nameClassName?: string;
  title?: string;
}

const SYSTEM_LABELS: Record<string, { label: string; initials: string }> = {
  sharepoint: { label: 'SharePoint', initials: 'SP' },
  'current-user': { label: 'You', initials: 'ME' },
  monday_sync: { label: 'Monday', initials: 'M' },
};

const sizePx: Record<NonNullable<UserAvatarProps['size']>, number> = {
  xs: 24,
  small: 32,
  medium: 40,
  large: 48,
};

const UserAvatar: React.FC<UserAvatarProps> = ({
  userId,
  name,
  photoUrl: photoUrlProp,
  size = 'small',
  className,
  showName = false,
  nameClassName = 'text-xs text-gray-600 dark:text-ink-muted truncate',
  title,
}) => {
  const boardMembers = useBoardMembersOptional();
  const { accounts } = useMsal();
  const account = accounts[0];
  const [imgFailed, setImgFailed] = useState(false);

  const resolved = useMemo(() => {
    const raw = (userId || name || '').trim();
    const lower = raw.toLowerCase();

    if (lower === 'current-user' && account) {
      const email = account.username || '';
      return {
        name: account.name || email,
        email,
        photoUrl: null as string | null,
        initials: 'ME',
      };
    }

    if (SYSTEM_LABELS[lower]) {
      return {
        name: SYSTEM_LABELS[lower].label,
        photoUrl: null,
        initials: SYSTEM_LABELS[lower].initials,
      };
    }

    if (photoUrlProp) {
      return {
        name: name || raw || 'User',
        email: raw.includes('@') ? raw : undefined,
        photoUrl: photoUrlProp,
        initials: getUserInitials(name || raw, raw),
      };
    }

    if (boardMembers && !boardMembers.loading && raw) {
      const r = boardMembers.resolveUser(raw);
      return {
        name: name || r.name,
        email: r.email || (raw.includes('@') ? raw : undefined),
        photoUrl: r.photoUrl,
        initials: getUserInitials(name || r.name, r.email || raw),
      };
    }

    const fallbackName = name || raw || 'Unknown';
    return {
      name: fallbackName,
      email: raw.includes('@') ? raw : undefined,
      photoUrl: null as string | null,
      initials: getUserInitials(fallbackName, raw),
    };
  }, [userId, name, photoUrlProp, boardMembers?.loading, boardMembers, account]);

  const graphPhoto = useGraphUserPhoto(resolved.email);

  const displayPhotoUrl = useMemo(() => {
    if (imgFailed) return null;
    if (graphPhoto) return graphPhoto;
    return resolved.photoUrl;
  }, [graphPhoto, resolved.photoUrl, imgFailed]);

  useEffect(() => {
    setImgFailed(false);
  }, [displayPhotoUrl]);

  const displayName = resolved.name || 'Unknown';
  const initials = resolved.initials ?? getUserInitials(displayName, resolved.email);
  const tooltip =
    title ?? (resolved.email ? `${displayName} (${resolved.email})` : displayName);

  const px = sizePx[size];

  return (
    <div
      className={cn('flex items-center min-w-0', showName ? 'gap-2' : '', className)}
      title={!showName ? tooltip : undefined}
    >
      {displayPhotoUrl ? (
        <img
          src={displayPhotoUrl}
          alt=""
          width={px}
          height={px}
          className={cn('shrink-0 object-cover bg-gray-100 dark:bg-surface-raised', radiusPill)}
          style={{ width: px, height: px }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <Avatar
          size={size}
          type="text"
          text={initials}
          ariaLabel={displayName}
        />
      )}
      {showName && (
        <span className={nameClassName} title={tooltip}>
          {displayName}
        </span>
      )}
    </div>
  );
};

export default UserAvatar;
