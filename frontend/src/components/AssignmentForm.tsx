import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Input, 
  Card, 
  Button, 
  message, 
  Space, 
  Tag, 
  Descriptions,
  Divider,
  Row,
  Col,
  Alert,
  Spin,
  Select
} from 'antd';
import { 
  SaveOutlined, 
  CheckCircleOutlined, 
  EditOutlined,
  UserSwitchOutlined,
  UserOutlined,
  FormOutlined
} from '@ant-design/icons';
import { assignmentApi, userApi } from '../utils/api';
import StatusActionButtons from './StatusActionButtons';
import type { CaseAssignment, LegalCase, User } from '../../types';

const { TextArea } = Input;

interface AssignmentFormProps {
  caseId: number;
  caseItem: LegalCase;
  mode?: 'view' | 'edit';
  onModeChange?: (mode: 'view' | 'edit') => void;
  onDataChange?: () => void;
}

export default function AssignmentForm({ 
  caseId, 
  caseItem,
  mode = 'view',
  onModeChange,
  onDataChange
}: AssignmentFormProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [data, setData] = useState<CaseAssignment | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const isEditable = ['draft', 'pending_submit', 'returned'].includes(caseItem.status);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (caseId) {
      fetchData();
    }
  }, [caseId]);

  useEffect(() => {
    if (data && mode === 'edit') {
      form.setFieldsValue({
        assistant_id: data.assistant_id,
        lawyer_id: data.lawyer_id,
        assignment_reason: data.assignment_reason,
        assignment_remark: data.assignment_remark,
      });
    }
  }, [data, mode, form]);

  const fetchUsers = async () => {
    try {
      const result = await userApi.getList();
      const userList: any = result;
      setUsers(userList.list || userList || []);
    } catch (error) {
      console.error('获取用户列表失败', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await assignmentApi.get(caseId);
      setData(result);
    } catch (error) {
      message.error('获取案件分派信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await assignmentApi.save(caseId, values);
      message.success('保存成功');
      setHasUnsavedChanges(false);
      await fetchData();
      onDataChange?.();
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请填写完整的必填项');
      } else {
        message.error(error.message || error.response?.data?.message || '保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await assignmentApi.verify(caseId);
      message.success('核验通过');
      await fetchData();
      onDataChange?.();
    } catch (error: any) {
      message.error(error.message || error.response?.data?.message || '核验失败');
    } finally {
      setVerifying(false);
    }
  };

  const handleEdit = () => {
    onModeChange?.('edit');
  };

  const handleCancel = () => {
    form.resetFields();
    setHasUnsavedChanges(false);
    onModeChange?.('view');
  };

  const handleValuesChange = () => {
    setHasUnsavedChanges(true);
  };

  const assistantOptions = users
    .filter(u => ['assistant', 'lawyer'].includes(u.role))
    .map(u => ({
      value: u.id,
      label: `${u.real_name} (${u.department})`,
    }));

  const lawyerOptions = users
    .filter(u => u.role === 'lawyer')
    .map(u => ({
      value: u.id,
      label: `${u.real_name} (${u.department})`,
    }));

  if (loading) {
    return (
      <Card title="案件分派">
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <UserSwitchOutlined />
          案件分派
          {data?.is_complete && (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              已核验
            </Tag>
          )}
        </Space>
      }
      extra={
        mode === 'view' && isEditable && (
          <Button 
            icon={<EditOutlined />} 
            onClick={handleEdit}
          >
            编辑
          </Button>
        )
      }
    >
      {!data?.is_complete && mode === 'view' && (
        <Alert
          type="warning"
          showIcon
          message="信息未核验"
          description="请核对信息无误后进行核验操作"
          style={{ marginBottom: 16 }}
        />
      )}

      {mode === 'view' ? (
        <Descriptions column={3} bordered size="small">
          <Descriptions.Item label="助理" span={1}>
            {data?.assistant_name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="主办律师" span={1}>
            {data?.lawyer_name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="分派原因" span={1}>
            {data?.assignment_reason || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="分派备注" span={3}>
            {data?.assignment_remark || '-'}
          </Descriptions.Item>
          {data?.assigned_by_name && (
            <Descriptions.Item label="分派人" span={1}>
              {data.assigned_by_name}
            </Descriptions.Item>
          )}
          {data?.assigned_at && (
            <Descriptions.Item label="分派时间" span={2}>
              {data.assigned_at}
            </Descriptions.Item>
          )}
        </Descriptions>
      ) : (
        <Form
          form={form}
          layout="vertical"
          onValuesChange={handleValuesChange}
          initialValues={data || {}}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="assistant_id"
                label={
                  <Space>
                    <UserOutlined />
                    助理
                    <span style={{ color: 'red' }}>*</span>
                  </Space>
                }
                rules={[{ required: true, message: '请选择助理' }]}
              >
                <Select
                  placeholder="请选择助理"
                  options={assistantOptions}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="lawyer_id"
                label={
                  <Space>
                    <UserOutlined />
                    主办律师
                    <span style={{ color: 'red' }}>*</span>
                  </Space>
                }
                rules={[{ required: true, message: '请选择主办律师' }]}
              >
                <Select
                  placeholder="请选择主办律师"
                  options={lawyerOptions}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={8}>
              <Form.Item
                name="assignment_reason"
                label={
                  <Space>
                    <FormOutlined />
                    分派原因
                    <span style={{ color: 'red' }}>*</span>
                  </Space>
                }
                rules={[{ required: true, message: '请输入分派原因' }]}
              >
                <Input placeholder="请输入分派原因" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="assignment_remark"
                label={
                  <Space>
                    <FormOutlined />
                    分派备注
                  </Space>
                }
              >
                <TextArea rows={3} placeholder="请输入分派备注（可选）" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      )}

      <Divider style={{ margin: '16px 0' }} />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {mode === 'view' ? (
          <Space>
            {!data?.is_complete && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleVerify}
                loading={verifying}
              >
                核验通过
              </Button>
            )}
            <StatusActionButtons
              caseItem={caseItem}
              mode="view"
              onEditClick={handleEdit}
              onActionSuccess={() => {
                fetchData();
                onDataChange?.();
              }}
            />
          </Space>
        ) : (
          <StatusActionButtons
            caseItem={caseItem}
            mode="edit"
            hasUnsavedChanges={hasUnsavedChanges}
            onSave={handleSave}
            onCancel={handleCancel}
            onActionSuccess={() => {
              fetchData();
              onDataChange?.();
              onModeChange?.('view');
            }}
          />
        )}
      </div>
    </Card>
  );
}
