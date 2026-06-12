import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import type { UserInfo, UserRole } from '../types';

export function useUser() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    const resp = await api.getCurrentUser();
    if (resp.success && resp.data) {
      setUser(resp.data);
    }
    setLoading(false);
  }, []);

  const switchRole = useCallback(async (role: UserRole, username: string) => {
    const resp = await api.switchRole(role, username);
    if (resp.success && resp.data) {
      setUser(resp.data);
    }
    return resp;
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return { user, loading, switchRole, refreshUser: fetchUser };
}
