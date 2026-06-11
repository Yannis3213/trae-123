import { createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { getCurrentUser } from '../lib/api';
import Layout from '../components/Layout';
import AuditLogList from '../components/AuditLogList';

export default function AuditPage() {
  const navigate = useNavigate();
  const user = () => getCurrentUser();

  createEffect(() => {
    if (!user()) navigate('/login');
  });

  return (
    <Layout>
      <AuditLogList />
    </Layout>
  );
}
