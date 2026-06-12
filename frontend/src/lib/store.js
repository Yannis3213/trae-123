import { writable, derived, get } from 'svelte/store';
import { api, setActingRole, getActingRole } from './api.js';

function createUserStore() {
	const { subscribe, set, update } = writable(null);
	
	return {
		subscribe,
		login: async (username, password) => {
			const res = await api.login(username, password);
			if (res.success && res.data) {
				localStorage.setItem('token', res.data.token);
				set(res.data.user);
				if (res.data.user && res.data.user.roles && res.data.user.roles.length > 0) {
					setActingRole(res.data.user.roles[0]);
				}
				return res.data.user;
			}
			throw new Error(res.message || '登录失败');
		},
		logout: () => {
			localStorage.removeItem('token');
			setActingRole(null);
			set(null);
		},
		loadUser: async () => {
			try {
				const token = localStorage.getItem('token');
				if (!token) return null;
				const res = await api.getMe();
				if (res.success && res.data) {
					set(res.data);
					const existingRole = getActingRole();
					if (!existingRole || (res.data.roles && !res.data.roles.includes(existingRole))) {
						if (res.data.roles && res.data.roles.length > 0) {
							setActingRole(res.data.roles[0]);
						}
					}
					return res.data;
				}
				return null;
			} catch (e) {
				localStorage.removeItem('token');
				setActingRole(null);
				set(null);
				return null;
			}
		},
		setUser: (user) => set(user)
	};
}

export const userStore = createUserStore();

function createCurrentRoleStore() {
	const initial = getActingRole();
	const { subscribe, set } = writable(initial);
	
	return {
		subscribe,
		set: (role) => {
			setActingRole(role);
			set(role);
		}
	};
}

export const currentRole = createCurrentRoleStore();

export const hasRole = (role) => {
	const user = get(userStore);
	return user && user.roles && user.roles.includes(role);
};

export const switchRole = (role) => {
	const user = get(userStore);
	if (user && user.roles && user.roles.includes(role)) {
		currentRole.set(role);
		return true;
	}
	return false;
};
