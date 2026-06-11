import { defineStore } from 'pinia';
import request from '../utils/request';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: JSON.parse(localStorage.getItem('user') || 'null')
  }),
  
  getters: {
    isLoggedIn: (state) => !!state.token,
    userRole: (state) => state.user?.role || '',
    userName: (state) => state.user?.name || '',
    isRegistrar: (state) => state.user?.role === 'registrar',
    isAuditor: (state) => state.user?.role === 'auditor',
    isReviewer: (state) => state.user?.role === 'reviewer'
  },
  
  actions: {
    async login(username, password) {
      const res = await request.post('/auth/login', { username, password });
      this.token = res.data.token;
      this.user = res.data.user;
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      return res;
    },
    
    async logout() {
      try {
        await request.post('/auth/logout');
      } catch (e) {
        console.log('Logout API error:', e);
      }
      this.token = '';
      this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
    
    async getCurrentUser() {
      try {
        const res = await request.get('/auth/me');
        this.user = res.data;
        localStorage.setItem('user', JSON.stringify(res.data));
        return res;
      } catch (e) {
        if (e.response?.status === 401) {
          this.logout();
        }
        throw e;
      }
    },
    
    switchUser(username, password) {
      return this.login(username, password);
    }
  }
});
