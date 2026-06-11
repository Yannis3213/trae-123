import { writable } from 'svelte/store';
import type { Role, BatchResult } from './types';

export const currentRole = writable<Role>('pond_admin');

export const currentUser = writable<string>('张三');

currentRole.subscribe((role) => {
	const map: Record<Role, string> = {
		pond_admin: '张三',
		quality_engineer: '李工',
		base_director: '王主任'
	};
	currentUser.set(map[role]);
});

export const selectedInspections = writable<Set<string>>(new Set());

export const batchResults = writable<BatchResult[]>([]);

export const refreshTrigger = writable<number>(0);

export function triggerRefresh() {
	refreshTrigger.update((n) => n + 1);
}
