import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  Input,
  Select,
  Tooltip,
  Checkbox,
  Modal,
  Alert,
  message,
  Badge,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { orderApi } from '../api';
import type { OrderWithWarning, OrderStage, OrderStatus, Role, WarningLevel } from '../types';
import { useAuth } from '../contexts/AuthContext';
import BatchProcessModal from '../components/BatchProcessModal';

const STAGE_LABELS: Record<OrderStage, string> = {
  listing: '商品刊登',
  inventory: '库存同步',
  fulfillment: '订单履约',
};

const STAGE_COLORS: Record<OrderStage, string> = {
  listing: 'blue',
  inventory: 'purple',
  fulfillment: 'green',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待提交',
  submitted: '已提交',
  returned: '已退回',
  approved: '审核通过',
  completed: '已完成',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'default',
  submitted: 'processing',
  returned: 'error',
  approved: 'warning',
  completed: 'success',
};

const ROLE_BUTTONS: Record<Role, { submit: boolean; approve: boolean; return: boolean }> = {
  ops_specialist: { submit: true, approve: false, return: false },
  warehouse_manager: { submit: false, approve: true, return: true },
  shop_owner: { submit: false, approve: true, return: true },
};

function OrderList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderWithWarning[]>([]);
  const [stats, setStats] = useState({ pending: 0, returned: 0, resubmitted: 0 });
  const [activeGroup, setActiveGroup] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [warningFilter, setWarningFilter] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchAction, setBatchAction] = useState('');
  const [batchStage, setBatchStage] = useState<OrderStage>('listing');

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (activeGroup) params.group = activeGroup;
      if (stageFilter) params.stage = stageFilter;
      if (warningFilter) params.warning = warningFilter;
      if (searchText) params.search = searchText;
      const res = await orderApi.list(params);
      setOrders(res.orders);
      setStats(res.stats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeGroup, stageFilter, warningFilter, searchText]);

  const roleButtons = user ? ROLE_BUTTONS[user.role] : { submit: false, approve: false, return: false };

  const canOperate = (order: OrderWithWarning, action: string) => {
    if (!user) return false;
    if (action === 'submit' || action === 'resubmit') {
      return (
        user.role === 'ops_specialist' &&
        order.current_handler_id === user.id &&
        (order.current_status === 'pending' || order.current_status === 'returned')
      );
    }
    if (action === 'approve' || action === 'return') {
      if (order.current_status !== 'submitted') return false;
      if (order.current_stage === 'fulfillment') {
        return user.role === 'shop_owner' && order.current_handler_id === user.id;
      }
      return user.role === 'warehouse_manager' && order.current_handler_id === user.id;
    }
    return false;
  };

  const handleBatchClick = (action: string) => {
    if (selectedKeys.length === 0) {
      message.warning('请先选择要操作的订单');
      return;
    }
    setBatchAction(action);
    const selectedOrders = orders.filter((o) => selectedKeys.includes(o.id));
    if (selectedOrders.length > 0) {
      setBatchStage(selectedOrders[0].current_stage);
    }
    setBatchModalOpen(true);
  };

  const warningTag = (level: WarningLevel, text: string, dueAt?: string) => {
    const cls =
      level === 'overdue'
        ? 'warning-tag-overdue'
        : level === 'near_due'
        ? 'warning-tag-near'
        : 'warning-tag-normal';
    const icon =
      level === 'overdue' ? (
        <ExclamationCircleOutlined />
      ) : level === 'near_due' ? (
        <WarningOutlined />
      ) : (
        <CheckCircleOutlined />
      );
    return (
      <Tooltip title={dueAt ? `到期时间: ${dayjs(dueAt).format('YYYY-MM-DD HH:mm')}` : ''}>
        <span
          className={cls}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 12,
          }}
        >
          {icon} {text}
        </span>
      </Tooltip>
    );
  };

  const getStageDueAt = (order: OrderWithWarning) => {
    switch (order.current_stage) {
      case 'listing':
        return order.listing_due_at;
      case 'inventory':
        return order.inventory_due_at;
      case 'fulfillment':
        return order.fulfillment_due_at;
    }
  };

  const columns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 150,
      fixed: 'left' as const,
      render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: '商品信息',
      key: 'product',
      width: 200,
      render: (_: any, r: OrderWithWarning) => (
        <div>
          <div style={{ fontWeight: 500, color: '#262626' }}>{r.product_name}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
            SKU: {r.sku} · {r.quantity}件
          </div>
        </div>
      ),
    },
    {
      title: '店铺 / 目的国',
      key: 'shop',
      width: 160,
      render: (_: any, r: OrderWithWarning) => (
        <div>
          <div>{r.shop_name}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
            <Badge status="default" /> {r.country} · ¥{r.amount.toLocaleString()}
          </div>
        </div>
      ),
    },
    {
      title: '当前环节',
      dataIndex: 'current_stage',
      key: 'current_stage',
      width: 100,
      render: (v: OrderStage) => <Tag color={STAGE_COLORS[v]}>{STAGE_LABELS[v]}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'current_status',
      key: 'current_status',
      width: 100,
      render: (v: OrderStatus, r: OrderWithWarning) => (
        <Space>
          <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v]}</Tag>
          {r.is_resubmitted && <Tag color="orange">重新提交</Tag>}
          {r.resubmit_count > 0 && (
            <Tag style={{ background: '#fff7e6', color: '#d46b08', borderColor: '#ffd591' }}>
              {r.resubmit_count}次
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '材料附件',
      key: 'attachments',
      width: 120,
      render: (_: any, r: OrderWithWarning) => (
        <Space>
          <Tag icon={<PaperClipOutlined />} color={r.stage_attach_count > 0 ? 'blue' : 'default'}>
            本环节 {r.stage_attach_count}
          </Tag>
          {r.attachment_count > r.stage_attach_count && (
            <Tag style={{ color: '#8c8c8c' }}>
              全单 {r.attachment_count}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '到期预警',
      key: 'warning',
      width: 130,
      render: (_: any, r: OrderWithWarning) =>
        warningTag(r.warning_level, r.warning_text, getStageDueAt(r)),
    },
    {
      title: '当前处理人',
      key: 'handler',
      width: 120,
      render: (_: any, r: OrderWithWarning) =>
        r.current_handler ? r.current_handler.name : <Tag color="default">无</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, r: OrderWithWarning) => {
        const isMyTurn = r.current_handler_id === user?.id;
        return (
          <Space size="small">
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/orders/${r.id}`)}
            >
              详情
            </Button>
            {canOperate(r, 'submit') && (
              <Button
                type="primary"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => navigate(`/orders/${r.id}`)}
              >
                {r.current_status === 'returned' ? '重新提交' : '去办理'}
              </Button>
            )}
            {(canOperate(r, 'approve') || canOperate(r, 'return')) && (
              <Button
                type="primary"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => navigate(`/orders/${r.id}`)}
              >
                去审核
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const groupCards = [
    { key: '', label: '全部订单', value: orders.length || 0, icon: <SyncOutlined spin />, color: 'default' },
    { key: 'pending', label: '待提交', value: stats.pending, icon: <ClockCircleOutlined />, color: 'blue' },
    { key: 'returned', label: '已退回', value: stats.returned, icon: <ExclamationCircleOutlined />, color: 'red' },
    { key: 'resubmitted', label: '重新提交', value: stats.resubmitted, icon: <SyncOutlined />, color: 'orange' },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {groupCards.map((g) => (
          <Col span={6} key={g.key}>
            <Card
              className={`stat-card ${activeGroup === g.key ? 'active' : ''}`}
              onClick={() => {
                setActiveGroup(activeGroup === g.key ? '' : g.key);
              }}
              bordered
            >
              <Statistic
                title={
                  <Space>
                    {g.icon}
                    {g.label}
                  </Space>
                }
                value={g.value}
                valueStyle={{ color: g.color === 'red' ? '#ff4d4f' : g.color === 'orange' ? '#fa8c16' : '#1677ff' }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="搜索订单号/商品/SKU/店铺"
            prefix={<SearchOutlined />}
            style={{ width: 280 }}
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select
            placeholder="环节筛选"
            style={{ width: 140 }}
            allowClear
            value={stageFilter || undefined}
            onChange={setStageFilter}
            options={[
              { value: 'listing', label: '商品刊登' },
              { value: 'inventory', label: '库存同步' },
              { value: 'fulfillment', label: '订单履约' },
            ]}
          />
          <Select
            placeholder="预警筛选"
            style={{ width: 140 }}
            allowClear
            value={warningFilter || undefined}
            onChange={setWarningFilter}
            options={[
              { value: 'normal', label: '正常' },
              { value: 'near_due', label: '临期' },
              { value: 'overdue', label: '逾期' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            刷新
          </Button>

          {selectedKeys.length > 0 && (
            <Space style={{ marginLeft: 'auto' }}>
              <span style={{ color: '#8c8c8c' }}>已选 {selectedKeys.length} 项</span>
              {roleButtons.submit && (
                <Button type="primary" onClick={() => handleBatchClick('submit')}>
                  批量提交
                </Button>
              )}
              {roleButtons.approve && (
                <Button type="primary" onClick={() => handleBatchClick('approve')}>
                  批量审核通过
                </Button>
              )}
              {roleButtons.return && (
                <Button danger onClick={() => handleBatchClick('return')}>
                  批量退回
                </Button>
              )}
            </Space>
          )}
        </Space>

        {activeGroup && (
          <Alert
            message={`当前筛选: ${groupCards.find((g) => g.key === activeGroup)?.label}`}
            type="info"
            showIcon
            closable
            onClose={() => setActiveGroup('')}
            style={{ marginBottom: 16 }}
          />
        )}

        <Table
          rowKey="id"
          loading={loading}
          dataSource={orders}
          columns={columns}
          scroll={{ x: 1200 }}
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (keys) => setSelectedKeys(keys as string[]),
            getCheckboxProps: (record: OrderWithWarning) => ({
              disabled: record.current_handler_id !== user?.id || record.current_status === 'completed',
            }),
          }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      <BatchProcessModal
        open={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        action={batchAction}
        stage={batchStage}
        selectedOrders={orders.filter((o) => selectedKeys.includes(o.id))}
        onSuccess={loadData}
      />
    </div>
  );
}

export default OrderList;
