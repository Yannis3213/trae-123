import { Component, Show, onMount } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { useAuth } from '@/context/AuthContext';

const ProtectedRoute: Component<{ children: any }> = (props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  onMount(() => {
    if (!user()) {
      navigate('/login', { replace: true });
    }
  });

  return <Show when={user()}>{props.children}</Show>;
};

export default ProtectedRoute;
