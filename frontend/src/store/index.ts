import { create } from 'zustand';
import type { User, VenueOrder, AuditLog, BatchResult } from '@/types';
import * as api from '@/api';

interface EvidenceFields {
  paymentAmount?: number | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  paymentVerification?: string | null;
  admissionStatus?: string | null;
  admissionConfirmation?: string | null;
  exceptionReason?: string | null;
  responsibleNode?: string | null;
  auditRemark?: string | null;
}

interface AppStore {
  currentUser: User | null;
  orders: VenueOrder[];
  currentOrder: VenueOrder | null;
  warningOrders: { normal: VenueOrder[]; approaching: VenueOrder[]; overdue: VenueOrder[] };
  auditLogs: AuditLog[];
  batchResults: BatchResult[];
  loading: boolean;
  error: string | null;

  switchRole: (userId: string) => Promise<void>;
  fetchOrders: (filters?: { status?: string; warningLevel?: string; role?: string }) => Promise<void>;
  fetchOrder: (id: string) => Promise<void>;
  createOrder: (data: Partial<VenueOrder> & EvidenceFields) => Promise<VenueOrder | null>;
  correctOrder: (id: string, data: { version: number; correctReason: string; venueName?: string; courtName?: string; reservationDate?: string; timeSlot?: string; applicantName?: string; applicantPhone?: string; deadline?: string } & EvidenceFields) => Promise<void>;
  reviewOrder: (id: string, data: { version: number; action: string; opinion: string } & EvidenceFields) => Promise<void>;
  approveOrder: (id: string, data: { version: number; action: string; opinion: string } & EvidenceFields) => Promise<void>;
  returnOrder: (id: string, data: { version: number; returnOpinion: string } & EvidenceFields) => Promise<void>;
  batchReview: (ids: string[], data: { action: string; opinion: string; ordersWithVersions?: { id: string; version: number }[] } & EvidenceFields) => Promise<void>;
  batchApprove: (ids: string[], data: { action: string; opinion: string; ordersWithVersions?: { id: string; version: number }[] } & EvidenceFields) => Promise<void>;
  fetchWarnings: () => Promise<void>;
  fetchAuditLogs: (filters?: { orderId?: string; operator?: string }) => Promise<void>;
  clearError: () => void;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return '操作失败';
}

export const useAppStore = create<AppStore>((set) => ({
  currentUser: null,
  orders: [],
  currentOrder: null,
  warningOrders: { normal: [], approaching: [], overdue: [] },
  auditLogs: [],
  batchResults: [],
  loading: false,
  error: null,

  switchRole: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const user = await api.switchRole(userId);
      set({ currentUser: user, loading: false });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err), loading: false });
    }
  },

  fetchOrders: async (filters?) => {
    set({ loading: true, error: null });
    try {
      const orders = await api.getOrders(filters);
      set({ orders, loading: false });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err), loading: false });
    }
  },

  fetchOrder: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const order = await api.getOrder(id);
      set({ currentOrder: order, loading: false });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err), loading: false });
    }
  },

  createOrder: async (data) => {
    set({ loading: true, error: null });
    try {
      const order = await api.createOrder(data);
      set((state) => ({ orders: [order, ...state.orders], loading: false }));
      return order;
    } catch (err: unknown) {
      set({ error: getErrorMessage(err), loading: false });
      return null;
    }
  },

  correctOrder: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const order = await api.correctOrder(id, data);
      set({ currentOrder: order, loading: false });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err), loading: false });
    }
  },

  reviewOrder: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const order = await api.reviewOrder(id, data);
      set({ currentOrder: order, loading: false });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err), loading: false });
    }
  },

  approveOrder: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const order = await api.approveOrder(id, data);
      set({ currentOrder: order, loading: false });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err), loading: false });
    }
  },

  returnOrder: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const order = await api.returnOrder(id, data);
      set({ currentOrder: order, loading: false });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err), loading: false });
    }
  },

  batchReview: async (ids, data) => {
    set({ loading: true, error: null });
    try {
      const results = await api.batchReview({ orderIds: ids, ...data });
      set({ batchResults: results, loading: false });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err), loading: false });
    }
  },

  batchApprove: async (ids, data) => {
    set({ loading: true, error: null });
    try {
      const results = await api.batchApprove({ orderIds: ids, ...data });
      set({ batchResults: results, loading: false });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err), loading: false });
    }
  },

  fetchWarnings: async () => {
    set({ loading: true, error: null });
    try {
      const warningOrders = await api.getWarnings();
      set({ warningOrders, loading: false });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err), loading: false });
    }
  },

  fetchAuditLogs: async (filters?) => {
    set({ loading: true, error: null });
    try {
      const auditLogs = await api.getAuditLogs(filters);
      set({ auditLogs, loading: false });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err), loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
