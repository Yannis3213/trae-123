type Role = 'agent' | 'supervisor' | 'manager';

const ROLE_LABELS: Record<Role, string> = {
  agent: '客服坐席',
  supervisor: '安检主管',
  manager: '运营负责人'
};

const ROLE_HANDLERS: Record<Role, string> = {
  agent: '坐席-张三',
  supervisor: '主管-李四',
  manager: '负责人-王五'
};

function createSharedState<T>(initial: T) {
  let value = $state<T>(initial);
  return {
    get value() { return value; },
    set value(v: T) { value = v; }
  };
}

export const currentRole = createSharedState<Role>('agent');
export const currentHandler = createSharedState<string>('坐席-张三');
export const selectedOrders = createSharedState<Set<string>>(new Set());
export const listRefreshSignal = createSharedState<number>(0);

export function triggerListRefresh() {
  listRefreshSignal.value = listRefreshSignal.value + 1;
}

export function setRole(role: Role) {
  currentRole.value = role;
  currentHandler.value = ROLE_HANDLERS[role];
}

export function toggleOrderSelection(id: string) {
  const next = new Set(selectedOrders.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedOrders.value = next;
}

export function clearSelection() {
  selectedOrders.value = new Set();
}

export function selectAllOrders(ids: string[]) {
  selectedOrders.value = new Set(ids);
}

export { ROLE_LABELS, type Role };
