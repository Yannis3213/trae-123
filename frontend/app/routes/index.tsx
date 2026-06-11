import { Component, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { user } from '~/store/auth';

const Index: Component = () => {
  const navigate = useNavigate();

  onMount(() => {
    if (user()) {
      navigate('/applications');
    } else {
      navigate('/login');
    }
  });

  return null;
};

export default Index;
