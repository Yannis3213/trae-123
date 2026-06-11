import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Spin, message, Space } from 'antd';
import { 
  FileTextOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  WarningOutlined,
  ExclamationCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined
} from '@ant-design/icons';
import { statisticsApi } from '../utils/api';
import WarningBadge from './WarningBadge';
import type { StatisticsData } from '../../types';

interface DashboardStatsProps {
  onStatClick?: (filter: { status?: string; warning?: string }) => void;
}

export default function DashboardStats({ onStatClick }: DashboardStatsProps) {
  const [stats, setStats] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const result = await statisticsApi.getStats();
      setStats(result);
    } catch (error) {
      message.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      title: '案件总数',
      value: stats.total,
      icon: <FileTextOutlined style={{ color: '#1890ff', fontSize: 24 }} />,
      color: '#1890ff',
      onClick: () => onStatClick?.({}),
      trend: stats.total > 100 ? 'up' : 'down',
      trendValue: '12%',
    },
    {
      title: '待提交',
      value: stats.pending_submit,
      icon: <ClockCircleOutlined style={{ color: '#faad14', fontSize: 24 }} />,
      color: '#faad14',
      onClick: () => onStatClick?.({ status: 'pending_submit' }),
    },
    {
      title: '已退回',
      value: stats.returned,
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 24 }} />,
      color: '#ff4d4f',
      onClick: () => onStatClick?.({ status: 'returned' }),
    },
    {
      title: '审核中',
      value: stats.reviewing,
      icon: <WarningOutlined style={{ color: '#722ed1', fontSize: 24 }} />,
      color: '#722ed1',
      onClick: () => onStatClick?.({ status: 'reviewing' }),
    },
    {
      title: '已完成',
      value: stats.completed,
      icon: <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />,
      color: '#52c41a',
      onClick: () => onStatClick?.({ status: 'completed' }),
    },
  ];

  const warningCards = [
    {
      status: 'normal' as const,
      title: '正常',
      value: stats.normal,
      color: '#52c41a',
      onClick: () => onStatClick?.({ warning: 'normal' }),
    },
    {
      status: 'approaching' as const,
      title: '临期',
      value: stats.approaching,
      color: '#faad14',
      onClick: () => onStatClick?.({ warning: 'approaching' }),
    },
    {
      status: 'overdue' as const,
      title: '逾期',
      value: stats.overdue,
      color: '#ff4d4f',
      onClick: () => onStatClick?.({ warning: 'overdue' }),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {statCards.map((card, index) => (
          <Col xs={24} sm={12} md={8} lg={4} key={index}>
            <Card 
              hoverable 
              onClick={card.onClick}
              style={{ 
                cursor: 'pointer',
                borderRadius: 8,
                border: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}
              bodyStyle={{ padding: 20 }}
            >
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#666', fontSize: 14 }}>{card.title}</span>
                  {card.icon}
                </div>
                <Statistic 
                  value={card.value} 
                  valueStyle={{ color: card.color, fontSize: 28, fontWeight: 'bold' }}
                />
                {card.trend && (
                  <Space size={4} style={{ fontSize: 12 }}>
                    {card.trend === 'up' ? (
                      <ArrowUpOutlined style={{ color: '#ff4d4f' }} />
                    ) : (
                      <ArrowDownOutlined style={{ color: '#52c41a' }} />
                    )}
                    <span style={{ color: card.trend === 'up' ? '#ff4d4f' : '#52c41a' }}>
                      {card.trendValue}
                    </span>
                    <span style={{ color: '#999' }}>较上周</span>
                  </Space>
                )}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        {warningCards.map((card, index) => (
          <Col xs={24} sm={8} key={index}>
            <Card 
              hoverable
              onClick={card.onClick}
              style={{ 
                cursor: 'pointer',
                borderRadius: 8,
                border: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}
              bodyStyle={{ padding: 20 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space size={12}>
                  <WarningBadge status={card.status} showLabel={false} />
                  <span style={{ fontSize: 16, fontWeight: 500 }}>{card.title}</span>
                </Space>
                <Statistic 
                  value={card.value} 
                  valueStyle={{ color: card.color, fontSize: 24, fontWeight: 'bold', margin: 0 }}
                />
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
