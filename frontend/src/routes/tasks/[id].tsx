import { createEffect } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { getCurrentUser } from '../lib/api';
import Layout from '../components/Layout';
import TaskDetail from '../components/TaskDetail';

export default function TaskDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const user = () => getCurrentUser();

  createEffect(() => {
    if (!user()) navigate('/login');
  });

  return (
    <Layout>
      <TaskDetail id={params.id} />
    </Layout>
  );
}
