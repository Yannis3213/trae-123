import { useEffect } from 'react';
import { useNavigate } from '@remix-run/react';
import { getCurrentUser } from '../utils/api';
import { ROLES } from '../constants';

export default function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }
    const redirectMap = {
      [ROLES.REGISTRAR]: '/registration',
      [ROLES.SUPERVISOR]: '/verification',
      [ROLES.REVIEWER]: '/archiving'
    };
    navigate(redirectMap[user.role] || '/ledger');
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500">正在跳转...</div>
    </div>
  );
}
