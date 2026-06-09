import { writable } from 'svelte/store';

function createUserStore() {
  const saved = localStorage.getItem('user');
  const initial = saved ? JSON.parse(saved) : null;
  const { subscribe, set, update } = writable(initial);

  return {
    subscribe,
    login: (user) => {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('userId', user.id);
      set(user);
    },
    logout: () => {
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
      set(null);
    }
  };
}

export const currentUser = createUserStore();
