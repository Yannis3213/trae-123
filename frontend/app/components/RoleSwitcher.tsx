import { ROLE_LABELS } from "~/utils/status";
import type { UserRole } from "~/utils/status";

interface RoleSwitcherProps {
  currentUserId: string;
  onSwitch: (userId: string) => void;
}

const DEMO_USERS: { id: string; name: string; role: UserRole; label: string }[] = [
  { id: "zhangsan", name: "张三", role: "creative_registrar", label: "创意需求登记员" },
  { id: "lisi", name: "李四", role: "review_supervisor", label: "创意需求审核主管" },
  { id: "wangwu", name: "王五", role: "review_manager", label: "广告代理公司复核负责人" },
];

export default function RoleSwitcher({ currentUserId, onSwitch }: RoleSwitcherProps) {
  const currentUser = DEMO_USERS.find((u) => u.id === currentUserId) || DEMO_USERS[0];

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg p-1">
        {DEMO_USERS.map((user) => (
          <button
            key={user.id}
            onClick={() => onSwitch(user.id)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              user.id === currentUserId
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${
                user.id === currentUserId ? "bg-blue-600" : "bg-gray-400"
              }`} />
              <span>{user.name}</span>
              <span className="text-xs opacity-60">({ROLE_LABELS[user.role]})</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
