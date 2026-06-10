import React, { useEffect, useState, useCallback } from 'react';
import { Table, Tag, Button, Space, Input, Select, Tooltip } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, CheckCircleOutlined, CheckCircleTwoTone } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getApplications } from '../api/application';
import { STATUS_LABELS, STATUS_COLORS, EXPIRY_LABELS, EXPIRY_COLORS, SUB_MODULE_LABELS, ROLE_LABELS, getUserInfo } from '../constants';
import type { Application, ApplicationStatus, ExpiryStatus, Role } from '../types';
import CreateApplicationModal from './CreateApplicationModal';
import EditApplicationModal from './EditApplicationModal';
import ExportButton from './ExportButton';

interface ApplicationListProps {
  onViewDetail: (id: string) => void;
  onBatchSelect: (ids: string[], records: Application[]) => void;
  refreshKey?: number;
}

const ApplicationList: React.FC<ApplicationListProps> = ({ onViewDetail, onBatchSelect, refreshKey }) => {
  const [data, setData] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | undefined>();
  const [expiryFilter, setExpiryFilter] = useState<ExpiryStatus | undefined>();
  const [keyword, setKeyword] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<Application[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<Application | null>(null);

  const userInfo = getUserInfo();
  const currentRole = userInfo.role as Role;
  const currentUserId = userInfo.userId;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getApplications({
        page,
        page_size: pageSize,
        status: statusFilter,
        expiry_status: expiryFilter,
        keyword,
      });
      setData(res.list || []);
      setTotal(res.total);
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, expiryFilter, keyword, refreshKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    onBatchSelect(selectedRowKeys as string[], selectedRecords);
  }, [selectedRowKeys, selectedRecords, onBatchSelect]);

  const handleEdit = (record: Application) => {
    setEditRecord(record);
    setEditOpen(true);
  };

  const canEdit = (record: Application) => {
    return currentRole === 'lease_clerk' && record.status !== 'verification_complete';
  };

  const canVerify = (record: Application) => {
    if (currentRole !== 'maintenance_coordinator') return false;
    if (record.status !== 'pending_verification') return false;
    if (record.current_handler_id && record.current_handler_id !== currentUserId) return false;
    return true;
  };

  const canConfirm = (record: Application) => {
    if (currentRole !== 'store_manager') return false;
    if (record.status !== 'verification_complete') return false;
    if (record.confirmed) return false;
    if (record.current_handler_id && record.current_handler_id !== currentUserId) return false;
    return true;
  };

  const isHandlerOf = (record: Application) => {
    if (!record.current_handler_id) return false;
    return record.current_handler_id === currentUserId;
  };

  const getRowClassName = (record: Application) => {
    if (record.expiry_status === 'overdue') return 'row-overdue';
    if (record.expiry_status === 'expiring_soon') return 'row-expiring';
    return '';
  };

  const columns = [
    { title: '申请编号', dataIndex: 'application_no', key: 'application_no', width: 140 },
    { title: '租客姓名', dataIndex: 'tenant_name', key: 'tenant_name', width: 100 },
    { title: '房间号', dataIndex: 'room_number', key: 'room_number', width: 90 },
    { title: '楼栋', dataIndex: 'building_name', key: 'building_name', width: 90 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: ApplicationStatus, record: Application) => (
        <Space size={4}>
          <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>
          {record.confirmed && (
            <Tooltip title="门店经理已确认">
              <CheckCircleTwoTone twoToneColor="#52c41a" style={{ fontSize: 16 }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '到期状态',
      dataIndex: 'expiry_status',
      key: 'expiry_status',
      width: 100,
      render: (status: ExpiryStatus, record: Application) => (
        <Space direction="vertical" size={0}>
          <Tag color={EXPIRY_COLORS[status]}>{EXPIRY_LABELS[status]}</Tag>
          {record.overdue_days > 0 && <span style={{ color: 'red', fontSize: 12 }}>逾期{record.overdue_days}天</span>}
        </Space>
      ),
    },
    {
      title: '签约状态',
      dataIndex: 'tenant_signing_status',
      key: 'tenant_signing_status',
      width: 90,
      render: (status: string) => SUB_MODULE_LABELS[status] || status,
    },
    {
      title: '当前处理人',
      key: 'handler',
      width: 140,
      render: (_: unknown, record: Application) => (
        <Tooltip title={isHandlerOf(record) ? '您负责处理' : record.current_handler_name || '待分配'}>
          <span>
            {record.current_handler_name
              ? `${record.current_handler_name}（${ROLE_LABELS[record.current_handler_role] || record.current_handler_role}）`
              : record.current_handler_role
                ? `待${ROLE_LABELS[record.current_handler_role]}`
                : '-'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 60,
      render: (v: number) => `v${v}`,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: unknown, record: Application) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => onViewDetail(record.id)}>
            查看
          </Button>
          {canEdit(record) && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
          )}
          {canVerify(record) && (
            <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => onViewDetail(record.id)}>
              核验
            </Button>
          )}
          {canConfirm(record) && (
            <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => onViewDetail(record.id)}>
              确认
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 140 }}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
          >
            {(Object.keys(STATUS_LABELS) as ApplicationStatus[]).map((k) => (
              <Select.Option key={k} value={k}>{STATUS_LABELS[k]}</Select.Option>
            ))}
          </Select>
          <Select
            placeholder="到期状态筛选"
            allowClear
            style={{ width: 140 }}
            value={expiryFilter}
            onChange={(v) => { setExpiryFilter(v); setPage(1); }}
          >
            {(Object.keys(EXPIRY_LABELS) as ExpiryStatus[]).map((k) => (
              <Select.Option key={k} value={k}>{EXPIRY_LABELS[k]}</Select.Option>
            ))}
          </Select>
          <Input.Search
            placeholder="搜索租客姓名/申请编号"
            allowClear
            style={{ width: 220 }}
            onSearch={(v) => { setKeyword(v); setPage(1); }}
          />
        </Space>
        <Space>
          <ExportButton status={statusFilter} expiryStatus={expiryFilter} keyword={keyword} />
          {currentRole === 'lease_clerk' && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              新建申请
            </Button>
          )}
        </Space>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        rowClassName={getRowClassName}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys, records) => {
            setSelectedRowKeys(keys);
            setSelectedRecords(records as Application[]);
          },
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        scroll={{ x: 1400 }}
      />

      <CreateApplicationModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={fetchData}
      />

      <EditApplicationModal
        open={editOpen}
        record={editRecord}
        onClose={() => { setEditOpen(false); setEditRecord(null); }}
        onSuccess={fetchData}
      />
    </div>
  );
};

export default ApplicationList;
