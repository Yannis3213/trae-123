import React, { useState, useEffect } from 'react'
import { Table, Button, Space, Form, Select, Input, Tooltip } from 'antd'
import { SearchOutlined, ReloadOutlined, BatchProcessOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { LIST_STATUS_OPTIONS, ROLE_LABELS, ROLE_KEYS } from '../utils/constants.js'
import { OrderStatusBadge, DueWarningBadge, ModuleStatusBadge } from './StatusBadge.jsx'
import { formatDate, getWarningLevel, truncateText, getRoleDisplay } from '../utils/helpers.js'
import { orderApi, userApi } from '../api.js'
import BatchProcess from './BatchProcess.jsx'

const roleOptions = Object.entries(ROLE_KEYS).map(([key, value]) => ({
  value,
  label: ROLE_LABELS[value]
}))

export default function OrderList({ onRefresh }) {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 })
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [selectedOrders, setSelectedOrders] = useState([])
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [handlerOptions, setHandlerOptions] = useState([])

  const fetchHandlers = async () => {
    try {
      const result = await userApi.list()
      if (Array.isArray(result)) {
        setHandlerOptions(result.map((u) => ({
          value: u.id,
          label: u.username
        })))
      }
    } catch (err) {
      console.error('获取处理人列表失败', err)
    }
  }

  useEffect(() => {
    fetchHandlers()
  }, [])

  const fetchData = async (params = {}) => {
    setLoading(true)
    try {
      const formValues = form.getFieldsValue()
      const queryParams = {
        page: pagination.current,
        page_size: pagination.pageSize,
        ...params
      }
      if (formValues.status) queryParams.status = formValues.status
      if (formValues.clue) queryParams.clue = formValues.clue
      if (formValues.handler_id) queryParams.handler_id = formValues.handler_id
      if (formValues.role) queryParams.role = formValues.role

      const result = await orderApi.list(queryParams)
      if (Array.isArray(result)) {
        setData(result)
        setTotal(result.length)
      } else if (result && Array.isArray(result.results)) {
        setData(result.results)
        setTotal(result.count || result.results.length)
      } else if (result && Array.isArray(result.data)) {
        setData(result.data)
        setTotal(result.total || result.data.length)
      }
    } catch (err) {
      console.error('获取订单列表失败', err)
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [pagination.current, pagination.pageSize, onRefresh])

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, current: 1 }))
    fetchData()
  }

  const handleReset = () => {
    form.resetFields()
    setPagination((prev) => ({ ...prev, current: 1 }))
    fetchData()
  }

  const handleBatchProcess = () => {
    if (selectedOrders.length === 0) return
    setBatchModalOpen(true)
  }

  const columns = [
    {
      title: '订单编号',
      dataIndex: 'order_no',
      width: 180,
      fixed: 'left',
      render: (text, record) => (
        <a onClick={() => navigate(`/orders/${record.id}`)}>{text || record.orderNo || '-'}</a>
      )
    },
    {
      title: '订单标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>{truncateText(text, 30)}</Tooltip>
      )
    },
    {
      title: '项目名称',
      dataIndex: 'project_name',
      width: 160,
      ellipsis: true,
      render: (text) => <Tooltip title={text}>{truncateText(text, 15)}</Tooltip>
    },
    {
      title: '需求确认线索',
      dataIndex: 'requirement_confirmation_clue',
      width: 140,
      render: (text) => text || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 140,
      render: (status, record) => <OrderStatusBadge status={status || record.status} />
    },
    {
      title: '当前处理人',
      dataIndex: 'current_handler',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 80,
      render: (v) => v ? `V${v}` : '-'
    },
    {
      title: '需求确认状态',
      dataIndex: 'requirement_status',
      width: 120,
      render: (status) => <ModuleStatusBadge status={status} />
    },
    {
      title: '排期评估状态',
      dataIndex: 'schedule_status',
      width: 120,
      render: (status) => <ModuleStatusBadge status={status} />
    },
    {
      title: '交付验收状态',
      dataIndex: 'delivery_status',
      width: 120,
      render: (status) => <ModuleStatusBadge status={status} />
    },
    {
      title: '需求截止日期',
      dataIndex: 'requirement_deadline',
      width: 120,
      render: (date) => {
        if (!date) return '-'
        const level = getWarningLevel(date)
        return (
          <span className={`warning-${level}`}>
            {formatDate(date, 'YYYY-MM-DD')}
          </span>
        )
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
      render: (date, record) => formatDate(date || record.createdAt)
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/orders/${record.id}`)}
        >
          详情
        </Button>
      )
    }
  ]

  return (
    <div>
      <div className="filter-bar">
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Form.Item name="status" label="状态">
            <Select placeholder="全部状态" options={LIST_STATUS_OPTIONS} allowClear style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="clue" label="需求确认线索">
            <Input placeholder="输入线索编号" style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select placeholder="全部角色" options={roleOptions} allowClear style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="handler_id" label="处理人">
            <Select
              placeholder="选择处理人"
              options={handlerOptions}
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: 140 }}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                查询
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<BatchProcessOutlined />}
            onClick={handleBatchProcess}
            disabled={selectedRowKeys.length === 0}
          >
            批量处理 {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={data}
        scroll={{ x: 1600 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys, rows) => {
            setSelectedRowKeys(keys)
            setSelectedOrders(rows)
          }
        }}
        pagination={{
          ...pagination,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (current, pageSize) => setPagination({ current, pageSize })
        }}
      />

      <BatchProcess
        open={batchModalOpen}
        selectedOrders={selectedOrders}
        onCancel={() => setBatchModalOpen(false)}
        onSuccess={() => {
          setSelectedRowKeys([])
          setSelectedOrders([])
          fetchData()
        }}
      />
    </div>
  )
}
