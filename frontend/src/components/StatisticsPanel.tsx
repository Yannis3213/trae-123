import React, { useEffect, useState, useRef } from 'react';
import { Card, Row, Col, Statistic, Button, Space, Tag } from 'antd';
import {
  FileTextOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  SafetyOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { getStatistics } from '../api/application';
import type { Statistics } from '../types';

interface StatisticsPanelProps {
  onRefresh?: () => void;
}

const StatisticsPanel: React.FC<StatisticsPanelProps> = ({ onRefresh }) => {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);
  const refreshTickRef = useRef(0);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await getStatistics();
      setStats(res);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshTickRef.current += 1;
    fetchStats();
  }, []);

  const handleManualRefresh = () => {
    fetchStats();
    onRefresh?.();
  };

  if (!stats) {
    return <Card loading={loading}>加载中...</Card>;
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <span style={{ fontWeight: 600, fontSize: 16 }}>租约申请统计概览</span>
          <Tag color="cyan">实时刷新 #{refreshTickRef.current}</Tag>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={handleManualRefresh}>刷新数据</Button>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="总数"
              value={stats.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="待核验"
              value={stats.pending_verification}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="核验失败"
              value={stats.verification_failed}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="核验完成"
              value={stats.verification_complete}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="正常"
              value={stats.normal_count}
              prefix={<SafetyOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="临期"
              value={stats.expiring_soon_count}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="逾期"
              value={stats.overdue_count}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default StatisticsPanel;
