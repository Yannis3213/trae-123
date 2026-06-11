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
  Select,
  Rate
} from 'antd';
import { 
  SaveOutlined, 
  CheckCircleOutlined, 
  EditOutlined,
  PhoneOutlined,
  StarOutlined,
  FormOutlined
} from '@ant-design/icons';
import { followupApi } from '../utils/api';
import StatusActionButtons from './StatusActionButtons';
import type { CaseFollowup, LegalCase } from '../../types';

const { TextArea } = Input;

interface FollowupFormProps {
  caseId: number;
  caseItem: LegalCase;
  mode?: 'view' | 'edit';
  onModeChange?: (mode: 'view' | 'edit') => void;
  onDataChange?: () => void;
}

const satisfactionOptions = [
  { value: 'very_satisfied', label: '非常满意' },
  { value: 'satisfied', label: '满意' },
  { value: 'neutral', label: '一般' },
  { value: 'dissatisfied', label: '不满意' },
  { value: 'very_dissatisfied', label: '非常不满意' },
];

const satisfactionMap: Record<string, { label: string; stars: number }> = {
  very_satisfied: { label: '非常满意', stars: 5 },
  satisfied: { label: '满意', stars: 4 },
  neutral: { label: '一般', stars: 3 },
  dissatisfied: { label: '不满意', stars: 2 },
  very_dissatisfied: { label: '非常不满意', stars: 1 },
};

export default function FollowupForm({ 
  caseId, 
  caseItem,
  mode = 'view',
  onModeChange,
  onDataChange
}: FollowupFormProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [data, setData] = useState<CaseFollowup | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const isEditable = ['draft', 'pending_submit', 'returned'].includes(caseItem.status);

  useEffect(() => {
    if (caseId) {
      fetchData();
    }
  }, [caseId]);

  useEffect(() => {
    if (data && mode === 'edit') {
      form.setFieldsValue({
        followupResult: data.followupResult,
        clientSatisfaction: data.clientSatisfaction,
        followupRemark: data.followupRemark,
      });
    }
  }, [data, mode, form]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await followupApi.get(caseId);
      setData(response.data);
    } catch (error) {
      message.error('获取回访确认信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await followupApi.save(caseId, values);
      message.success('保存成功');
      setHasUnsavedChanges(false);
      await fetchData();
      onDataChange?.();
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请填写完整的必填项');
      } else {
        message.error(error.response?.data?.message || '保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await followupApi.verify(caseId);
      message.success('核验通过');
      await fetchData();
      onDataChange?.();
    } catch (error: any) {
      message.error(error.response?.data?.message || '核验失败');
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

  if (loading) {
    return (
      <Card title="回访确认">
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  const renderSatisfactionStars = (value?: string | null) => {
    if (!value) return '-';
    const config = satisfactionMap[value];
    if (!config) return value;
    return (
      <Space>
        <Rate disabled value={config.stars} />
        <span>{config.label}</span>
      </Space>
    );
  };

  return (
    <Card
      title={
        <Space>
          <PhoneOutlined />
          回访确认
          {data?.isComplete && (
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
      {!data?.isComplete && mode === 'view' && (
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
          <Descriptions.Item label="客户满意度" span={3}>
            {renderSatisfactionStars(data?.clientSatisfaction)}
          </Descriptions.Item>
          <Descriptions.Item label="回访结果" span={3}>
            {data?.followupResult || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="回访备注" span={3}>
            {data?.followupRemark || '-'}
          </Descriptions.Item>
          {data?.followupByName && (
            <Descriptions.Item label="回访人" span={1}>
              {data.followupByName}
            </Descriptions.Item>
          )}
          {data?.followupAt && (
            <Descriptions.Item label="回访时间" span={2}>
              {data.followupAt}
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
            <Col xs={24} sm={12}>
              <Form.Item
                name="clientSatisfaction"
                label={
                  <Space>
                    <StarOutlined />
                    客户满意度
                    <span style={{ color: 'red' }}>*</span>
                  </Space>
                }
                rules={[{ required: true, message: '请选择客户满意度' }]}
              >
                <Select
                  placeholder="请选择客户满意度"
                  options={satisfactionOptions}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="followupResult"
                label={
                  <Space>
                    <FormOutlined />
                    回访结果
                    <span style={{ color: 'red' }}>*</span>
                  </Space>
                }
                rules={[{ required: true, message: '请输入回访结果' }]}
              >
                <TextArea rows={3} placeholder="请输入回访结果" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="followupRemark"
                label={
                  <Space>
                    <FormOutlined />
                    回访备注
                  </Space>
                }
              >
                <TextArea rows={3} placeholder="请输入回访备注（可选）" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      )}

      <Divider style={{ margin: '16px 0' }} />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {mode === 'view' ? (
          <Space>
            {!data?.isComplete && (
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
