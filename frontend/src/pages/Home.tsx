import { useNavigate } from 'react-router-dom';
import { User, Shield, Award } from 'lucide-react';
import { useAppStore } from '@/store';
import { useState } from 'react';

const roles = [
  {
    userId: 'u1',
    name: '张伟',
    title: '场馆前台',
    role: 'registrar',
    description: '负责场地预约订单的登记、录入和补正工作，是订单流程的起点。',
    icon: User,
    gradient: 'from-blue-500 to-blue-600',
  },
  {
    userId: 'u2',
    name: '李明',
    title: '运营主管',
    role: 'reviewer',
    description: '负责审核场地预约订单，确认信息无误后提交复核，或退回补正。',
    icon: Shield,
    gradient: 'from-purple-500 to-purple-600',
  },
  {
    userId: 'u3',
    name: '王芳',
    title: '场馆经理',
    role: 'approver',
    description: '负责最终审批确认，复核归档完成订单，或退回重新审核。',
    icon: Award,
    gradient: 'from-amber-500 to-amber-600',
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { switchRole } = useAppStore();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleEnter = async (userId: string) => {
    setLoadingId(userId);
    try {
      await switchRole(userId);
      navigate('/orders');
    } catch {
      setLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-primary to-primary-light flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent shadow-lg mb-6">
            <Award size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">体育场馆订单处理系统</h1>
          <p className="text-blue-200 text-lg">请选择您的角色进入系统</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {roles.map((role) => {
            const Icon = role.icon;
            const isLoading = loadingId === role.userId;
            return (
              <div
                key={role.userId}
                className="bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-shadow duration-300 group"
              >
                <div className={`h-2 bg-gradient-to-r ${role.gradient}`} />
                <div className="p-6">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${role.gradient} flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform`}>
                    <Icon size={28} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{role.name}</h3>
                  <p className="text-sm text-primary font-medium mb-3">{role.title}</p>
                  <p className="text-sm text-gray-500 mb-6 leading-relaxed">{role.description}</p>
                  <button
                    onClick={() => handleEnter(role.userId)}
                    disabled={isLoading}
                    className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isLoading ? '正在进入...' : '进入系统'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
