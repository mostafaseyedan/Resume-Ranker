import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/apiService';

export interface BoardMember {
  id: string;
  name: string;
  email: string;
  photoThumb: string | null;
  photoSmall: string | null;
}

export interface ResolvedUser {
  name: string;
  email?: string;
  photoUrl: string | null;
}

interface BoardMembersContextValue {
  members: BoardMember[];
  loading: boolean;
  resolveUser: (identifier?: string | null) => ResolvedUser;
}

const BoardMembersContext = createContext<BoardMembersContextValue | null>(null);

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export const BoardMembersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiService.getBoardMembers();
        if (!cancelled) {
          setMembers(data.members || []);
        }
      } catch (err) {
        console.warn('Board members unavailable:', err);
        if (!cancelled) setMembers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const lookup = useMemo(() => {
    const byEmail = new Map<string, BoardMember>();
    const byName = new Map<string, BoardMember>();
    const byId = new Map<string, BoardMember>();
    for (const m of members) {
      if (m.email) byEmail.set(normalizeKey(m.email), m);
      if (m.name) byName.set(normalizeKey(m.name), m);
      if (m.id) byId.set(String(m.id), m);
    }
    return { byEmail, byName, byId };
  }, [members]);

  const resolveUser = useCallback(
    (identifier?: string | null): ResolvedUser => {
      const raw = (identifier || '').trim();
      if (!raw) {
        return { name: 'Unknown', photoUrl: null };
      }

      const key = normalizeKey(raw);
      const member =
        lookup.byEmail.get(key) || lookup.byName.get(key) || lookup.byId.get(raw);

      if (member) {
        return {
          name: member.name || member.email || raw,
          email: member.email,
          photoUrl: member.photoSmall || member.photoThumb || null,
        };
      }

      if (raw.includes('@')) {
        const local = raw.split('@')[0].replace(/[._]/g, ' ');
        return { name: local, email: raw, photoUrl: null };
      }

      return { name: raw, photoUrl: null };
    },
    [lookup]
  );

  const value = useMemo(
    () => ({ members, loading, resolveUser }),
    [members, loading, resolveUser]
  );

  return <BoardMembersContext.Provider value={value}>{children}</BoardMembersContext.Provider>;
};

export function useBoardMembers(): BoardMembersContextValue {
  const ctx = useContext(BoardMembersContext);
  if (!ctx) {
    throw new Error('useBoardMembers must be used within BoardMembersProvider');
  }
  return ctx;
}

/** Safe when provider is optional (e.g. tests). */
export function useBoardMembersOptional(): BoardMembersContextValue | null {
  return useContext(BoardMembersContext);
}
