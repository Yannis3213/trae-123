import React, { useState, useEffect } from 'react';
import { List, Card, Spin, message, Empty, Tag, Space, Typography } from 'antd';
import { 
  AuditOutlined, 
  UserOutlined, 
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { caseApi } from '../utils/api';
import type { AuditNote } from '../../types';

const { Text, Paragraph } = Typography;

interface AuditNotesProps {
  caseId: number;
}

const auditTypeMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pass: { label: '通过', color: 'success', icon: <CheckCircleOutlined /> },
  reject: { label: '驳回', color: 'error', icon: <CloseCircleOutlined /> },
  warning: { label: '警告', color: 'warning', icon: <ExclamationCircleOutlined /> },
  comment: { label: '备注', color: 'default', icon: <AuditOutlined /> },
  info: { label: '信息', color: 'processing', icon: <AuditOutlined /> },
};

const moduleMap: Record<string, string> = {
  registration: '咨询登记',
  assignment: '案件分派',
  followup: '回访确认',
  case: '案件信息',
};

export default function AuditNotes({ caseId }: AuditNotesProps) {
  const [notes, setNotes] = useState<AuditNote[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (caseId) {
      fetchNotes();
    }
  }, [caseId]);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const response = await caseApi.getAuditNotes(caseId);
      setNotes(response.data || []);
    } catch (error) {
      message.error('获取审计备注失败');
    } finally {
      setLoading(false);
    }
  };

  const getAuditTypeConfig = (type: string) => {
    return auditTypeMap[type] || auditTypeMap.comment;
  };

  if (loading) {
    return (
      <Card title="审计备注">
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin />
        </div>
      </Card>
    );
  }

  return (
    <Card 
      title={
        <Space>
          <AuditOutlined />
          审计备注
        </Space>
      }
      extra={<span style={{ color: '#999' }}>共 {notes.length} 条</span>}
    >
      {notes.length === 0 ? (
        <Empty description="暂无审计备注" />
      ) : (
        <List
          dataSource={notes}
          renderItem={(note) => {
            const typeConfig = getAuditTypeConfig(note.auditType);
            return (
              <List.Item
                key={note.id}
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
                      background: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: typeConfig.color === 'success' ? '#52c41a' : 
                             typeConfig.color === 'error' ? '#ff4d4f' : 
                             typeConfig.color === 'warning' ? '#faad14' : '#1890ff'
                    }}>
                      {typeConfig.icon}
                    </div>
                  }
                  title={
                    <Space size={8} wrap>
                      <Tag color={typeConfig.color as any}>
                        {typeConfig.label}
                      </Tag>
                      {note.module && (
                        <Tag color="blue">{moduleMap[note.module] || note.module}</Tag>
                      )}
                    </Space>
                  }
                  description={
                    <div>
                      <Paragraph style={{ margin: '8px 0', whiteSpace: 'pre-wrap' }}>
                        {note.content}
                      </Paragraph>
                      <Space size={16} style={{ fontSize: 12, color: '#999' }}>
                        <Space size={4}>
                          <UserOutlined />
                          <span>{note.operatorName || '系统'}</span>
                        </Space>
                        <Space size={4}>
                          <ClockCircleOutlined />
                          <span>{dayjs(note.createdAt).format('YYYY-MM-DD HH:mm:ss')}</span>
                        </Space>
                      </Space>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </Card>
  );
}
