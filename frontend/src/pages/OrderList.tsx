import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Table, Tag, Button, Select, Space, Card, Row, Col, Checkbox, Modal, Form, Input,
  Radio, message, Tooltip, Statistic, Empty
} from 'antd';
import {
  CheckCircleOutlined, ExclamationCircleOutlined, WarningOutlined,
  ClockCircleOutlined, FileTextOutlined, EyeOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, InboundOrder, ROLE_LABEL, STATUS_LABEL, ProcessOrderRequest, BatchResultItem } from '../api';

const { TextArea } = Input;
const { Option } = Select;

export default function OrderList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [orders, setOrders] = useState<InboundOrder[]>([]);
  const [groups, setGroups] = useState<any>(null);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [urgencyFilter, setUrgencyFilter] = useState<string | undefined>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchForm] = Form.useForm();
  const [batchLoading, setBatchLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grouped'>('table');

  const loadData = async () => {
    setLoading(true);
    try {
      const resp = await api.listOrders(statusFilter, urgencyFilter);
      if (resp.data.success && resp.data.data) {
        setOrders(resp.data.data.orders || []);
        setGroups(resp.data.data.groups || null);
        setStats(resp.data.data.stats || {});
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
    loadData();
  }, [statusFilter, urgencyFilter, location.pathname]);

  const statusColor = (s: string) => {
    if (s === 'pending_confirmation') return 'processing';
    if (s === 'exception') return 'warning';
    if (s === 'rechecked') return 'success';
    return 'default';
  };

  const urgencyTag = (u?: { key: string; label: string }) => {
    if (!u) return null;
    const color = u.key === 'overdue' ? 'red' : u.key === 'near' ? 'orange' : 'green';
    const icon = u.key === 'overdue' ? <ExclamationCircleOutlined /> : u.key === 'near' ? <WarningOutlined /> : <CheckCircleOutlined />;
    return <Tag color={color} icon={icon}>{u.label}</Tag>;
  };

  const deadlineDisplay = (order: InboundOrder) => {
    if (!order.deadline) return <span style={{ color: '#8c8c8c' }}>无</span>;
    const now = dayjs();
    const d = dayjs(order.deadline);
    const diffH = d.diff(now, 'hour');
    const overdue = diffH < 0;
    return (
      <div>
        <div style={{ color: overdue ? '#ff4d4f' : diffH <= 6 ? '#fa8c16' : '#1f1f1f', fontWeight: 500 }}>
          {d.format('YYYY-MM-DD HH:mm')}
        </div>
        <div style={{ fontSize: 12, color: '#8c8c8c' }}>
          {overdue ? `已逾期 ${Math.abs(diffH)} 小时` : `剩余 ${diffH} 小时`}
        </div>
      </div>
    );
  };

  const columns = [
    { title: '入库单号', dataIndex: 'order_no', width: 160, fixed: 'left' as const, render: (v: string, r: any) => <a onClick={() => navigate(`/orders/${r.id}`)} style={{ fontWeight: 500 }}>{v}</a> },
    { title: '供应商', dataIndex: 'supplier_name', width: 150 },
    { title: '物料名称', dataIndex: 'material_name', width: 180 },
    { title: '数量', dataIndex: 'quantity', width: 80 },
    {
      title: '状态', dataIndex: 'status', width: 140,
      render: (_: any, r: any) => (
        <div>
          <Tag color={statusColor(r.status)}><FileTextOutlined /> {STATUS_LABEL[r.status] || r.status}</Tag>
          {r.exception_count > 0 && (
            <Tooltip title={r.exception_latest || ''}>
              <Tag color="volcano" style={{ marginLeft: 4, fontSize: 12 }}>异常{r.exception_count}条</Tag>
            </Tooltip>
          )}
        </div>
      )
    },
    {
      title: '到期预警', width: 100,
      render: (_: any, r: InboundOrder) => urgencyTag(r.urgency)
    },
    { title: '截止时间', width: 180, render: (_: any, r: InboundOrder) => deadlineDisplay(r) },
    {
      title: '当前处理人', width: 160,
      render: (_: any, r: InboundOrder) => (
        <div>
          <div>{r.current_handler_name || '-'}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>
            {r.current_handler_role ? ROLE_LABEL[r.current_handler_role] : ''}
          </div>
        </div>
      )
    },
    {
      title: '模块完成情况', width: 200,
      render: (_: any, r: InboundOrder) => (
        <Space size={4}>
          <Tooltip title="入库预约"><Tag color={r.appointment_complete ? 'green' : 'default'}>预约{r.appointment_complete ? '✓' : '✗'}</Tag></Tooltip>
          <Tooltip title="质检上架"><Tag color={r.inspection_complete ? 'green' : 'default'}>质检{r.inspection_complete ? '✓' : '✗'}</Tag></Tooltip>
          <Tooltip title="入库单登记"><Tag color={r.registration_complete ? 'green' : 'default'}>登记{r.registration_complete ? '✓' : '✗'}</Tag></Tooltip>
        </Space>
      )
    },
    {
      title: '版本', width: 60,
      render: (_: any, r: InboundOrder) => <Tag color="blue" style={{ fontSize: 12 }}>v{r.version}</Tag>
    },
    {
      title: '上一处理意见', width: 180,
      ellipsis: true,
      render: (_: any, r: InboundOrder) => (
        <Tooltip title={r.last_opinion || '暂无'}>
          <span style={{ color: r.last_opinion ? '#1f1f1f' : '#bfbfbf' }}>
            {r.last_opinion || '暂无'}
          </span>
        </Tooltip>
      )
    },
    {
      title: '操作', width: 120, fixed: 'right' as const,
      render: (_: any, r: any) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/orders/${r.id}`)}>查看详情</Button>
      )
    },
  ];

  const handleBatchProcess = async (values: any) => {
    setBatchLoading(true);
    try {
      const selectedOrders = orders.filter((o) => selectedIds.includes(o.id));
      const reqs: ProcessOrderRequest[] = selectedOrders.map((o) => ({
        order_id: o.id,
        version: o.version,
        action: values.action,
        opinion: values.opinion,
        audit_note: values.audit_note,
        exception_reason: values.exception_reason,
        exception_module: values.exception_module,
      }));
      const resp = await api.batchProcess(reqs);
      if (resp.data.success && resp.data.data) {
        const successCount = resp.data.data.filter((r) => r.success).length;
        localStorage.setItem('lastBatchResult', JSON.stringify(resp.data.data));
        message.success(`批量处理完成：成功 ${successCount} / 失败 ${resp.data.data.length - successCount}`);
        setBatchModalOpen(false);
        batchForm.resetFields();
        setSelectedIds([]);
        navigate('/batch-result');
      } else {
        message.error(resp.data.message || '处理失败');
      }
    } finally {
      setBatchLoading(false);
    }
  };

  const isManager = user?.role === 'operations_manager';
  const isSupervisor = user?.role === 'warehouse_supervisor';
  const isKeeper = user?.role === 'warehouse_keeper';

  const availableActions = () => {
    const actions: { label: string; value: string; needException: boolean }[] = [];
    if (isKeeper) {
      actions.push({ label: '提交', value: '提交', needException: false });
      actions.push({ label: '补正', value: '补正', needException: false });
    }
    if (isSupervisor || isManager) {
      actions.push({ label: isManager ? '最终确认' : '确认通过', value: isManager ? '最终确认' : '确认通过', needException: false });
      actions.push({ label: '退回补正', value: '退回补正', needException: true });
    }
    return actions;
  };

  const canProcess = (order: InboundOrder) => {
    if (!user) return false;
    if (order.status === 'rechecked') return false;
    return order.current_handler_id === user.id && order.current_handler_role === user.role;
  };

  const rowSelectionBase = {
    selectedRowKeys: selectedIds,
    onChange: (keys: any) => setSelectedIds(keys as string[]),
    getCheckboxProps: (record: InboundOrder) => ({
      disabled: !canProcess(record),
      title: canProcess(record) ? '可批量办理' : '非您负责或已归档，无法批量办理',
    }),
    preserveSelectedRowKeys: true,
  };

  const renderGroupedView = () => {
    if (!groups) return null;
    return (
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        {(['overdue', 'near', 'normal'] as const).map((key) => {
          const g = groups[key];
          if (!g) return null;
          const titleBg = key === 'overdue' ? '#fff1f0' : key === 'near' ? '#fff7e6' : '#f6ffed';
          const titleColor = key === 'overdue' ? '#ff4d4f' : key === 'near' ? '#fa8c16' : '#52c41a';
          return (
            <div key={key} className="group-section">
              <div className="group-title" style={{ background: titleBg, color: titleColor }}>
                {g.label}（{g.list.length} 条）
              </div>
              <Table
                size="middle"
                rowKey="id"
                dataSource={g.list}
                columns={columns}
                rowSelection={rowSelectionBase}
                pagination={false}
                locale={{ emptyText: <Empty description="暂无单据" /> }}
              />
            </div>
          );
        })}
      </Space>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="page-title">📋 入库单列表</div>
          <div style={{ color: '#8c8c8c', fontSize: 13, marginTop: 4 }}>
            当前身份：<strong>{ROLE_LABEL[user?.role] || '-'}</strong> · {user?.name || ''}
          </div>
        </div>
        <Space>
          {isManager && (
            <Radio.Group value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
              <Radio.Button value="table">表格视图</Radio.Button>
              <Radio.Button value="grouped">按预警分组</Radio.Button>
            </Radio.Group>
          )}
          <Button onClick={loadData}>刷新</Button>
          <Button
            type="primary"
            disabled={selectedIds.length === 0}
            onClick={() => setBatchModalOpen(true)}
          >
            批量处理（{selectedIds.length}）
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <div className="stats-card">
            <div className="stats-number" style={{ color: '#1677ff' }}>{stats.total || 0}</div>
            <div className="stats-label">全部单据</div>
          </div>
        </Col>
        <Col span={6}>
          <div className="stats-card">
            <div className="stats-number" style={{ color: '#1677ff' }}>{stats.pending || 0}</div>
            <div className="stats-label">待确认</div>
          </div>
        </Col>
        <Col span={6}>
          <div className="stats-card">
            <div className="stats-number" style={{ color: '#fa8c16' }}>{stats.exception || 0}</div>
            <div className="stats-label">异常</div>
          </div>
        </Col>
        <Col span={6}>
          <div className="stats-card">
            <div className="stats-number" style={{ color: '#52c41a' }}>{stats.rechecked || 0}</div>
            <div className="stats-label">已复查</div>
          </div>
        </Col>
        {isManager && (
          <>
            <Col span={8}>
              <div className="stats-card">
                <div className="stats-number" style={{ color: '#52c41a' }}>{stats.normal || 0}</div>
                <div className="stats-label">正常</div>
              </div>
            </Col>
            <Col span={8}>
              <div className="stats-card">
                <div className="stats-number" style={{ color: '#fa8c16' }}>{stats.near || 0}</div>
                <div className="stats-label">临期（6小时内）</div>
              </div>
            </Col>
            <Col span={8}>
              <div className="stats-card">
                <div className="stats-number" style={{ color: '#ff4d4f' }}>{stats.overdue || 0}</div>
                <div className="stats-label">已逾期</div>
              </div>
            </Col>
          </>
        )}
      </Row>

      <div className="filter-bar">
        <span style={{ color: '#8c8c8c' }}>筛选：</span>
        <Select
          placeholder="状态"
          style={{ width: 140 }}
          allowClear
          value={statusFilter}
          onChange={setStatusFilter}
        >
          <Option value="pending_confirmation">待确认</Option>
          <Option value="exception">异常</Option>
          <Option value="rechecked">已复查</Option>
        </Select>
        {isManager && (
          <Select
            placeholder="到期预警"
            style={{ width: 160 }}
            allowClear
            value={urgencyFilter}
            onChange={setUrgencyFilter}
          >
            <Option value="normal">正常</Option>
            <Option value="near">临期（6小时内）</Option>
            <Option value="overdue">已逾期</Option>
          </Select>
        )}
        <span style={{ marginLeft: 'auto', color: '#8c8c8c', fontSize: 13 }}>
          <Checkbox checked={false} disabled />勾选后可批量处理
        </span>
      </div>

      {viewMode === 'table' || !isManager ? (
        <Table
          size="middle"
          rowKey="id"
          loading={loading}
          dataSource={orders}
          columns={columns}
          rowSelection={rowSelectionBase}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1500 }}
          locale={{ emptyText: <Empty description="暂无符合条件的入库单" /> }}
        />
      ) : (
        renderGroupedView()
      )}

      <Modal
        title={`批量处理 ${selectedIds.length} 条入库单`}
        open={batchModalOpen}
        onCancel={() => setBatchModalOpen(false)}
        footer={null}
        width={560}
        destroyOnClose
      >
        <Form form={batchForm} layout="vertical" onFinish={handleBatchProcess}>
          <Form.Item name="action" label="操作类型" rules={[{ required: true, message: '请选择操作类型' }]}>
            <Select>
              {availableActions().map((a) => (
                <Option key={a.value} value={a.value}>{a.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="opinion" label="处理意见" rules={[{ required: true, message: '请填写处理意见' }]}>
            <TextArea rows={3} placeholder="请填写处理意见" />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.action !== cur.action}
          >
            {({ getFieldValue }) => {
              const action = getFieldValue('action');
              const needException = availableActions().find((a) => a.value === action)?.needException;
              return needException ? (
                <>
                  <Form.Item name="exception_module" label="异常所属模块" rules={[{ required: true, message: '请选择模块' }]}>
                    <Select>
                      <Option value="appointment">入库预约</Option>
                      <Option value="inspection">质检上架</Option>
                      <Option value="registration">入库单登记</Option>
                      <Option value="general">综合</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item name="exception_reason" label="异常原因" rules={[{ required: true, message: '请填写异常原因' }]}>
                    <TextArea rows={3} placeholder="请详细描述异常原因" />
                  </Form.Item>
                </>
              ) : null;
            }}
          </Form.Item>
          {isManager && (
            <Form.Item name="audit_note" label="审计备注（必填）" rules={[{ required: true, message: '运营经理必须填写审计备注' }]}>
              <TextArea rows={2} placeholder="请填写审计备注" />
            </Form.Item>
          )}
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={batchLoading}>确认批量处理</Button>
              <Button onClick={() => setBatchModalOpen(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
