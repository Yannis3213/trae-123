'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { UserRole, ROLE_LABELS } from '@/types';

interface RoleContextType {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  currentUserName: string;
  refreshTrigger: number;
  triggerRefresh: () => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

const defaultUserNames: Record<UserRole, string> = {
  sampling_registrar: '张登记',
  sampling_supervisor: '李主管',
  factory_reviewer: '王厂长',
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentRole, setCurrentRole] = useState<UserRole>('sampling_registrar');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const value = {
    currentRole,
    setCurrentRole,
    currentUserName: defaultUserNames[currentRole],
    refreshTrigger,
    triggerRefresh,
  };

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
