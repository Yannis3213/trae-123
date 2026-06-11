import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Descriptions, 
  Tag, 
  Space, 
  Button, 
  Spin, 
  message,
  Tabs,
  Divider,
  Breadcrumb,
  Alert
} from 'antd';
import { 
  ArrowLeftOutlined, 
  EditOutlined, 
  UserOutlined,
  ClockCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { caseApi } from '../utils/api';
import { STATUS_MAP, PRIORITY_MAP } from '../utils/constants';
import WarningBadge from './WarningBadge';
import RegistrationForm from './RegistrationForm';
import AssignmentForm from './AssignmentForm';
import FollowupForm from './FollowupForm';
import ProcessingRecords from './ProcessingRecords';
import AuditNotes from './AuditNotes';
import ExceptionReasons from './ExceptionReasons';
import StatusActionButtons from './StatusActionButtons';
import type { CaseDetail, LegalCase, CaseQueue } from '../../types';

const { TabPane } = Tabs;

interface CaseDetailViewProps {
  caseId: number;
  onBack?: () => void;
  onEdit?: (caseItem: LegalCase) => void;
  queue?: CaseQueue;
}

type FormMode = 'view' | 'edit';

export default function CaseDetailView({ caseId, onBack, onEdit, queue }: CaseDetailViewProps) {
  const [loading, setLoading] = useState(false);
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [registrationMode, setRegistrationMode] = useState<FormMode>('view');
  const [assignmentMode, setAssignmentMode] = useState<FormMode>('view');
  const [followupMode, setFollowupMode] = useState<FormMode>('view');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (caseId) {
      fetchData();
    }
  }, [caseId, refreshKey]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await caseApi.getDetail(caseId);
      setCaseData(response.data);
    } catch (error) {
      message.error('获取案件详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDataChange = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleEditCase = () => {
    if (caseData) {
      onEdit?.(caseData);
    }
  };

  const getTabItems = () => {
    const items = [
      { key: 'basic', label: '基本信息' },
    ];

    if (!queue || queue === 'registration') {
      items.push({ key: 'registration', label: '咨询登记' });
    }
    if (!queue || queue === 'assignment') {
      items.push({ key: 'assignment', label: '案件分派' });
    }
    if (!queue || queue === 'followup') {
      items.push({ key: 'followup', label: '回访确认' });
    }

    items.push(
      { key: 'records', label: '处理记录' },
      { key: 'audit', label: '审计备注' },
      { key: 'exceptions', label: '异常原因' }
    );

    return items;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <Card>
        <Alert type="error" message="未找到案件信息" />
      </Card>
    );
  }

  const statusConfig = STATUS_MAP[caseData.status];
  const priorityConfig = PRIORITY_MAP[caseData.priority];
  const isEditable = ['draft', 'pending_submit', 'returned'].includes(caseData.status);

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            {onBack && (
              <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
                返回列表
              </Button>
            )}
            <Breadcrumb style={{ margin: 0 }}>
              <Breadcrumb.Item>案件管理</Breadcrumb.Item>
              <Breadcrumb.Item>{caseData.caseNo}</Breadcrumb.Item>
            </Breadcrumb>
          </Space>
          <Space>
            {isEditable && onEdit && (
              <Button icon={<EditOutlined />} onClick={handleEditCase}>
                编辑案件
              </Button>
            )}
            <StatusActionButtons
              caseItem={caseData}
              mode="view"
              onEditClick={handleEditCase}
              onActionSuccess={handleDataChange}
            />
          </Space>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        <Row gutter={24}>
          <Col xs={24} md={16}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Space size={12} align="center" style={{ marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 20 }}>{caseData.title}</h2>
                  <Tag color={statusConfig.color as any}>{statusConfig.label}</Tag>
                  <Tag color={priorityConfig.color}>{priorityConfig.label}优先级</Tag>
                  <WarningBadge status={caseData.warningStatus} />
                </div>
                <Space size={16} style={{ color: '#666' }}>
                  <Space size={4}>
                    <FileTextOutlined />
                    <span>案号：{caseData.caseNo}</span>
                  </Space>
                  <Space size={4}>
                    <UserOutlined />
                    <span>创建人：{caseData.createdByName || '-'}</span>
                  </Space>
                  <Space size={4}>
                    <ClockCircleOutlined />
                    <span>创建时间：{dayjs(caseData.createdAt).format('YYYY-MM-DD HH:mm')}</span>
                  </Space>
                </Space>
              </div>

              <Descriptions column={3} bordered size="small">
                <Descriptions.Item label="当前处理人" span={1}>
                  {caseData.currentHandlerName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="截止时间" span={1}>
                  {caseData.deadline ? dayjs(caseData.deadline).format('YYYY-MM-DD') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="版本号" span={1}>
                  v{caseData.version}
                </Descriptions.Item>
                <Descriptions.Item label="所属队列" span={1}>
                  {caseData.queue}
                </Descriptions.Item>
                <Descriptions.Item label="最后更新" span={2}>
                  {dayjs(caseData.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              </Descriptions>
            </Space>
          </Col>
          <Col xs={24} md={8}>
            <Card 
              size="small" 
              title="案件状态"
              style={{ background: '#fafafa' }}
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div style={{ textAlign: 'center' }}>
                  <Tag color={statusConfig.color as any} style={{ fontSize: 16, padding: '4px 16px' }}>
                    {statusConfig.label}
                  </Tag>
                </div>
                <Divider style={{ margin: 0 }} />
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="预警状态">
                    <WarningBadge status={caseData.warningStatus} />
                  </Descriptions.Item>
                  <Descriptions.Item label="优先级">
                    <Tag color={priorityConfig.color}>{priorityConfig.label}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="处理人">
                    {caseData.currentHandlerName || '待分配'}
                  </Descriptions.Item>
                  <Descriptions.Item label="截止时间">
                    {caseData.deadline ? dayjs(caseData.deadline).format('YYYY-MM-DD') : '未设置'}
                  </Descriptions.Item>
                </Descriptions>
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>

      <Card bodyStyle={{ padding: 0 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={getTabItems()}
          style={{ padding: '0 24px' }}
        />
        <div style={{ padding: '0 24px 24px' }}>
          {activeTab === 'basic' && (
            <Card title="案件基本信息" size="small">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="案号" span={1}>
                  {caseData.caseNo}
                </Descriptions.Item>
                <Descriptions.Item label="标题" span={1}>
                  {caseData.title}
                </Descriptions.Item>
                <Descriptions.Item label="优先级" span={1}>
                  <Tag color={priorityConfig.color}>{priorityConfig.label}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="状态" span={1}>
                  <Tag color={statusConfig.color as any}>{statusConfig.label}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="预警状态" span={1}>
                  <WarningBadge status={caseData.warningStatus} />
                </Descriptions.Item>
                <Descriptions.Item label="当前队列" span={1}>
                  {caseData.queue}
                </Descriptions.Item>
                <Descriptions.Item label="当前处理人" span={1}>
                  {caseData.currentHandlerName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="截止时间" span={1}>
                  {caseData.deadline ? dayjs(caseData.deadline).format('YYYY-MM-DD') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="创建人" span={1}>
                  {caseData.createdByName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间" span={1}>
                  {dayjs(caseData.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="最后更新" span={2}>
                  {dayjs(caseData.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          {activeTab === 'registration' && (
            <RegistrationForm
              caseId={caseId}
              caseItem={caseData}
              mode={registrationMode}
              onModeChange={setRegistrationMode}
              onDataChange={handleDataChange}
            />
          )}

          {activeTab === 'assignment' && (
            <AssignmentForm
              caseId={caseId}
              caseItem={caseData}
              mode={assignmentMode}
              onModeChange={setAssignmentMode}
              onDataChange={handleDataChange}
            />
          )}

          {activeTab === 'followup' && (
            <FollowupForm
              caseId={caseId}
              caseItem={caseData}
              mode={followupMode}
              onModeChange={setFollowupMode}
              onDataChange={handleDataChange}
            />
          )}

          {activeTab === 'records' && (
            <ProcessingRecords caseId={caseId} />
          )}

          {activeTab === 'audit' && (
            <AuditNotes caseId={caseId} />
          )}

          {activeTab === 'exceptions' && (
            <ExceptionReasons caseId={caseId} />
          )}
        </div>
      </Card>
    </div>
  );
}
