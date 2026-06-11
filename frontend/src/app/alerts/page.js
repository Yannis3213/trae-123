'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '../../components/MainLayout';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Tabs,
  List,
  Avatar,
  Badge,
  Alert,
  Modal,
  message,
  Tooltip
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  AlertOutlined,
  UserOutlined,
  WarningOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import { alertsApi, batchApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  formatDate,
  getStatusTag,
  getNodeLabel,
  getRoleLabel,
  getExceptionTypeLabel,
  getDeadlineStatus
} from '../../lib/utils';

const { Title, Text } = Typography;

export default function AlertsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deadlineData, setDeadlineData] = useState(null);
  const [exceptionData, setExceptionData] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [selectedForms, setSelectedForms] = useState([]);
  const [promoteModalVisible, setPromoteModalVisible] = useState(false);
  const [promoteLoading, setPromoteLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [deadlineResp, exceptionResp, statsResp] = await Promise.all([
        alertsApi.getDeadlineAlerts(),
        alertsApi.getExceptions({ resolved: false }),
        alertsApi.getStatistics(),
      ]);

      if (deadlineResp.success) {
        setDeadlineData(deadlineResp.data);
      }
      if (exceptionResp.success) {
        setExceptionData(exceptionResp.data);
      }
      if (statsResp.success) {
        setStatsData(statsResp.data);
      }
    } catch (err) {
      message.error(err.error?.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (id) => {
    router.push(`/forms/${id}`);
  };

  const handlePromoteOverdue = () => {
    const overdueForms = deadlineData?.grouped?.overdue?.items || [];
    if (overdueForms.length === 0) {
      message.warning('没有逾期的单据需要推进');
      return;
    }
    setSelectedForms(overdueForms);
    setPromoteModalVisible(true);
  };

  const handleConfirmPromote = async () => {
    if (user.role !== 'platform_leader') {
      message.error('只有平台负责人才能进行逾期批量推进');
      return;
    }

    setPromoteLoading(true);
    try {
      const response = await batchApi.promoteOverdue({
        formIds: selectedForms.map(f => f.id),
        opinion: '逾期批量推进',
      });

      if (response.success) {
        message.success(`批量推进完成：成功${response.data.successCount}条，失败${response.data.failCount}条`);
        setPromoteModalVisible(false);
        fetchData();
      }
    } catch (err) {
      message.error(err.error?.message || '批量推进失败');
    } finally {
      setPromoteLoading(false);
    }
  };

  const deadlineColumns = [
    {
      title: '入驻单号',
      dataIndex: 'form_no',
      key: 'form_no',
      width: 150,
      fixed: 'left',
      render: (text, record) => (
        <a onClick={() => handleViewDetail(record.id)} style={{ fontFamily: 'monospace' }}>
          {text}
        </a>
      ),
    },
    {
      title: '商家名称',
      dataIndex: 'merchant_name',
      key: 'merchant_name',
      width: 180,
      ellipsis: true,
    },
    {
      title: '当前节点',
      dataIndex: 'current_node',
      key: 'current_node',
      width: 120,
      render: (node) => <Tag color="blue">{getNodeLabel(node)}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const tag = getStatusTag(status);
        return <Tag color={tag.color}>{tag.label}</Tag>;
      },
    },
    {
      title: '到期状态',
      dataIndex: 'deadline',
      key: 'deadline_status',
      width: 120,
      render: (deadline, record) => {
        const ds = getDeadlineStatus(deadline);
        return (
          <Badge
            status={ds.type === 'overdue' ? 'error' : ds.type === 'near' ? 'warning' : 'success'}
            text={ds.label}
          />
        );
      },
    },
    {
      title: '处理期限',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 160,
      render: (date) => formatDate(date),
    },
    {
      title: '责任人',
      key: 'responsible',
      width: 120,
      render: (_, record) => (
        <Space>
          <Avatar size="small" style={{ backgroundColor: '#1677ff' }}>
            {record.responsiblePerson?.[0]}
          </Avatar>
          <span>{record.responsiblePerson}</span>
        </Space>
      ),
    },
    {
      title: '当前处理人',
      dataIndex: 'current_handler',
      key: 'current_handler',
      width: 120,
      render: (handler, record) => (
        <Space>
          {handler && (
            <>
              <Avatar size="small" style={{ backgroundColor: '#722ed1' }}>
                {handler[0]}
              </Avatar>
              <span>{handler}</span>
            </>
          )}
          {!handler && <Text type="secondary">未分配</Text>}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record.id)}
        >
          详情
        </Button>
      ),
    },
  ];

  const exceptionColumns = [
    {
      title: '入驻单号',
      dataIndex: 'form_no',
      key: 'form_no',
      width: 150,
      render: (text, record) => (
        <a onClick={() => handleViewDetail(record.form_id)} style={{ fontFamily: 'monospace' }}>
          {text}
        </a>
      ),
    },
    {
      title: '商家名称',
      dataIndex: 'merchantName',
      key: 'merchantName',
      width: 180,
      ellipsis: true,
    },
    {
      title: '异常类型',
      dataIndex: 'exception_type',
      key: 'exception_type',
      width: 120,
      render: (type) => {
        const colorMap = {
          material_missing: 'orange',
          permission_denied: 'purple',
          timeout: 'red',
          status_conflict: 'blue',
          version_conflict: 'cyan',
          duplicate_submit: 'magenta',
          evidence_missing: 'gold',
        };
        return (
          <Tag color={colorMap[type] || 'default'}>
            {getExceptionTypeLabel(type)}
          </Tag>
        );
      },
    },
    {
      title: '异常详情',
      dataIndex: 'exception_detail',
      key: 'exception_detail',
      ellipsis: true,
    },
    {
      title: '节点',
      dataIndex: 'exception_node',
      key: 'exception_node',
      width: 120,
      render: (node) => node ? <Tag color="geekblue">{getNodeLabel(node)}</Tag> : '-',
    },
    {
      title: '记录人',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 100,
    },
    {
      title: '记录时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date) => formatDate(date),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record.form_id)}
        >
          处理
        </Button>
      ),
    },
  ];

  const renderDeadlineTab = (group) => {
    const data = deadlineData?.grouped?.[group]?.items || [];
    const count = deadlineData?.grouped?.[group]?.count || 0;

    return (
      <Card size="small" style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong>
            {group === 'normal' ? '正常' : group === 'near' ? '临期' : '逾期'}
            （{count}条）
          </Text>
          {group === 'overdue' && user.role === 'platform_leader' && count > 0 && (
            <Button
              type="primary"
              danger
              icon={<PlayCircleOutlined />}
              onClick={handlePromoteOverdue}
              style={{ marginLeft: 16 }}
            >
              批量推进
            </Button>
          )}
        </div>
        <Table
          rowKey="id"
          size="small"
          columns={deadlineColumns}
          dataSource={data}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1200 }}
        />
      </Card>
    );
  };

  const deadlineTabs = [
    {
      key: 'all',
      label: (
        <Space>
          <AlertOutlined />
          全部 ({deadlineData?.stats?.total || 0})
        </Space>
      ),
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%', marginTop: 16 }}>
          {renderDeadlineTab('overdue')}
          {renderDeadlineTab('near')}
          {renderDeadlineTab('normal')}
        </Space>
      ),
    },
    {
      key: 'overdue',
      label: (
        <Space>
          <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
          逾期 ({deadlineData?.grouped?.overdue?.count || 0})
        </Space>
      ),
      children: renderDeadlineTab('overdue'),
    },
    {
      key: 'near',
      label: (
        <Space>
          <ClockCircleOutlined style={{ color: '#faad14' }} />
          临期 ({deadlineData?.grouped?.near?.count || 0})
        </Space>
      ),
      children: renderDeadlineTab('near'),
    },
    {
      key: 'normal',
      label: (
        <Space>
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          正常 ({deadlineData?.grouped?.normal?.count || 0})
        </Space>
      ),
      children: renderDeadlineTab('normal'),
    },
  ];

  const mainTabs = [
    {
      key: 'deadline',
      label: '到期预警',
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {deadlineData?.byHandler && Object.keys(deadlineData.byHandler).length > 0 && (
            <Card title="按责任人分组">
              <Row gutter={16}>
                {Object.entries(deadlineData.byHandler).map(([handler, data]) => (
                  <Col key={handler} xs={24} sm={12} md={8} lg={6}>
                    <Card size="small">
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Space>
                          <Avatar style={{ backgroundColor: '#1677ff' }}>
                            {data.handlerInfo?.realName?.[0]}
                          </Avatar>
                          <div>
                            <div style={{ fontWeight: 500 }}>{data.handlerInfo?.realName}</div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {data.handlerInfo?.roleLabel}
                            </Text>
                          </div>
                        </Space>
                        <Row gutter={8}>
                          <Col span={8}>
                            <Statistic title="总计" value={data.total} size="small" />
                          </Col>
                          <Col span={8}>
                            <Statistic
                              title="临期"
                              value={data.near}
                              valueStyle={{ color: '#faad14', fontSize: 14 }}
                              size="small"
                            />
                          </Col>
                          <Col span={8}>
                            <Statistic
                              title="逾期"
                              value={data.overdue}
                              valueStyle={{ color: '#ff4d4f', fontSize: 14 }}
                              size="small"
                            />
                          </Col>
                        </Row>
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          )}

          <Card>
            <Tabs items={deadlineTabs} type="card" />
          </Card>
        </Space>
      ),
    },
    {
      key: 'exceptions',
      label: (
        <Space>
          <WarningOutlined style={{ color: '#faad14' }} />
          异常记录 ({exceptionData?.list?.length || 0})
        </Space>
      ),
      children: (
        <Card style={{ marginTop: 16 }}>
          {exceptionData?.stats && (
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={4}>
                <Statistic
                  title="未解决"
                  value={exceptionData.stats.unresolved}
                  valueStyle={{ color: '#ff4d4f' }}
                  prefix={<ExclamationCircleOutlined />}
                />
              </Col>
              <Col span={4}>
                <Statistic
                  title="已解决"
                  value={exceptionData.stats.resolved}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Col>
            </Row>
          )}

          <Table
            rowKey="id"
            columns={exceptionColumns}
            dataSource={exceptionData?.list || []}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1200 }}
          />
        </Card>
      ),
    },
  ];

  return (
    <MainLayout>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="正常"
                value={deadlineData?.grouped?.normal?.count || 0}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="临期(1天内)"
                value={deadlineData?.grouped?.near?.count || 0}
                valueStyle={{ color: '#faad14' }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="逾期"
                value={deadlineData?.grouped?.overdue?.count || 0}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<ExclamationCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="待处理异常"
                value={exceptionData?.stats?.unresolved || 0}
                valueStyle={{ color: '#fa8c16' }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {user.role === 'platform_leader' && deadlineData?.grouped?.overdue?.count > 0 && (
          <Alert
            message="存在逾期单据"
            description={`当前有 ${deadlineData.grouped.overdue.count} 条单据已逾期，可进行批量推进重新分配处理人。`}
            type="warning"
            showIcon
            action={
              <Button type="primary" danger onClick={handlePromoteOverdue}>
                批量推进
              </Button>
            }
          />
        )}

        <Tabs
          items={mainTabs}
          defaultActiveKey="deadline"
          type="card"
        />
      </Space>

      <Modal
        title="确认批量推进逾期单据"
        open={promoteModalVisible}
        onOk={handleConfirmPromote}
        onCancel={() => setPromoteModalVisible(false)}
        confirmLoading={promoteLoading}
        okText="确认推进"
        width={700}
      >
        <Alert
          message="将重新分配以下逾期单据的处理人，并重置处理期限"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <div style={{ maxHeight: 300, overflow: 'auto' }}>
          <List
            size="small"
            dataSource={selectedForms}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar style={{ backgroundColor: '#ff4d4f' }}><ExclamationCircleOutlined /></Avatar>}
                  title={
                    <Space>
                      <span style={{ fontFamily: 'monospace' }}>{item.form_no}</span>
                      <Text>{item.merchant_name}</Text>
                    </Space>
                  }
                  description={
                    <Space>
                      <Tag color="blue">{getNodeLabel(item.current_node)}</Tag>
                      <Text type="secondary">原处理人：{item.current_handler}</Text>
                      <Text type="danger">
                        已逾期 {Math.abs(item.timeoutInfo?.daysRemaining || 0)} 天
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      </Modal>
    </MainLayout>
  );
}
