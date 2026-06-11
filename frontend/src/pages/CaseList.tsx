import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Card,
  Row,
  Col,
  Statistic,
  Modal,
  Form,
  message,
  Checkbox,
  Tooltip,
  Alert,
  Typography,
  DatePicker,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  BatchOperationOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  caseApi,
} from '../services/api';
import { useAuth } from '../hooks/useAuth';
import {
  CaseWithDetail,
  CaseStatus,
  ProcessingStage,
  ExpiryStatus,
  STATUS_DISPLAY,
  STATUS_COLOR,
  STAGE_DISPLAY,
  EXPIRY_DISPLAY,
  EXPIRY_COLOR,
  ROLE_DISPLAY,
  StatisticsResponse,
  BatchProcessResult,
  CreateCaseRequest,
} from '../types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Option } = Select;
const { Text, Title } = Typography;
const { confirm } = Modal;

const CaseList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CaseWithDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchProcessResult[]>([]);
  const [batchResultsVisible, setBatchResultsVisible] = useState(false);
  const [statistics, setStatistics] = useState<StatisticsResponse | null>(null);
  const [expiringData, setExpiringData] = useState<any>(null);
  const [form] = Form.useForm();
  const [batchForm] = Form.useForm();
  const [createForm] = Form.useForm();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const [filters, setFilters] = useState({
    status: undefined as CaseStatus | undefined,
    stage: undefined as ProcessingStage | undefined,
    expiry: undefined as ExpiryStatus | undefined,
    keyword: undefined as string | undefined,
  });

  const fetchStatistics = useCallback(async () => {
    try {
      const [stats, expiring] = await Promise.all([
        caseApi.getStatistics(),
        caseApi.getExpiringCases(),
      ]);
      setStatistics(stats);
      setExpiringData(expiring);
    } catch (err) {
      console.error('获取统计数据失败', err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await caseApi.listCases({
        ...filters,
        page,
        page_size: pageSize,
      });
      setData(result.items);
      setTotal(result.total);
    } catch (err: any) {
      message.error(err.response?.data?.message || '获取列表失败');
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    fetchData();
    fetchStatistics();
  }, [fetchData, fetchStatistics]);

  const handleSearch = (values: any) => {
    setFilters({
      status: values.status,
      stage: values.stage,
      expiry: values.expiry,
      keyword: values.keyword || undefined,
    });
    setPage(1);
  };

  const handleReset = () => {
    form.resetFields();
    setFilters({
      status: undefined,
      stage: undefined,
      expiry: undefined,
      keyword: undefined,
    });
    setPage(1);
  };

  const handleBatchProcess = async (values: any) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要批量处理的案件');
      return;
    }

    setBatchLoading(true);
    try {
      const versionMap: Record<string, number> = {};
      data.forEach((item) => {
        if (selectedRowKeys.includes(item.id)) {
          versionMap[item.id] = item.version;
        }
      });

      const results = await caseApi.batchProcess({
        case_ids: selectedRowKeys as string[],
        to_status: values.to_status,
        remarks: values.remarks,
        version_map: versionMap,
      });

      setBatchResults(results);
      setBatchResultsVisible(true);
      setBatchModalVisible(false);
      batchForm.resetFields();
      setSelectedRowKeys([]);
      fetchData();
      fetchStatistics();

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;
      if (failCount === 0) {
        message.success(`批量处理成功，共 ${successCount} 条`);
      } else {
        message.warning(`批量处理完成：成功 ${successCount} 条，失败 ${failCount} 条`);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || '批量处理失败');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleCreateCase = async (values: any) => {
    setCreateLoading(true);
    try {
      await caseApi.createCase({
        ...values,
        deadline: values.deadline ? dayjs(values.deadline).toISOString() : dayjs().add(7, 'day').toISOString(),
      });
      message.success('警情登记创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      fetchData();
      fetchStatistics();
    } catch (err: any) {
      message.error(err.response?.data?.message || '创建失败');
    } finally {
      setCreateLoading(false);
    }
  };

  const getBatchAllowedStatuses = () => {
    if (!user) return [];
    const options: { value: CaseStatus; label: string; disabled?: boolean }[] = [];

    switch (user.role) {
      case 'dispatcher':
        options.push({ value: 'under_review', label: '提交复核' });
        break;
      case 'police_officer':
        options.push({ value: 'under_review', label: '完成处置，移交复核' });
        break;
      case 'reviewer':
        options.push({ value: 'pending_correction', label: '退回补正' });
        options.push({ value: 'completed', label: '办结归档' });
        break;
    }

    return options;
  };

  const renderBatchResults = () => {
    if (batchResults.length === 0) return null;

    return (
      <Table
        dataSource={batchResults}
        rowKey="case_id"
        pagination={false}
        columns={[
          {
            title: '案件编号',
            dataIndex: 'case_number',
            key: 'case_number',
          },
          {
            title: '处理结果',
            dataIndex: 'success',
            key: 'success',
            render: (success: boolean) =>
              success ? (
                <Tag color="green" icon={<CheckCircleOutlined />}>
                  成功
                </Tag>
              ) : (
                <Tag color="red" icon={<CloseCircleOutlined />}>
                  失败
                </Tag>
              ),
          },
          {
            title: '说明',
            dataIndex: 'message',
            key: 'message',
          },
          {
            title: '错误详情',
            dataIndex: 'error_details',
            key: 'error_details',
            render: (details?: string[]) =>
              details ? (
                <ul style={{ margin: 0, paddingLeft: 16, color: '#ff4d4f' }}>
                  {details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              ) : (
                '-'
              ),
          },
        ]}
      />
    );
  };

  const columns = [
    {
      title: '案件编号',
      dataIndex: 'case_number',
      key: 'case_number',
      width: 140,
      render: (text: string) => (
        <Text strong copyable>
          {text}
        </Text>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string, record: CaseWithDetail) => (
        <a onClick={() => navigate(`/cases/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '类型',
      dataIndex: 'case_type',
      key: 'case_type',
      width: 100,
    },
    {
      title: '报案人',
      dataIndex: 'reporter_name',
      key: 'reporter_name',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: CaseStatus) => (
        <Tag color={STATUS_COLOR[status]} icon={<FileTextOutlined />}>
          {STATUS_DISPLAY[status]}
        </Tag>
      ),
    },
    {
      title: '当前阶段',
      dataIndex: 'current_stage',
      key: 'current_stage',
      width: 110,
      render: (stage: ProcessingStage) => STAGE_DISPLAY[stage],
    },
    {
      title: '到期状态',
      dataIndex: 'expiry_status',
      key: 'expiry_status',
      width: 100,
      render: (status: ExpiryStatus) => (
        <Tag
          color={EXPIRY_COLOR[status]}
          icon={
            status === 'overdue' ? (
              <ExclamationCircleOutlined />
            ) : status === 'nearing_expiry' ? (
              <ClockCircleOutlined />
            ) : (
              <CheckCircleOutlined />
            )
          }
        >
          {EXPIRY_DISPLAY[status]}
        </Tag>
      ),
    },
    {
      title: '截止日期',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 120,
      render: (date: string, record: CaseWithDetail) => (
        <Tooltip title={dayjs(date).format('YYYY-MM-DD HH:mm:ss')}>
          <span className={record.expiry_status === 'overdue' ? 'evidence-no' : ''}>
            {dayjs(date).format('YYYY-MM-DD')}
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(date).fromNow()}
            </Text>
          </span>
        </Tooltip>
      ),
    },
    {
      title: '当前处理人',
      dataIndex: 'current_handler_name',
      key: 'current_handler_name',
      width: 100,
      render: (name?: string) => name || '-',
    },
    {
      title: '证据完整性',
      key: 'evidence',
      width: 120,
      render: (_: any, record: CaseWithDetail) => (
        <Space direction="vertical" size="small">
          <div>
            <span className={record.registration_materials_complete ? 'evidence-ok' : 'evidence-no'}>
              {record.registration_materials_complete ? '✓' : '✗'} 登记材料
            </span>
          </div>
          <div>
            <span className={record.dispatch_timeline_met ? 'evidence-ok' : 'evidence-no'}>
              {record.dispatch_timeline_met ? '✓' : '✗'} 派及时限
            </span>
          </div>
          <div>
            <span className={record.followup_evidence_complete ? 'evidence-ok' : 'evidence-no'}>
              {record.followup_evidence_complete ? '✓' : '✗'} 回访证据
            </span>
          </div>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: CaseWithDetail) => (
        <Button type="link" onClick={() => navigate(`/cases/${record.id}`)}>
          详情
        </Button>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
    getCheckboxProps: (record: CaseWithDetail) => ({
      disabled: record.status === 'completed',
    }),
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {statistics && (
          <Row gutter={16}>
            <Col span={4}>
              <Card>
                <Statistic
                  title="案件总数"
                  value={statistics.total_cases}
                  prefix={<FileTextOutlined />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="待补正"
                  value={statistics.pending_correction}
                  valueStyle={{ color: '#fa8c16' }}
                  prefix={<ExclamationCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="复核中"
                  value={statistics.under_review}
                  valueStyle={{ color: '#1890ff' }}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="已办结"
                  value={statistics.completed}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="正常"
                  value={statistics.normal}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="临期"
                  value={statistics.nearing_expiry}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {expiringData && expiringData.overdue_by_officer?.length > 0 && (
          <Alert
            message="逾期预警"
            description={
              <div>
                <Text type="danger">
                  当前共有 {expiringData.overdue} 件案件已逾期，请督促相关民警尽快处理：
                </Text>
                <ul style={{ marginTop: 8, marginBottom: 0 }}>
                  {expiringData.overdue_by_officer.map((item: any, idx: number) => (
                    <li key={idx}>
                      {item.handler_name}：{item.count} 件
                    </li>
                  ))}
                </ul>
              </div>
            }
            type="error"
            showIcon
            closable
          />
        )}

        {expiringData && expiringData.nearing_expiry > 0 && (
          <Alert
            message={`临期提醒：${expiringData.nearing_expiry} 件案件将在2天内到期`}
            type="warning"
            showIcon
            closable
          />
        )}

        <Card title="筛选条件" size="small">
          <Form form={form} layout="inline" onFinish={handleSearch}>
            <Form.Item name="status" label="状态">
              <Select placeholder="全部" allowClear style={{ width: 140 }}>
                <Option value="pending_correction">待补正</Option>
                <Option value="under_review">复核中</Option>
                <Option value="completed">办结</Option>
              </Select>
            </Form.Item>
            <Form.Item name="stage" label="阶段">
              <Select placeholder="全部" allowClear style={{ width: 140 }}>
                <Option value="registration">警情登记</Option>
                <Option value="dispatch">处置派警</Option>
                <Option value="review">复核归档</Option>
              </Select>
            </Form.Item>
            <Form.Item name="expiry" label="到期状态">
              <Select placeholder="全部" allowClear style={{ width: 140 }}>
                <Option value="normal">正常</Option>
                <Option value="nearing_expiry">临期</Option>
                <Option value="overdue">逾期</Option>
              </Select>
            </Form.Item>
            <Form.Item name="keyword" label="关键词">
              <Input
                placeholder="编号/标题/报案人"
                prefix={<SearchOutlined />}
                style={{ width: 200 }}
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                  搜索
                </Button>
                <Button onClick={handleReset} icon={<ReloadOutlined />}>
                  重置
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>

        <Card
          title={
            <Space>
              <span>警情处置单列表</span>
              {selectedRowKeys.length > 0 && (
                <Tag color="blue">已选择 {selectedRowKeys.length} 项</Tag>
              )}
            </Space>
          }
          extra={
            <Space>
              {selectedRowKeys.length > 0 && (
                <Button
                  type="primary"
                  icon={<BatchOperationOutlined />}
                  onClick={() => setBatchModalVisible(true)}
                >
                  批量处理
                </Button>
              )}
              {user?.role === 'dispatcher' && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateModalVisible(true); }}>
                  新建登记
                </Button>
              )}
              <Button icon={<ReloadOutlined />} onClick={fetchData}>
                刷新
              </Button>
            </Space>
          }
        >
          <Table
            rowSelection={rowSelection}
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
            scroll={{ x: 1200 }}
          />
        </Card>
      </Space>

      <Modal
        title="批量处理"
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        footer={null}
        width={500}
      >
        <Alert
          message={`已选择 ${selectedRowKeys.length} 条案件进行批量处理`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={batchForm} layout="vertical" onFinish={handleBatchProcess}>
          <Form.Item
            label="目标状态"
            name="to_status"
            rules={[{ required: true, message: '请选择目标状态' }]}
          >
            <Select placeholder="请选择要变更的状态">
              {getBatchAllowedStatuses().map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="处理备注"
            name="remarks"
            rules={[{ required: true, message: '请填写处理备注' }]}
          >
            <Input.TextArea rows={4} placeholder="请填写批量处理的原因和说明" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setBatchModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={batchLoading}>
                确认批量处理
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量处理结果"
        open={batchResultsVisible}
        onCancel={() => setBatchResultsVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setBatchResultsVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {renderBatchResults()}
      </Modal>

      <Modal
        title="新建警情登记"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateCase}>
          <Form.Item name="title" label="案件标题" rules={[{ required: true, message: '请输入案件标题' }]}>
            <Input placeholder="请输入案件标题" />
          </Form.Item>
          <Form.Item name="description" label="案情描述" rules={[{ required: true, message: '请输入案情描述' }]}>
            <Input.TextArea rows={3} placeholder="请输入案情描述" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="case_type" label="案件类型" rules={[{ required: true, message: '请选择案件类型' }]}>
                <Select placeholder="请选择">
                  <Option value="民事纠纷">民事纠纷</Option>
                  <Option value="刑事案件">刑事案件</Option>
                  <Option value="治安案件">治安案件</Option>
                  <Option value="交通事故">交通事故</Option>
                  <Option value="求助">求助</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="location" label="发生地点" rules={[{ required: true, message: '请输入发生地点' }]}>
                <Input placeholder="请输入发生地点" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="reporter_name" label="报案人" rules={[{ required: true, message: '请输入报案人姓名' }]}>
                <Input placeholder="请输入报案人姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="reporter_phone" label="联系电话" rules={[{ required: true, message: '请输入联系电话' }]}>
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="deadline" label="办理截止日期" rules={[{ required: true, message: '请选择截止日期' }]}>
            <DatePicker showTime style={{ width: '100%' }} placeholder="请选择截止日期" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCreateModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={createLoading}>
                提交登记
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CaseList;
