import React, { useState, useEffect } from 'react';
import { Form, Select, DatePicker, Button, Space, Input, Collapse } from 'antd';
import { SearchOutlined, ReloadOutlined, FilterOutlined } from '@ant-design/icons';
import { STATUS_MAP, PRIORITY_MAP } from '../utils/constants';
import { userApi } from '../utils/api';
import type { CaseListRequest, User, CasePriority, CaseStatus } from '../../types';

const { RangePicker } = DatePicker;

interface CaseFilterProps {
  queue?: string;
  initialFilters?: Partial<CaseListRequest>;
  onFilter: (filters: Partial<CaseListRequest>) => void;
}

export default function CaseFilter({ queue, initialFilters, onFilter }: CaseFilterProps) {
  const [form] = Form.useForm();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (initialFilters) {
      form.setFieldsValue({
        ...initialFilters,
        deadline: initialFilters.deadlineFrom && initialFilters.deadlineTo
          ? [initialFilters.deadlineFrom, initialFilters.deadlineTo]
          : undefined,
      });
    }
  }, [initialFilters, form]);

  const fetchUsers = async () => {
    try {
      const response = await userApi.getList();
      setUsers(response.data.list || response.data || []);
    } catch (error) {
      console.error('获取用户列表失败', error);
    }
  };

  const handleSubmit = (values: any) => {
    const filters: Partial<CaseListRequest> = {
      keyword: values.keyword,
      handlerId: values.handlerId,
      priority: values.priority,
      status: values.status,
    };
    if (values.deadline && values.deadline.length === 2) {
      filters.deadlineFrom = values.deadline[0].format('YYYY-MM-DD');
      filters.deadlineTo = values.deadline[1].format('YYYY-MM-DD');
    }
    if (queue) {
      filters.queue = queue as any;
    }
    onFilter(filters);
  };

  const handleReset = () => {
    form.resetFields();
    const filters: Partial<CaseListRequest> = {};
    if (queue) {
      filters.queue = queue as any;
    }
    onFilter(filters);
  };

  const statusOptions = Object.entries(STATUS_MAP).map(([value, config]) => ({
    value: value as CaseStatus,
    label: config.label,
  }));

  const priorityOptions = Object.entries(PRIORITY_MAP).map(([value, config]) => ({
    value: value as CasePriority,
    label: config.label,
  }));

  const userOptions = users.map(user => ({
    value: user.id,
    label: `${user.realName} (${user.department})`,
  }));

  return (
    <Collapse 
      defaultActiveKey={['1']} 
      style={{ marginBottom: 16, background: '#fff', borderRadius: 8 }}
      items={[{
        key: '1',
        label: (
          <Space>
            <FilterOutlined />
            <span>筛选条件</span>
          </Space>
        ),
        children: (
          <Form
            form={form}
            layout="horizontal"
            onFinish={handleSubmit}
            initialValues={{ ...initialFilters }}
          >
            <Form.Item name="keyword" label="关键词" style={{ marginBottom: 12 }}>
              <Input 
                placeholder="输入案号、标题搜索" 
                allowClear
                prefix={<SearchOutlined />}
              />
            </Form.Item>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <Form.Item name="handlerId" label="责任人" style={{ marginBottom: 0 }}>
                <Select 
                  placeholder="选择责任人" 
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={userOptions}
                  loading={loading}
                />
              </Form.Item>
              <Form.Item name="priority" label="优先级" style={{ marginBottom: 0 }}>
                <Select 
                  placeholder="选择优先级" 
                  allowClear
                  options={priorityOptions}
                />
              </Form.Item>
              <Form.Item name="status" label="状态" style={{ marginBottom: 0 }}>
                <Select 
                  placeholder="选择状态" 
                  allowClear
                  options={statusOptions}
                />
              </Form.Item>
              <Form.Item name="deadline" label="截止时间" style={{ marginBottom: 0 }}>
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </div>
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Space>
                <Button onClick={handleReset} icon={<ReloadOutlined />}>
                  重置
                </Button>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                  查询
                </Button>
              </Space>
            </div>
          </Form>
        ),
      }]}
    />
  );
}
