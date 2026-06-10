'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import { Role, ROLE_DISPLAY, ROLE_OPERATORS } from '@/types';

interface RoleContextValue {
  currentRole: Role;
  currentOperator: string;
  setCurrentRole: (role: Role) => void;
  setCurrentOperator: (name: string) => void;
  roleDisplayName: string;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentRole, setCurrentRole] = useState<Role>('circulation_librarian');
  const [currentOperator, setCurrentOperator] = useState<string>(ROLE_OPERATORS['circulation_librarian']);

  const roleDisplayName = useMemo(() => ROLE_DISPLAY[currentRole], [currentRole]);

  return (
    <RoleContext.Provider
      value={{ currentRole, currentOperator, setCurrentRole, setCurrentOperator, roleDisplayName }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used inside RoleProvider');
  return ctx;
}
