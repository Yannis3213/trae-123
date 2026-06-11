import { createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { getCurrentUser } from '../lib/api';
import Layout from '../components/Layout';
import OverdueQueue from '../components/OverdueQueue';

export default function OverduePage() {
  const navigate = useNavigate();
  const user = () => getCurrentUser();

  createEffect(() => {
    if (!user()) navigate('/login');
  });

  return (
    <Layout>
      <OverdueQueue />
    </Layout>
  );
}
