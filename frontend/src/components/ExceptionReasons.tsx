import React, { useState, useEffect } from 'react';
import { List, Card, Spin, message, Empty, Tag, Space, Typography, Alert } from 'antd';
import { 
  WarningOutlined, 
  UserOutlined, 
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { caseApi } from '../utils/api';
import type { ExceptionReason } from '../../types';

const { Text, Paragraph } = Typography;

interface ExceptionReasonsProps {
  caseId: number;
}

const exceptionTypeMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  incomplete: { label: '信息不完整', color: 'warning', icon: <WarningOutlined /> },
  incorrect: { label: '信息错误', color: 'error', icon: <ExclamationCircleOutlined /> },
  missing_document: { label: '缺少材料', color: 'warning', icon: <WarningOutlined /> },
  invalid: { label: '无效数据', color: 'error', icon: <ExclamationCircleOutlined /> },
  other: { label: '其他', color: 'default', icon: <InfoCircleOutlined /> },
};

const moduleMap: Record<string, string> = {
  registration: '咨询登记',
  assignment: '案件分派',
  followup: '回访确认',
  case: '案件信息',
};

export default function ExceptionReasons({ caseId }: ExceptionReasonsProps) {
  const [reasons, setReasons] = useState<ExceptionReason[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (caseId) {
      fetchReasons();
    }
  }, [caseId]);

  const fetchReasons = async () => {
    setLoading(true);
    try {
      const response = await caseApi.getExceptionReasons(caseId);
      setReasons(response.data || []);
    } catch (error) {
      message.error('获取异常原因失败');
    } finally {
      setLoading(false);
    }
  };

  const getExceptionTypeConfig = (type: string) => {
    return exceptionTypeMap[type] || exceptionTypeMap.other;
  };

  if (loading) {
    return (
      <Card title="异常原因">
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin />
        </div>
      </Card>
    );
  }

  if (reasons.length === 0) {
    return (
      <Card 
        title={
          <Space>
            <WarningOutlined />
            异常原因
          </Space>
        }
      >
        <Alert
          type="success"
          showIcon
          message="暂无异常记录"
          description="该案件目前没有异常原因记录"
        />
      </Card>
    );
  }

  return (
    <Card 
      title={
        <Space>
          <WarningOutlined style={{ color: '#faad14' }} />
          异常原因
        </Space>
      }
      extra={
        <Tag color="error">
          {reasons.length} 项异常
        </Tag>
      }
    >
      <Alert
        type="warning"
        showIcon
        message="存在异常需要处理"
        description={`该案件共有 ${reasons.length} 项异常原因，请检查并修正`}
        style={{ marginBottom: 16 }}
      />
      <List
        dataSource={reasons}
        renderItem={(reason) => {
          const typeConfig = getExceptionTypeConfig(reason.exceptionType);
          return (
            <List.Item
              key={reason.id}
              style={{ 
                borderBottom: '1px solid #f0f0f0',
                padding: '12px 0',
                alignItems: 'flex-start'
              }}
            >
              <List.Item.Meta
                avatar={
                  <div style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: '50%', 
                    background: '#fff2e8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: typeConfig.color === 'error' ? '#ff4d4f' : '#faad14'
                  }}>
                    {typeConfig.icon}
                  </div>
                }
                title={
                  <Space size={8} wrap>
                    <Tag color={typeConfig.color as any}>
                      {typeConfig.label}
                    </Tag>
                    {reason.module && (
                      <Tag color="blue">{moduleMap[reason.module] || reason.module}</Tag>
                    )}
                  </Space>
                }
                description={
                  <div>
                    <Paragraph style={{ margin: '8px 0', whiteSpace: 'pre-wrap' }}>
                      {reason.reason}
                    </Paragraph>
                    <Space size={16} style={{ fontSize: 12, color: '#999' }}>
                      <Space size={4}>
                        <UserOutlined />
                        <span>{reason.operatorName || '系统'}</span>
                      </Space>
                      <Space size={4}>
                        <ClockCircleOutlined />
                        <span>{dayjs(reason.createdAt).format('YYYY-MM-DD HH:mm:ss')}</span>
                      </Space>
                    </Space>
                  </div>
                }
              />
            </List.Item>
          );
        }}
      />
    </Card>
  );
}
