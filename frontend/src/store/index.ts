import { create } from 'zustand';
import { api } from '@/utils/api';
import type { User, RepairOrder, WarningGroup, BatchResult, LedgerItem } from '@/types';
import { PRESET_USERS } from '@/types';

interface AppState {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  presetUsers: User[];

  repairOrders: RepairOrder[];
  currentOrder: RepairOrder | null;
  warnings: { normal: RepairOrder[]; approaching: RepairOrder[]; overdue: RepairOrder[] };
  ledgerItems: LedgerItem[];
  ledgerTotal: number;
  ordersTotal: number;

  loading: boolean;
  error: string | null;

  fetchOrders: (filters?: Record<string, string>) => Promise<void>;
  fetchOrderDetail: (id: string) => Promise<void>;
  createOrder: (data: Record<string, unknown>) => Promise<boolean>;
  createAndSubmitOrder: (data: Record<string, unknown>) => Promise<string | null>;
  updateOrder: (id: string, data: Record<string, unknown>) => Promise<boolean>;

  submitOrder: (id: string, version: number) => Promise<boolean>;
  processOrder: (id: string, version: number) => Promise<boolean>;
  verifyOrder: (id: string, version: number) => Promise<boolean>;
  reviewOrder: (id: string, version: number) => Promise<boolean>;
  archiveOrder: (id: string, version: number) => Promise<boolean>;
  returnOrder: (id: string, version: number, returnReason: string, returnOpinion: string) => Promise<boolean>;
  resubmitOrder: (id: string, version: number, correctionReason: string) => Promise<boolean>;

  batchAdvance: (items: Array<{ id: string; version: number }>) => Promise<BatchResult[] | null>;
  batchReturn: (items: Array<{ id: string; version: number }>, returnReason: string, returnOpinion: string) => Promise<BatchResult[] | null>;

  fetchWarnings: () => Promise<void>;
  fetchLedger: (filters?: Record<string, string>) => Promise<void>;

  uploadAttachment: (repairId: string, file: File, uploadedBy: string) => Promise<boolean>;
}

export const useStore = create<AppState>((set, get) => ({
  currentUser: PRESET_USERS[0],
  setCurrentUser: (user) => set({ currentUser: user }),
  presetUsers: PRESET_USERS,

  repairOrders: [],
  currentOrder: null,
  warnings: { normal: [], approaching: [], overdue: [] },
  ledgerItems: [],
  ledgerTotal: 0,
  ordersTotal: 0,

  loading: false,
  error: null,

  fetchOrders: async (filters) => {
    set({ loading: true, error: null });
    const res = await api.fetchOrders(filters);
    if (res.success) {
      const items = (Array.isArray(res.data) ? res.data : []) as RepairOrder[];
      set({ repairOrders: items, ordersTotal: res.total || items.length, loading: false });
    } else {
      set({ error: res.message, loading: false });
    }
  },

  fetchOrderDetail: async (id) => {
    set({ loading: true, error: null });
    const res = await api.fetchOrderDetail(id);
    if (res.success) {
      set({ currentOrder: res.data as RepairOrder, loading: false });
    } else {
      set({ error: res.message, loading: false });
    }
  },

  createOrder: async (data) => {
    set({ loading: true, error: null });
    const res = await api.createOrder(data);
    set({ loading: false });
    if (res.success) return true;
    set({ error: res.message });
    return false;
  },

  createAndSubmitOrder: async (data) => {
    set({ loading: true, error: null });
    const res = await api.createAndSubmitOrder(data);
    if (res.success) {
      const orderData = res.data as { id: string };
      set({ loading: false });
      return orderData.id;
    }
    set({ error: res.message, loading: false });
    return null;
  },

  updateOrder: async (id, data) => {
    set({ loading: true, error: null });
    const res = await api.updateOrder(id, data);
    set({ loading: false });
    if (res.success) return true;
    set({ error: res.message });
    return false;
  },

  submitOrder: async (id, version) => {
    const u = get().currentUser;
    if (!u) return false;
    set({ loading: true, error: null });
    const res = await api.submitOrder(id, u.id, u.role, version);
    if (res.success) {
      await get().fetchOrderDetail(id);
      return true;
    }
    set({ error: res.message, loading: false });
    return false;
  },

  processOrder: async (id, version) => {
    const u = get().currentUser;
    if (!u) return false;
    set({ loading: true, error: null });
    const res = await api.processOrder(id, u.id, u.role, version);
    if (res.success) {
      await get().fetchOrderDetail(id);
      return true;
    }
    set({ error: res.message, loading: false });
    return false;
  },

  verifyOrder: async (id, version) => {
    const u = get().currentUser;
    if (!u) return false;
    set({ loading: true, error: null });
    const res = await api.verifyOrder(id, u.id, u.role, version);
    if (res.success) {
      await get().fetchOrderDetail(id);
      return true;
    }
    set({ error: res.message, loading: false });
    return false;
  },

  reviewOrder: async (id, version) => {
    const u = get().currentUser;
    if (!u) return false;
    set({ loading: true, error: null });
    const res = await api.reviewOrder(id, u.id, u.role, version);
    if (res.success) {
      await get().fetchOrderDetail(id);
      return true;
    }
    set({ error: res.message, loading: false });
    return false;
  },

  archiveOrder: async (id, version) => {
    const u = get().currentUser;
    if (!u) return false;
    set({ loading: true, error: null });
    const res = await api.archiveOrder(id, u.id, u.role, version);
    if (res.success) {
      await get().fetchOrderDetail(id);
      return true;
    }
    set({ error: res.message, loading: false });
    return false;
  },

  returnOrder: async (id, version, returnReason, returnOpinion) => {
    const u = get().currentUser;
    if (!u) return false;
    set({ loading: true, error: null });
    const res = await api.returnOrder(id, u.id, u.role, version, returnReason, returnOpinion);
    if (res.success) {
      await get().fetchOrderDetail(id);
      return true;
    }
    set({ error: res.message, loading: false });
    return false;
  },

  resubmitOrder: async (id, version, correctionReason) => {
    const u = get().currentUser;
    if (!u) return false;
    set({ loading: true, error: null });
    const res = await api.resubmitOrder(id, u.id, u.role, version, correctionReason);
    if (res.success) {
      await get().fetchOrderDetail(id);
      return true;
    }
    set({ error: res.message, loading: false });
    return false;
  },

  batchAdvance: async (items) => {
    const u = get().currentUser;
    if (!u) return null;
    set({ loading: true, error: null });
    const payload = items.map((it) => ({
      id: it.id,
      handler_id: u.id,
      handler_role: u.role,
      version: it.version,
    }));
    const res = await api.batchAdvance(payload);
    set({ loading: false });
    if (res.success) return res.data as BatchResult[];
    set({ error: res.message });
    return null;
  },

  batchReturn: async (items, returnReason, returnOpinion) => {
    const u = get().currentUser;
    if (!u) return null;
    set({ loading: true, error: null });
    const payload = items.map((it) => ({
      id: it.id,
      handler_id: u.id,
      handler_role: u.role,
      version: it.version,
      return_reason: returnReason,
      return_opinion: returnOpinion,
    }));
    const res = await api.batchReturn(payload);
    set({ loading: false });
    if (res.success) return res.data as BatchResult[];
    set({ error: res.message });
    return null;
  },

  fetchWarnings: async () => {
    const res = await api.fetchWarnings();
    if (res.success) {
      const d = res.data as WarningGroup;
      set({
        warnings: {
          normal: (d.normal as RepairOrder[]) ?? [],
          approaching: (d.approaching as RepairOrder[]) ?? [],
          overdue: (d.overdue as RepairOrder[]) ?? [],
        },
      });
    }
  },

  fetchLedger: async (filters) => {
    set({ loading: true, error: null });
    const res = await api.fetchLedger(filters);
    if (res.success) {
      const items = (Array.isArray(res.data) ? res.data : []) as LedgerItem[];
      set({ ledgerItems: items, ledgerTotal: res.total || items.length, loading: false });
    } else {
      set({ error: res.message, loading: false });
    }
  },

  uploadAttachment: async (repairId, file, uploadedBy) => {
    set({ loading: true, error: null });
    const res = await api.uploadAttachment(repairId, file, uploadedBy);
    if (res.success) {
      await get().fetchOrderDetail(repairId);
      return true;
    }
    set({ error: res.message, loading: false });
    return false;
  },
}));
