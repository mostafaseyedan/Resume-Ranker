/** Display initials for avatar fallback (e.g. "Mohammad Alsayyedan" -> "MA"). */
export function getUserInitials(name: string, email?: string): string {
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/).filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }
  if (trimmed.length >= 2) {
    return trimmed.slice(0, 2).toUpperCase();
  }
  if (email?.includes('@')) {
    const local = email.split('@')[0];
    if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  }
  return '?';
}

export function isMondayGeneratedInitialsPhoto(url: string | null | undefined): boolean {
  return Boolean(url && url.includes('user_photo_initials'));
}
