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
  Progress,
  List,
  Avatar,
  Badge
} from 'antd';
import {
  ShopOutlined,
  FileSearchOutlined,
  FormOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  ArrowRightOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { formsApi, alertsApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  formatDate,
  getStatusTag,
  getNodeLabel,
  getRoleLabel,
  formatRelativeTime
} from '../../lib/utils';

const { Title, Text } = Typography;

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [alertStats, setAlertStats] = useState(null);
  const [recentForms, setRecentForms] = useState([]);
  const [overdueForms, setOverdueForms] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsResp, formsResp, alertsResp, alertStatsResp] = await Promise.all([
        formsApi.getStatistics(),
        formsApi.getList({ pageSize: 5 }),
        alertsApi.getDeadlineAlerts({ group: 'overdue' }),
        alertsApi.getStatistics(),
      ]);

      if (statsResp.success) {
        setStatistics(statsResp.data.statistics);
      }
      if (formsResp.success) {
        setRecentForms(formsResp.data.list);
      }
      if (alertsResp.success) {
        setOverdueForms(alertsResp.data.list || []);
      }
      if (alertStatsResp.success) {
        setAlertStats(alertStatsResp.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (id) => {
    router.push(`/forms/${id}`);
  };

  const handleViewAll = (node) => {
    router.push(`/forms${node ? `?node=${node}` : ''}`);
  };

  const handleViewAlerts = () => {
    router.push('/alerts');
  };

  const recentColumns = [
    {
      title: '入驻单号',
      dataIndex: 'form_no',
      key: 'form_no',
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
      ellipsis: true,
    },
    {
      title: '节点',
      dataIndex: 'current_node',
      key: 'current_node',
      render: (node) => <Tag color="blue">{getNodeLabel(node)}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const tag = getStatusTag(status);
        return <Tag color={tag.color}>{tag.label}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => formatRelativeTime(date),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record.id)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <MainLayout>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Space>
              <DashboardOutlined style={{ fontSize: 24, color: '#1677ff' }} />
              <Title level={4} style={{ margin: 0 }}>工作台</Title>
              <Text type="secondary">
                当前角色：<Tag color="blue">{getRoleLabel(user.role)}</Tag>
                欢迎，{user.realName}
              </Text>
            </Space>

            <Row gutter={16}>
              <Col span={4}>
                <Card>
                  <Statistic
                    title="全部单据"
                    value={statistics?.total || 0}
                    prefix={<FileSearchOutlined />}
                  />
                </Card>
              </Col>
              <Col span={4}>
                <Card>
                  <Statistic
                    title="待签收"
                    value={statistics?.pendingSign || 0}
                    valueStyle={{ color: '#1677ff' }}
                    prefix={<ShopOutlined />}
                  />
                </Card>
              </Col>
              <Col span={4}>
                <Card>
                  <Statistic
                    title="异常回传"
                    value={statistics?.abnormalReturn || 0}
                    valueStyle={{ color: '#ff4d4f' }}
                    prefix={<ExclamationCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={4}>
                <Card>
                  <Statistic
                    title="待审核"
                    value={statistics?.pendingAudit || 0}
                    valueStyle={{ color: '#faad14' }}
                    prefix={<FileSearchOutlined />}
                  />
                </Card>
              </Col>
              <Col span={4}>
                <Card>
                  <Statistic
                    title="需补正"
                    value={statistics?.supplementRequired || 0}
                    valueStyle={{ color: '#fa8c16' }}
                    prefix={<FormOutlined />}
                  />
                </Card>
              </Col>
              <Col span={4}>
                <Card>
                  <Statistic
                    title="已归档"
                    value={statistics?.archived || 0}
                    valueStyle={{ color: '#52c41a' }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Card
                  title={
                    <Space>
                      <AlertOutlined style={{ color: '#ff4d4f' }} />
                      <span>到期预警</span>
                      <Badge count={statistics?.overdue || 0} style={{ backgroundColor: '#ff4d4f' }} />
                    </Space>
                  }
                  extra={
                    <Button type="link" onClick={handleViewAlerts}>
                      查看全部 <ArrowRightOutlined />
                    </Button>
                  }
                >
                  <Row gutter={16}>
                    <Col span={8}>
                      <Card size="small" style={{ textAlign: 'center' }}>
                        <Statistic
                          title="正常"
                          value={statistics?.total - (statistics?.overdue || 0) - (statistics?.nearDeadline || 0)}
                          valueStyle={{ color: '#52c41a' }}
                        />
                        <Progress
                          type="circle"
                          percent={Math.round(((statistics?.total - (statistics?.overdue || 0) - (statistics?.nearDeadline || 0)) / (statistics?.total || 1)) * 100)}
                          size={80}
                          strokeColor="#52c41a"
                        />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small" style={{ textAlign: 'center' }}>
                        <Statistic
                          title="临期(1天内)"
                          value={statistics?.nearDeadline || 0}
                          valueStyle={{ color: '#faad14' }}
                        />
                        <Progress
                          type="circle"
                          percent={Math.round(((statistics?.nearDeadline || 0) / (statistics?.total || 1)) * 100)}
                          size={80}
                          strokeColor="#faad14"
                        />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small" style={{ textAlign: 'center' }}>
                        <Statistic
                          title="逾期"
                          value={statistics?.overdue || 0}
                          valueStyle={{ color: '#ff4d4f' }}
                        />
                        <Progress
                          type="circle"
                          percent={Math.round(((statistics?.overdue || 0) / (statistics?.total || 1)) * 100)}
                          size={80}
                          strokeColor="#ff4d4f"
                        />
                      </Card>
                    </Col>
                  </Row>

                  {overdueForms?.length > 0 && (
                    <>
                      <div style={{ marginTop: 16, marginBottom: 8 }}>
                        <Text strong type="danger">逾期单据 ({overdueForms.length})</Text>
                      </div>
                      <List
                        size="small"
                        dataSource={overdueForms.slice(0, 3)}
                        renderItem={(item) => (
                          <List.Item
                            actions={[
                              <Button
                                type="link"
                                size="small"
                                onClick={() => handleViewDetail(item.id)}
                              >
                                处理
                              </Button>
                            ]}
                          >
                            <List.Item.Meta
                              avatar={<Avatar style={{ backgroundColor: '#ff4d4f' }}><ExclamationCircleOutlined /></Avatar>}
                              title={
                                <Space>
                                  <span style={{ fontFamily: 'monospace' }}>{item.form_no}</span>
                                  <Tag color="red">逾期</Tag>
                                </Space>
                              }
                              description={
                                <Space>
                                  <span>{item.merchant_name}</span>
                                  <Text type="secondary">{getNodeLabel(item.current_node)}</Text>
                                </Space>
                              }
                            />
                          </List.Item>
                        )}
                      />
                    </>
                  )}
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  title={
                    <Space>
                      <UserOutlined />
                      <span>按责任人统计</span>
                    </Space>
                  }
                >
                  {alertStats?.byHandler && alertStats.byHandler.length > 0 ? (
                    <List
                      size="small"
                      dataSource={alertStats.byHandler}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={<Avatar style={{ backgroundColor: '#722ed1' }}>{item.realName?.[0]}</Avatar>}
                            title={
                              <Space>
                                <Text strong>{item.realName}</Text>
                                <Tag color="blue">{item.roleLabel}</Tag>
                              </Space>
                            }
                            description={
                              <Space>
                                <span>总计：{item.total}</span>
                                <Text type="danger">逾期：{item.overdue}</Text>
                              </Space>
                            }
                          />
                          <Progress
                            percent={Math.round((item.overdue / (item.total || 1)) * 100)}
                            size="small"
                            strokeColor="#ff4d4f"
                            showInfo={false}
                            style={{ width: 100 }}
                          />
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Empty description="暂无数据" />
                  )}
                </Card>
              </Col>
            </Row>

            <Card
              title="最近单据"
              extra={
                <Button type="link" onClick={() => handleViewAll()}>
                  查看全部 <ArrowRightOutlined />
                </Button>
              }
            >
              <Table
                rowKey="id"
                loading={loading}
                columns={recentColumns}
                dataSource={recentForms}
                pagination={false}
                size="small"
              />
            </Card>
          </Space>
        </Card>
      </Space>
    </MainLayout>
  );
}
