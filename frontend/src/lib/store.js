import { writable, derived } from 'svelte/store';
import { api } from './api.js';

function createUserStore() {
	const { subscribe, set, update } = writable(null);
	
	return {
		subscribe,
		login: async (username, password) => {
			const res = await api.login(username, password);
			if (res.success && res.data) {
				localStorage.setItem('token', res.data.token);
				set(res.data.user);
				return res.data.user;
			}
			throw new Error(res.message || '登录失败');
		},
		logout: () => {
			localStorage.removeItem('token');
			set(null);
		},
		loadUser: async () => {
			try {
				const token = localStorage.getItem('token');
				if (!token) return null;
				const res = await api.getMe();
				if (res.success && res.data) {
					set(res.data);
					return res.data;
				}
				return null;
			} catch (e) {
				localStorage.removeItem('token');
				set(null);
				return null;
			}
		},
		setUser: (user) => set(user)
	};
}

export const userStore = createUserStore();

export const currentRole = derived(userStore, ($user) => {
	if (!$user || !$user.roles || $user.roles.length === 0) return null;
	return $user.roles[0];
});

export const hasRole = (role) => {
	let user;
	userStore.subscribe(u => user = u)();
	return user && user.roles && user.roles.includes(role);
};
