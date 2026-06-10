import { component$, Slot, useTask$, useStore, useVisibleTask$ } from '@builder.io/qwik';
import { useNavigate, useLocation } from '@builder.io/qwik-city';
import type { User } from '~/types';
import { api } from '~/utils/api';

interface AppState {
  user: User | null;
  loading: boolean;
}

export default component$(() => {
  const nav = useNavigate();
  const location = useLocation();
  const state = useStore<AppState>({ user: null, loading: true });

  useVisibleTask$(async () => {
    const user = api.getCurrentUser();
    state.user = user;
    state.loading = false;

    const publicPaths = ['/login'];
    if (!user && !publicPaths.some(p => location.url.pathname.startsWith(p))) {
      nav('/login');
    } else if (user && location.url.pathname === '/login') {
      nav('/dashboard');
    }
  });

  if (state.loading) {
    return (
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;">
        加载中...
      </div>
    );
  }

  return <Slot />;
});
