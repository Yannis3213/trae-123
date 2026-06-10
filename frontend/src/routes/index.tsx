import { component$ } from '@builder.io/qwik';
import { useNavigate } from '@builder.io/qwik-city';
import { useVisibleTask$ } from '@builder.io/qwik';
import { api } from '~/utils/api';

export default component$(() => {
  const nav = useNavigate();

  useVisibleTask$(() => {
    const user = api.getCurrentUser();
    if (user) {
      nav('/dashboard');
    } else {
      nav('/login');
    }
  });

  return <div></div>;
});
