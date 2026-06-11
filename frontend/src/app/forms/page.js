'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MainLayout from '../../components/MainLayout';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,
  Tag,
  Modal,
  Form,
  InputNumber,
  message,
  Drawer,
  Divider,
  Row,
  Col,
  Statistic,
  Checkbox,
  Alert,
  Typography,
  Badge
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  BatchProcessingOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { formsApi, batchApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  formatDate,
  getStatusTag,
  getNodeLabel,
  getDeadlineStatus,
  getRoleLabel,
  getBusinessTypes,
  getExceptionTypeLabel
} from '../../lib/utils';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;

const deadlineGroups = [
  { value: 'overdue', label: '逾期', color: 'red' },
  { value: 'near', label: '临期', color: 'orange' },
  { value: 'normal', label: '正常', color: 'green' },
];

const pageSizeOptions = ['10', '20', '50', '100'];

export default function FormsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [stats, setStats] = useState({ byStatus: {}, byNode: {}, byDeadline: { normal: 0, near: 0, overdue: 0 } });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchOperation, setBatchOperation] = useState(null);
  const [batchOpinion, setBatchOpinion] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResultVisible, setBatchResultVisible] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [filters, setFilters] = useState({
    status: null,
    currentNode: searchParams.get('node') || null,
    keyword: '',
    deadlineGroup: null,
    businessType: null,
  });
  const [form] = Form.useForm();
  const [constants, setConstants] = useState({
    statuses: [],
    nodes: [],
    evidenceTypes: [],
    businessTypes: [],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await formsApi.getList({
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      });
      if (response.success) {
        setData(response.data.list);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total,
        }));
        setStats(response.data.stats);
      }
    } catch (err) {
      message.error(err.error?.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchConstants();
  }, []);

  const fetchConstants = async () => {
    try {
      const response = await formsApi.getConstants();
      if (response.success) {
        setConstants(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch constants:', err);
    }
  };

  const handleSearch = (value) => {
    setFilters(prev => ({ ...prev, keyword: value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value || null }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleReset = () => {
    setFilters({
      status: null,
      currentNode: searchParams.get('node') || null,
      keyword: '',
      deadlineGroup: null,
      businessType: null,
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleTableChange = (newPagination) => {
    setPagination(newPagination);
  };

  const handleCreate = async (values) => {
    try {
      const response = await formsApi.create(values);
      if (response.success) {
        message.success('创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        fetchData();
      }
    } catch (err) {
      message.error(err.error?.message || '创建失败');
    }
  };

  const handleViewDetail = (id) => {
    router.push(`/forms/${id}`);
  };

  const handleBatchProcess = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要操作的单据');
      return;
    }
    if (!batchOperation) {
      message.warning('请选择批量操作类型');
      return;
    }

    setBatchLoading(true);
    try {
      const versionMap = {};
      selectedRows.forEach(row => {
        versionMap[row.id] = row.version;
      });

      const response = await batchApi.process({
        formIds: selectedRowKeys,
        operation: batchOperation,
        opinion: batchOpinion,
        versionMap,
      });

      if (response.success) {
        setBatchResult(response.data);
        setBatchResultVisible(true);
        setBatchModalVisible(false);
        setSelectedRowKeys([]);
        setSelectedRows([]);
        setBatchOperation(null);
        setBatchOpinion('');
        fetchData();
      }
    } catch (err) {
      message.error(err.error?.message || '批量操作失败');
    } finally {
      setBatchLoading(false);
    }
  };

  const handlePromoteOverdue = async () => {
    if (user.role !== 'platform_leader') {
      message.error('只有平台负责人才能进行逾期批量推进');
      return;
    }

    const overdueForms = data.filter(f => f.timeoutInfo?.isTimeout);
    if (overdueForms.length === 0) {
      message.warning('当前列表中没有逾期的单据');
      return;
    }

    Modal.confirm({
      title: '确认批量推进逾期单据？',
      content: `将推进 ${overdueForms.length} 条逾期单据，变更处理人并重置期限。`,
      onOk: async () => {
        try {
          const response = await batchApi.promoteOverdue({
            formIds: overdueForms.map(f => f.id),
            opinion: '逾期批量推进',
          });
          if (response.success) {
            setBatchResult(response.data);
            setBatchResultVisible(true);
            fetchData();
          }
        } catch (err) {
          message.error(err.error?.message || '批量推进失败');
        }
      },
    });
  };

  const getBatchOperations = () => {
    if (!user) return [];
    const ops = [];

    if (user.role === 'merchant_registrar') {
      ops.push({ value: 'sign', label: '批量签收' });
      ops.push({ value: 'submit_audit', label: '批量提交审核' });
      ops.push({ value: 'register', label: '批量完成登记' });
      ops.push({ value: 'submit_final_review', label: '批量提交复核' });
    }
    if (user.role === 'audit_supervisor') {
      ops.push({ value: 'audit_pass', label: '批量审核通过' });
    }
    if (user.role === 'platform_leader') {
      ops.push({ value: 'final_review_pass', label: '批量复核通过' });
      ops.push({ value: 'archive', label: '批量归档' });
    }

    return ops;
  };

  const columns = [
    {
      title: '入驻单号',
      dataIndex: 'form_no',
      key: 'form_no',
      width: 160,
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
      width: 200,
      ellipsis: true,
    },
    {
      title: '业务类型',
      dataIndex: 'business_type',
      key: 'business_type',
      width: 100,
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
      title: '到期预警',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 120,
      render: (deadline, record) => {
        const dlStatus = getDeadlineStatus(deadline);
        return (
          <Space>
            <Badge
              status={dlStatus.type === 'overdue' ? 'error' : dlStatus.type === 'near' ? 'warning' : 'success'}
              text={dlStatus.label}
            />
          </Space>
        );
      },
    },
    {
      title: '当前处理人',
      dataIndex: 'current_handler',
      key: 'current_handler',
      width: 100,
      render: (handler) => handler || '-',
    },
    {
      title: '创建人',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date) => formatDate(date),
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

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys, newSelectedRows) => {
      setSelectedRowKeys(newSelectedRowKeys);
      setSelectedRows(newSelectedRows);
    },
    getCheckboxProps: (record) => ({
      disabled: record.status === 'archived',
    }),
  };

  return (
    <MainLayout>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="待处理"
                value={stats.byDeadline?.normal || 0}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="临期(1天内)"
                value={stats.byDeadline?.near || 0}
                prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="逾期"
                value={stats.byDeadline?.overdue || 0}
                prefix={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已归档"
                value={stats.byStatus?.archived || 0}
                prefix={<FileTextOutlined style={{ color: '#1677ff' }} />}
                valueStyle={{ color: '#1677ff' }}
              />
            </Card>
          </Col>
        </Row>

        <Card>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space wrap>
              <Search
                placeholder="搜索单号、商家名称、联系人"
                allowClear
                enterButton={<SearchOutlined />}
                size="middle"
                style={{ width: 300 }}
                onSearch={handleSearch}
              />
              <Select
                placeholder="状态筛选"
                allowClear
                style={{ width: 150 }}
                value={filters.status}
                onChange={(v) => handleFilterChange('status', v)}
              >
                {constants.statuses.map(s => (
                  <Option key={s.value} value={s.value}>{s.label}</Option>
                ))}
              </Select>
              <Select
                placeholder="节点筛选"
                allowClear
                style={{ width: 150 }}
                value={filters.currentNode}
                onChange={(v) => handleFilterChange('currentNode', v)}
              >
                {constants.nodes.filter(n => {
                  if (user.role === 'merchant_registrar') {
                    return ['entry_registration', 'entry_form_registration'].includes(n.value);
                  }
                  if (user.role === 'audit_supervisor') {
                    return n.value === 'qualification_audit';
                  }
                  if (user.role === 'platform_leader') {
                    return ['final_review', 'archived'].includes(n.value);
                  }
                  return true;
                }).map(n => (
                  <Option key={n.value} value={n.value}>{n.label}</Option>
                ))}
              </Select>
              <Select
                placeholder="到期分组"
                allowClear
                style={{ width: 130 }}
                value={filters.deadlineGroup}
                onChange={(v) => handleFilterChange('deadlineGroup', v)}
              >
                {deadlineGroups.map(g => (
                  <Option key={g.value} value={g.value}>
                    <Tag color={g.color}>{g.label}</Tag>
                  </Option>
                ))}
              </Select>
              <Select
                placeholder="业务类型"
                allowClear
                style={{ width: 130 }}
                value={filters.businessType}
                onChange={(v) => handleFilterChange('businessType', v)}
              >
                {getBusinessTypes().map(t => (
                  <Option key={t} value={t}>{t}</Option>
                ))}
              </Select>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </Space>

            <Space style={{ marginBottom: 16 }}>
              {user.role === 'merchant_registrar' && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateModalVisible(true)}
                >
                  新建入驻单
                </Button>
              )}
              <Button
                icon={<BatchProcessingOutlined />}
                disabled={selectedRowKeys.length === 0}
                onClick={() => setBatchModalVisible(true)}
              >
                批量处理 {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
              </Button>
              {user.role === 'platform_leader' && (
                <Button
                  type="primary"
                  danger
                  icon={<WarningOutlined />}
                  onClick={handlePromoteOverdue}
                >
                  逾期批量推进
                </Button>
              )}
              <Text type="secondary" style={{ marginLeft: 16 }}>
                当前角色：<Tag color="blue">{getRoleLabel(user.role)}</Tag>
              </Text>
            </Space>

            {filters.currentNode && (
              <Alert
                message={`当前视图：${getNodeLabel(filters.currentNode)}`}
                type="info"
                showIcon
                closable
                onClose={() => handleFilterChange('currentNode', null)}
              />
            )}

            <Table
              rowKey="id"
              loading={loading}
              columns={columns}
              dataSource={data}
              pagination={{
                ...pagination,
                showSizeChanger: true,
                pageSizeOptions,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
              rowSelection={rowSelection}
              onChange={handleTableChange}
              scroll={{ x: 1400 }}
            />
          </Space>
        </Card>
      </Space>

      <Modal
        title="新建商家入驻单"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="merchantName"
                label="商家名称"
                rules={[{ required: true, message: '请输入商家名称' }]}
              >
                <Input placeholder="请输入商家名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="creditCode"
                label="统一社会信用代码"
              >
                <Input placeholder="请输入统一社会信用代码" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="contactName"
                label="联系人"
                rules={[{ required: true, message: '请输入联系人' }]}
              >
                <Input placeholder="请输入联系人" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="contactPhone"
                label="联系电话"
                rules={[{ required: true, message: '请输入联系电话' }]}
              >
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="contactEmail"
                label="联系邮箱"
              >
                <Input placeholder="请输入联系邮箱" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="businessType"
                label="业务类型"
                rules={[{ required: true, message: '请选择业务类型' }]}
              >
                <Select placeholder="请选择业务类型">
                  {getBusinessTypes().map(t => (
                    <Option key={t} value={t}>{t}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="registeredCapital"
                label="注册资本"
              >
                <Input placeholder="请输入注册资本" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="legalPersonName"
                label="法人姓名"
              >
                <Input placeholder="请输入法人姓名" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="businessLicenseNo"
                label="营业执照号"
              >
                <Input placeholder="请输入营业执照号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="legalPersonIdCard"
                label="法人身份证号"
              >
                <Input placeholder="请输入法人身份证号" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="businessScope"
            label="经营范围"
          >
            <Input.TextArea rows={3} placeholder="请输入经营范围" />
          </Form.Item>
          <Form.Item
            name="officeAddress"
            label="办公地址"
          >
            <Input placeholder="请输入办公地址" />
          </Form.Item>
          <Form.Item
            name="warehouseAddress"
            label="仓库地址"
          >
            <Input placeholder="请输入仓库地址" />
          </Form.Item>

          <Divider />
          <Title level={5}>上传材料（证据）</Title>
          <Form.List name="attachments">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, 'fileName']}
                      rules={[{ required: true, message: '请输入文件名' }]}
                    >
                      <Input placeholder="文件名" style={{ width: 200 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'evidenceType']}
                      rules={[{ required: true, message: '请选择证据类型' }]}
                    >
                      <Select placeholder="证据类型" style={{ width: 150 }}>
                        {constants.evidenceTypes.map(e => (
                          <Option key={e.value} value={e.value}>{e.label}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'remark']}
                    >
                      <Input placeholder="备注" style={{ width: 200 }} />
                    </Form.Item>
                    <Button type="text" danger onClick={() => remove(name)}>删除</Button>
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    添加材料
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">提交</Button>
              <Button onClick={() => setCreateModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量处理"
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        footer={null}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            message={`已选择 ${selectedRowKeys.length} 条单据进行批量处理`}
            type="info"
            showIcon
          />
          <Form.Item label="选择操作类型" required>
            <Select
              style={{ width: '100%' }}
              placeholder="请选择要执行的操作"
              value={batchOperation}
              onChange={setBatchOperation}
              options={getBatchOperations()}
            />
          </Form.Item>
          <Form.Item label="处理意见">
            <Input.TextArea
              rows={3}
              placeholder="请输入处理意见（可选）"
              value={batchOpinion}
              onChange={(e) => setBatchOpinion(e.target.value)}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                type="primary"
                loading={batchLoading}
                onClick={handleBatchProcess}
              >
                确认执行
              </Button>
              <Button onClick={() => setBatchModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Space>
      </Modal>

      <Drawer
        title="批量处理结果"
        placement="right"
        width={600}
        open={batchResultVisible}
        onClose={() => setBatchResultVisible(false)}
      >
        {batchResult && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="总计" value={batchResult.total} />
              </Col>
              <Col span={8}>
                <Statistic
                  title="成功"
                  value={batchResult.successCount}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="失败"
                  value={batchResult.failCount}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
            </Row>

            <Divider />

            <Title level={5}>处理明细</Title>
            {batchResult.results.map((result, index) => (
              <Card
                key={index}
                size="small"
                style={{ marginBottom: 8 }}
                title={
                  <Space>
                    {result.success ? (
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    ) : (
                      <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                    )}
                    <span>{result.formNo}</span>
                    <Tag color={result.success ? 'green' : 'red'}>
                      {result.success ? '成功' : '失败'}
                    </Tag>
                  </Space>
                }
              >
                {result.success ? (
                  <Text type="secondary">
                    新状态：{result.newStatus} | 新节点：{result.newNode}
                  </Text>
                ) : (
                  <div>
                    <Tag color="orange">{getExceptionTypeLabel(result.errorType)}</Tag>
                    <Text type="danger">{result.errorMessage}</Text>
                  </div>
                )}
              </Card>
            ))}
          </Space>
        )}
      </Drawer>
    </MainLayout>
  );
}
