'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Role } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  users: User[];
  switchUser: (userId: string) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USERS: User[] = [
  { id: 'clerk01', username: 'clerk01', name: '店员小王', role: 'shop_clerk', store: '朝阳大药房' },
  { id: 'clerk02', username: 'clerk02', name: '店员小李', role: 'shop_clerk', store: '海淀大药房' },
  { id: 'pharm01', username: 'pharm01', name: '执业药师张药师', role: 'pharmacist', store: '朝阳大药房' },
  { id: 'pharm02', username: 'pharm02', name: '执业药师刘药师', role: 'pharmacist', store: '海淀大药房' },
  { id: 'manager01', username: 'manager01', name: '区域经理陈经理', role: 'area_manager', store: '华北区域' },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUserId = typeof window !== 'undefined' 
      ? localStorage.getItem('userId') || 'clerk01' 
      : 'clerk01';
    const foundUser = DEMO_USERS.find(u => u.id === savedUserId) || DEMO_USERS[0];
    if (typeof window !== 'undefined') {
      localStorage.setItem('userId', foundUser.id);
    }
    setUser(foundUser);
    setLoading(false);
  }, []);

  const switchUser = (userId: string) => {
    const foundUser = DEMO_USERS.find(u => u.id === userId);
    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem('userId', userId);
    }
  };

  return (
    <AuthContext.Provider value={{ user, users: DEMO_USERS, switchUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
