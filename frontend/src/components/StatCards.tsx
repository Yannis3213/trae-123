import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import request from '../utils/request';
import type { StatisticsData } from '../../types';

interface StatCardsProps {
  data?: StatisticsData;
}

const StatCards: React.FC<StatCardsProps> = ({ data: propData }) => {
  const [data, setData] = useState<StatisticsData | null>(propData || null);
  const [loading, setLoading] = useState(!propData);

  useEffect(() => {
    if (!propData) {
      fetchData();
    }
  }, [propData]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await request.get<StatisticsData>('/statistics/summary');
      setData(result);
    } catch {
      console.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    { label: '案件总数', value: data?.total || 0, color: '#1890ff', trend: null },
    { label: '待提交', value: data?.pendingSubmit || 0, color: '#fa8c16', trend: null },
    { label: '审核中', value: data?.reviewing || 0, color: '#722ed1', trend: null },
    { label: '已完成', value: data?.completed || 0, color: '#52c41a', trend: null },
    { label: '已退回', value: data?.returned || 0, color: '#ff4d4f', trend: null },
    { label: '即将到期', value: data?.approaching || 0, color: '#faad14', trend: 'warning' },
    { label: '已逾期', value: data?.overdue || 0, color: '#ff4d4f', trend: 'danger' },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Spin />
      </div>
    );
  }

  return (
    <div className="stat-cards">
      {cards.map((card, index) => (
        <div key={index} className="stat-card">
          <div className="label">{card.label}</div>
          <div className="value" style={{ color: card.color }}>{card.value}</div>
          {card.trend && (
            <div className={`trend ${card.trend === 'danger' ? 'down' : 'up'}`}>
              {card.trend === 'danger' ? '需要及时处理' : '请关注'}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default StatCards;
