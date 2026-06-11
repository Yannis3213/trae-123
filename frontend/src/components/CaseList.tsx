import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Tag, 
  message, 
  Popconfirm,
  Tooltip,
  Card,
  Empty,
  Spin
} from 'antd';
import type { TablePaginationConfig, TableRowSelection } from 'antd/es/table/interface';
import { 
  EyeOutlined, 
  PlusOutlined, 
  EditOutlined, 
  SendOutlined,
  DeleteOutlined,
  BatchProcessingOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { caseApi } from '../utils/api';
import { STATUS_MAP, PRIORITY_MAP } from '../utils/constants';
import CaseFilter from './CaseFilter';
import WarningBadge from './WarningBadge';
import BatchProcessModal from './BatchProcessModal';
import type { 
  LegalCase, 
  CaseListRequest, 
  CaseListResponse,
  CaseStatus,
  CaseQueue 
} from '../../types';

interface CaseListProps {
  queue?: CaseQueue;
  showBatch?: boolean;
  onView?: (caseItem: LegalCase) => void;
  onEdit?: (caseItem: LegalCase) => void;
  onCreate?: () => void;
  initialFilters?: Partial<CaseListRequest>;
}

export default function CaseList({ 
  queue, 
  showBatch = true,
  onView, 
  onEdit,
  onCreate,
  initialFilters 
}: CaseListProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LegalCase[]>([]);
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total) => `共 ${total} 条`,
  });
  const [filters, setFilters] = useState<Partial<CaseListRequest>>(initialFilters || {});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedCases, setSelectedCases] = useState<LegalCase[]>([]);
  const [batchModalVisible, setBatchModalVisible] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: CaseListRequest = {
        page: pagination.current,
        page_size: pagination.pageSize,
        ...filters,
      };
      if (queue) {
        (params as any).queue = queue;
      }
      const result: CaseListResponse = await caseApi.getList(params);
      setData(result.list);
      setPagination(prev => ({
        ...prev,
        current: result.page,
        pageSize: result.page_size,
        total: result.total,
      }));
    } catch (error) {
      message.error('获取案件列表失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters, queue]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (initialFilters) {
      setFilters(initialFilters);
      setPagination(prev => ({ ...prev, current: 1 }));
    }
  }, [initialFilters]);

  const handleFilter = (newFilters: Partial<CaseListRequest>) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, current: 1 }));
    setSelectedRowKeys([]);
    setSelectedCases([]);
  };

  const handleTableChange = (paginationConfig: TablePaginationConfig) => {
    setPagination(paginationConfig);
  };

  const handleAction = async (caseId: number, action: string, version: number) => {
    try {
      await caseApi.action(caseId, { action, version });
      message.success('操作成功');
      fetchData();
    } catch (error: any) {
      message.error(error.message || error.response?.data?.message || '操作失败');
    }
  };

  const handleDelete = async (caseId: number) => {
    try {
      await caseApi.update(caseId, { status: 'archived' });
      message.success('删除成功');
      fetchData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const rowSelection: TableRowSelection<LegalCase> = {
    selectedRowKeys,
    onChange: (keys, rows) => {
      setSelectedRowKeys(keys);
      setSelectedCases(rows);
    },
    getCheckboxProps: (record) => ({
      disabled: !['pending_submit', 'returned'].includes(record.status),
    }),
  };

  const canBatchProcess = selectedCases.some(c => 
    ['pending_submit', 'returned'].includes(c.status)
  );

  const columns = [
    {
      title: '案号',
      dataIndex: 'case_no',
      key: 'case_no',
      width: 140,
      fixed: 'left' as const,
      render: (text: string, record: LegalCase) => (
        <a onClick={() => onView?.(record)}>{text}</a>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string, record: LegalCase) => (
        <Tooltip title={text}>
          <a onClick={() => onView?.(record)}>{text}</a>
        </Tooltip>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: string) => {
        const label = PRIORITY_MAP[priority as keyof typeof PRIORITY_MAP];
        const color = PRIORITY_COLOR_MAP[priority as keyof typeof PRIORITY_COLOR_MAP];
        return <Tag color={color as any}>{label}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: CaseStatus) => {
        const label = STATUS_MAP[status];
        const color = STATUS_COLOR_MAP[status];
        return <Tag color={color as any}>{label}</Tag>;
      },
    },
    {
      title: '预警',
      dataIndex: 'warning_status',
      key: 'warning_status',
      width: 90,
      render: (status?: string) => <WarningBadge status={status as any} />,
    },
    {
      title: '当前处理人',
      dataIndex: 'current_handler_name',
      key: 'current_handler_name',
      width: 100,
      render: (name?: string) => name || '-',
    },
    {
      title: '截止时间',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 110,
      render: (date?: string | null) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_: unknown, record: LegalCase) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => onView?.(record)}
          >
            查看
          </Button>
          {['draft', 'pending_submit', 'returned'].includes(record.status) && (
            <Button 
              type="link" 
              size="small" 
              icon={<EditOutlined />}
              onClick={() => onEdit?.(record)}
            >
              编辑
            </Button>
          )}
          {record.status === 'pending_submit' && (
            <Popconfirm
              title="确定提交该案件吗？"
              onConfirm={() => handleAction(record.id, 'submit', record.version)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" icon={<SendOutlined />}>
                提交
              </Button>
            </Popconfirm>
          )}
          {record.status === 'returned' && (
            <Popconfirm
              title="确定重新提交该案件吗？"
              onConfirm={() => handleAction(record.id, 'resubmit', record.version)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" icon={<SendOutlined />}>
                重提
              </Button>
            </Popconfirm>
          )}
          {record.status === 'draft' && (
            <Popconfirm
              title="确定删除该案件吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
              okType="danger"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card 
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: '16px 24px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>
              {queue ? `${queue === 'registration' ? '咨询登记' : 
                queue === 'assignment' ? '案件分派' :
                queue === 'followup' ? '回访确认' :
                queue === 'review' ? '质量审核' : '结案归档'}列表` : '全部案件'}
            </h2>
          </div>
          <Space>
            {showBatch && (
              <Button 
                icon={<BatchProcessingOutlined />}
                disabled={!canBatchProcess}
                onClick={() => setBatchModalVisible(true)}
              >
                批量处理 ({selectedRowKeys.length})
              </Button>
            )}
            {onCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
                新建案件
              </Button>
            )}
          </Space>
        </div>
      </Card>

      <CaseFilter 
        queue={queue}
        initialFilters={initialFilters}
        onFilter={handleFilter}
      />

      <Card bodyStyle={{ padding: 0 }}>
        <Spin spinning={loading}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={data}
            pagination={pagination}
            onChange={handleTableChange}
            rowSelection={showBatch ? rowSelection : undefined}
            scroll={{ x: 1200 }}
            locale={{
              emptyText: <Empty description="暂无案件数据" />,
            }}
          />
        </Spin>
      </Card>

      <BatchProcessModal
        open={batchModalVisible}
        selectedCases={selectedCases}
        onClose={() => setBatchModalVisible(false)}
        onSuccess={() => {
          fetchData();
          setSelectedRowKeys([]);
          setSelectedCases([]);
        }}
      />
    </div>
  );
}
