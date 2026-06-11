import { createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { getCurrentUser } from '../lib/api';
import Layout from '../components/Layout';
import TaskList from '../components/TaskList';

export default function TasksPage() {
  const navigate = useNavigate();
  const user = () => getCurrentUser();

  createEffect(() => {
    if (!user()) navigate('/login');
  });

  return (
    <Layout>
      <TaskList />
    </Layout>
  );
}
