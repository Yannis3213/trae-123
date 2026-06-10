import { writable } from 'svelte/store';
import type { User } from './types';

function createUserStore() {
	let initial: User | null = null;
	if (typeof localStorage !== 'undefined') {
		const saved = localStorage.getItem('coldchain_user');
		if (saved) {
			try {
				initial = JSON.parse(saved);
			} catch {
				initial = null;
			}
		}
	}

	const { subscribe, set, update } = writable<User | null>(initial);

	return {
		subscribe,
		set: (user: User | null) => {
			if (typeof localStorage !== 'undefined') {
				if (user) {
					localStorage.setItem('coldchain_user', JSON.stringify(user));
				} else {
					localStorage.removeItem('coldchain_user');
				}
			}
			set(user);
		},
		update
	};
}

export const userStore = createUserStore();
