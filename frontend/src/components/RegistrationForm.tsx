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
  Spin
} from 'antd';
import { 
  SaveOutlined, 
  CheckCircleOutlined, 
  EditOutlined,
  UserOutlined,
  PhoneOutlined,
  IdcardOutlined,
  FileTextOutlined,
  FormOutlined
} from '@ant-design/icons';
import { registrationApi } from '../utils/api';
import StatusActionButtons from './StatusActionButtons';
import type { CaseRegistration, LegalCase } from '../../types';

const { TextArea } = Input;

interface RegistrationFormProps {
  caseId: number;
  caseItem: LegalCase;
  mode?: 'view' | 'edit';
  onModeChange?: (mode: 'view' | 'edit') => void;
  onDataChange?: () => void;
}

export default function RegistrationForm({ 
  caseId, 
  caseItem,
  mode = 'view',
  onModeChange,
  onDataChange
}: RegistrationFormProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [data, setData] = useState<CaseRegistration | null>(null);
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
        client_name: data.client_name,
        client_phone: data.client_phone,
        client_id_card: data.client_id_card,
        consultation_type: data.consultation_type,
        consultation_content: data.consultation_content,
        evidence_provided: data.evidence_provided,
        registration_remark: data.registration_remark,
      });
    }
  }, [data, mode, form]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await registrationApi.get(caseId);
      setData(result);
    } catch (error) {
      message.error('获取咨询登记信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await registrationApi.save(caseId, values);
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
      await registrationApi.verify(caseId);
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

  if (loading) {
    return (
      <Card title="咨询登记">
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  const formItems = [
    { name: 'client_name', label: '客户姓名', icon: <UserOutlined />, required: true, span: 8 },
    { name: 'client_phone', label: '联系电话', icon: <PhoneOutlined />, required: true, span: 8 },
    { name: 'client_id_card', label: '身份证号', icon: <IdcardOutlined />, required: false, span: 8 },
    { name: 'consultation_type', label: '咨询类型', icon: <FileTextOutlined />, required: true, span: 12 },
    { name: 'consultation_content', label: '咨询内容', icon: <FormOutlined />, required: true, span: 24, textarea: true },
    { name: 'evidence_provided', label: '提供证据', icon: <FileTextOutlined />, required: false, span: 24, textarea: true },
    { name: 'registration_remark', label: '备注说明', icon: <FormOutlined />, required: false, span: 24, textarea: true },
  ];

  return (
    <Card
      title={
        <Space>
          <FormOutlined />
          咨询登记
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
          <Descriptions.Item label="客户姓名" span={1}>
            {data?.client_name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="联系电话" span={1}>
            {data?.client_phone || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="身份证号" span={1}>
            {data?.client_id_card || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="咨询类型" span={1}>
            {data?.consultation_type || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="咨询内容" span={3}>
            {data?.consultation_content || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="提供证据" span={3}>
            {data?.evidence_provided || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="备注说明" span={3}>
            {data?.registration_remark || '-'}
          </Descriptions.Item>
          {data?.registered_by_name && (
            <Descriptions.Item label="登记人" span={1}>
              {data.registered_by_name}
            </Descriptions.Item>
          )}
          {data?.registered_at && (
            <Descriptions.Item label="登记时间" span={2}>
              {data.registered_at}
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
            {formItems.map((item) => (
              <Col xs={24} sm={item.span > 12 ? 24 : item.span * 2} md={item.span} key={item.name}>
                <Form.Item
                  name={item.name}
                  label={
                    <Space>
                      {item.icon}
                      {item.label}
                      {item.required && <span style={{ color: 'red' }}>*</span>}
                    </Space>
                  }
                  rules={item.required ? [{ required: true, message: `请输入${item.label}` }] : []}
                >
                  {item.textarea ? (
                    <TextArea rows={3} placeholder={`请输入${item.label}`} />
                  ) : (
                    <Input placeholder={`请输入${item.label}`} />
                  )}
                </Form.Item>
              </Col>
            ))}
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
