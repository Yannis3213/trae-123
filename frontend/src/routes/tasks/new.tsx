import { createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { getCurrentUser } from '../lib/api';
import Layout from '../components/Layout';
import CreateTask from '../components/CreateTask';

export default function NewTaskPage() {
  const navigate = useNavigate();
  const user = () => getCurrentUser();

  createEffect(() => {
    if (!user()) navigate('/login');
  });

  return (
    <Layout>
      <CreateTask />
    </Layout>
  );
}
