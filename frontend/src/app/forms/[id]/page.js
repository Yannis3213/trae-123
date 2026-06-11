'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MainLayout from '../../../components/MainLayout';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Tabs,
  List,
  Avatar,
  Form,
  Input,
  Select,
  Modal,
  message,
  Row,
  Col,
  Statistic,
  Alert,
  Divider,
  Typography,
  Upload,
  Timeline,
  Empty,
  Badge,
  Table
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  UserOutlined,
  PlusOutlined,
  MessageOutlined,
  PaperClipOutlined,
  EditOutlined
} from '@ant-design/icons';
import { formsApi } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import {
  formatDate,
  getStatusTag,
  getNodeLabel,
  getDeadlineStatus,
  getRoleLabel,
  getEvidenceTypeLabel,
  getExceptionTypeLabel,
  getAvailableOperations,
  getBusinessTypes
} from '../../../lib/utils';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export default function FormDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null);
  const [operationModalVisible, setOperationModalVisible] = useState(false);
  const [currentOperation, setCurrentOperation] = useState(null);
  const [operationForm] = Form.useForm();
  const [operationLoading, setOperationLoading] = useState(false);
  const [supplementModalVisible, setSupplementModalVisible] = useState(false);
  const [supplementForm] = Form.useForm();
  const [supplementLoading, setSupplementLoading] = useState(false);
  const [auditNote, setAuditNote] = useState('');
  const [auditNoteLoading, setAuditNoteLoading] = useState(false);
  const [constants, setConstants] = useState({ evidenceTypes: [] });
  const [newAttachments, setNewAttachments] = useState([]);

  const formId = params.id;

  useEffect(() => {
    fetchDetail();
    fetchConstants();
  }, [formId]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const response = await formsApi.getDetail(formId);
      if (response.success) {
        setForm(response.data.form);
      }
    } catch (err) {
      message.error(err.error?.message || '加载详情失败');
    } finally {
      setLoading(false);
    }
  };

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

  const handleOperation = (op) => {
    setCurrentOperation(op);
    operationForm.resetFields();
    setNewAttachments([]);
    setOperationModalVisible(true);
  };

  const handleConfirmOperation = async (values) => {
    if (!currentOperation) return;

    setOperationLoading(true);
    try {
      const requestData = {
        operation: currentOperation.key,
        opinion: values.opinion,
        version: form.version,
      };

      if (values.supplementData) {
        requestData.supplementData = values.supplementData;
      }

      if (newAttachments.length > 0) {
        requestData.attachments = newAttachments;
      }

      const response = await formsApi.operation(formId, requestData);
      if (response.success) {
        message.success('操作成功');
        setOperationModalVisible(false);
        setCurrentOperation(null);
        fetchDetail();
      }
    } catch (err) {
      message.error(err.error?.message || '操作失败');
    } finally {
      setOperationLoading(false);
    }
  };

  const handleSupplement = () => {
    supplementForm.resetFields();
    setNewAttachments([]);
    setSupplementModalVisible(true);
  };

  const handleConfirmSupplement = async (values) => {
    setSupplementLoading(true);
    try {
      const requestData = {
        operation: 'supplement',
        opinion: values.opinion || '补正材料',
        version: form.version,
        supplementData: values.supplementData,
        attachments: newAttachments,
      };

      const response = await formsApi.operation(formId, requestData);
      if (response.success) {
        message.success('补正成功');
        setSupplementModalVisible(false);
        fetchDetail();
      }
    } catch (err) {
      message.error(err.error?.message || '补正失败');
    } finally {
      setSupplementLoading(false);
    }
  };

  const handleAddAuditNote = async () => {
    if (!auditNote.trim()) {
      message.warning('请输入备注内容');
      return;
    }
    setAuditNoteLoading(true);
    try {
      const response = await formsApi.addAuditNote(formId, { noteContent: auditNote });
      if (response.success) {
        message.success('备注添加成功');
        setAuditNote('');
        fetchDetail();
      }
    } catch (err) {
      message.error(err.error?.message || '添加备注失败');
    } finally {
      setAuditNoteLoading(false);
    }
  };

  const handleAddAttachment = () => {
    setNewAttachments(prev => [
      ...prev,
      {
        id: Date.now(),
        fileName: '',
        evidenceType: 'other',
        remark: '',
      }
    ]);
  };

  const handleUpdateAttachment = (id, field, value) => {
    setNewAttachments(prev =>
      prev.map(a => a.id === id ? { ...a, [field]: value } : a)
    );
  };

  const handleRemoveAttachment = (id) => {
    setNewAttachments(prev => prev.filter(a => a.id !== id));
  };

  const getOperationLabel = (op) => {
    const labelMap = {
      create: '创建',
      sign: '签收',
      submit_audit: '提交审核',
      audit_pass: '审核通过',
      audit_reject: '审核拒绝',
      register: '完成登记',
      submit_final_review: '提交复核',
      final_review_pass: '复核通过',
      final_review_reject: '复核拒绝',
      supplement: '补正材料',
      return_supplement: '退回补正',
      archive: '归档',
      batch_promote: '逾期推进',
    };
    return labelMap[op] || op;
  };

  const operations = form ? getAvailableOperations(form, user.role) : [];
  const deadlineStatus = form ? getDeadlineStatus(form.deadline) : null;
  const statusTag = form ? getStatusTag(form.status) : null;

  const renderBasicInfo = () => {
    if (!form) return null;

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
                  返回列表
                </Button>
                <Title level={4} style={{ margin: 0 }}>
                  入驻单详情
                </Title>
                <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                  {form.form_no}
                </Tag>
              </Space>
              <Space>
                <Tag color={statusTag?.color} style={{ fontSize: 14, padding: '4px 12px' }}>
                  {statusTag?.label}
                </Tag>
                <Tag color="geekblue" style={{ fontSize: 14, padding: '4px 12px' }}>
                  {getNodeLabel(form.current_node)}
                </Tag>
                <Badge
                  status={deadlineStatus?.type === 'overdue' ? 'error' : deadlineStatus?.type === 'near' ? 'warning' : 'success'}
                  text={`期限：${deadlineStatus?.label}`}
                />
                {form.timeoutInfo?.isTimeout && (
                  <Alert
                    message="该单据已超时，需要先进行补正操作"
                    type="error"
                    showIcon
                    style={{ maxWidth: 400 }}
                  />
                )}
              </Space>
            </Space>

            {form.evidenceInfo && !form.evidenceInfo.complete && (
              <Alert
                message={`当前节点缺少必要证据：${form.evidenceInfo.missingLabels.join('、')}`}
                type="warning"
                showIcon
                action={
                  <Button size="small" type="primary" onClick={handleSupplement}>
                    补正材料
                  </Button>
                }
              />
            )}

            <Row gutter={16}>
              <Col span={4}>
                <Statistic
                  title="版本号"
                  value={form.version}
                  prefix={<EditOutlined />}
                />
              </Col>
              <Col span={4}>
                <Statistic
                  title="当前处理人"
                  value={form.current_handler || '未分配'}
                  prefix={<UserOutlined />}
                />
              </Col>
              <Col span={4}>
                <Statistic
                  title="上一处理人"
                  value={form.previous_handler || '-'}
                  prefix={<UserOutlined />}
                />
              </Col>
              <Col span={4}>
                <Statistic
                  title="创建人"
                  value={form.created_by}
                  prefix={<UserOutlined />}
                />
              </Col>
              <Col span={4}>
                <Statistic
                  title="附件数"
                  value={form.attachments?.length || 0}
                  prefix={<PaperClipOutlined />}
                />
              </Col>
              <Col span={4}>
                <Statistic
                  title="异常记录"
                  value={form.exceptions?.filter(e => !e.resolved).length || 0}
                  valueStyle={{ color: '#ff4d4f' }}
                  prefix={<ExclamationCircleOutlined />}
                />
              </Col>
            </Row>

            {form.previous_opinion && (
              <Alert
                message="上一处理人意见"
                description={
                  <Space direction="vertical">
                    <Text strong>{form.previous_handler}</Text>
                    <Paragraph style={{ margin: 0 }}>{form.previous_opinion}</Paragraph>
                  </Space>
                }
                type="info"
                showIcon
              />
            )}

            <Space wrap style={{ justifyContent: 'flex-end' }}>
              {operations.map(op => (
                <Button
                  key={op.key}
                  type={op.type === 'primary' ? 'primary' : op.type === 'danger' ? 'primary' : 'default'}
                  danger={op.type === 'danger'}
                  onClick={() => handleOperation(op)}
                >
                  {op.label}
                </Button>
              ))}
              {(form.status === 'supplement_required' || form.status === 'abnormal_return' || form.timeoutInfo?.isTimeout) &&
                user.role === 'merchant_registrar' && (
                  <Button type="warning" onClick={handleSupplement}>
                    补正材料
                  </Button>
                )
              }
            </Space>
          </Space>
        </Card>

        <Card title="基本信息">
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="商家名称">{form.merchant_name}</Descriptions.Item>
            <Descriptions.Item label="统一社会信用代码">{form.credit_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="业务类型">{form.business_type}</Descriptions.Item>
            <Descriptions.Item label="注册资本">{form.registered_capital || '-'}</Descriptions.Item>
            <Descriptions.Item label="联系人">{form.contact_name}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{form.contact_phone}</Descriptions.Item>
            <Descriptions.Item label="联系邮箱">{form.contact_email || '-'}</Descriptions.Item>
            <Descriptions.Item label="法人姓名">{form.legal_person_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="法人身份证号">{form.legal_person_id_card || '-'}</Descriptions.Item>
            <Descriptions.Item label="营业执照号">{form.business_license_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="税务登记号">{form.tax_registration_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="组织机构代码">{form.organization_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="银行账户名">{form.bank_account_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="银行账号">{form.bank_account_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="开户银行">{form.bank_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="办公地址">{form.office_address || '-'}</Descriptions.Item>
            <Descriptions.Item label="仓库地址">{form.warehouse_address || '-'}</Descriptions.Item>
            <Descriptions.Item label="经营范围" span={2}>{form.business_scope || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatDate(form.created_at)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatDate(form.updated_at)}</Descriptions.Item>
            <Descriptions.Item label="归档时间">{form.archived_at ? formatDate(form.archived_at) : '-'}</Descriptions.Item>
            <Descriptions.Item label="处理期限">{form.deadline ? formatDate(form.deadline) : '-'}</Descriptions.Item>
          </Descriptions>
        </Card>
      </Space>
    );
  };

  const renderAttachments = () => {
    if (!form) return null;

    return (
      <Card title={`附件材料 (${form.attachments?.length || 0})`}>
        {form.attachments?.length === 0 ? (
          <Empty description="暂无附件" />
        ) : (
          <List
            grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 4 }}
            dataSource={form.attachments}
            renderItem={(item) => (
              <List.Item>
                <Card size="small" hoverable>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Space>
                      <PaperClipOutlined />
                      <Text strong ellipsis style={{ maxWidth: 150 }}>{item.file_name}</Text>
                    </Space>
                    <Tag color="blue">{getEvidenceTypeLabel(item.evidence_type)}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      上传人：{item.upload_by}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatDate(item.created_at, 'MM-DD HH:mm')}
                    </Text>
                    {item.remark && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        备注：{item.remark}
                      </Text>
                    )}
                  </Space>
                </Card>
              </List.Item>
            )}
          />
        )}
      </Card>
    );
  };

  const renderProcessingRecords = () => {
    if (!form) return null;

    return (
      <Card title="处理轨迹">
        {form.processingRecords?.length === 0 ? (
          <Empty description="暂无处理记录" />
        ) : (
          <Timeline
            mode="left"
            items={form.processingRecords.map(record => ({
              color: record.to_status === 'archived' || record.to_status?.includes('pass') || record.to_status?.includes('completed') ? 'green' :
                     record.to_status?.includes('reject') || record.to_status?.includes('abnormal') ? 'red' : 'blue',
              label: formatDate(record.created_at),
              children: (
                <Card size="small" style={{ marginBottom: 8 }}>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Space>
                      <Avatar size="small" style={{ backgroundColor: '#1677ff' }}>
                        {record.operator?.[0]}
                      </Avatar>
                      <Text strong>{record.operator}</Text>
                      <Tag color="geekblue">{getRoleLabel(record.operator_role)}</Tag>
                      <Tag color="purple">{getOperationLabel(record.operation_type)}</Tag>
                      <Text type="secondary">版本 v{record.version}</Text>
                    </Space>
                    <Space>
                      <Tag>
                        {record.from_node ? getNodeLabel(record.from_node) : '-'} → {record.to_node ? getNodeLabel(record.to_node) : '-'}
                      </Tag>
                      <Tag color={getStatusTag(record.from_status)?.color}>
                        {record.from_status ? getStatusTag(record.from_status)?.label : '-'}
                      </Tag>
                      <Text type="secondary">→</Text>
                      <Tag color={getStatusTag(record.to_status)?.color}>
                        {record.to_status ? getStatusTag(record.to_status)?.label : '-'}
                      </Tag>
                    </Space>
                    {record.opinion && (
                      <Paragraph style={{ margin: 0, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                        {record.opinion}
                      </Paragraph>
                    )}
                  </Space>
                </Card>
              ),
            }))}
          />
        )}
      </Card>
    );
  };

  const renderExceptions = () => {
    if (!form) return null;

    return (
      <Card title={`异常原因 (${form.exceptions?.length || 0})`}>
        {form.exceptions?.length === 0 ? (
          <Empty description="暂无异常记录" />
        ) : (
          <Table
            rowKey="id"
            size="small"
            dataSource={form.exceptions}
            pagination={false}
            columns={[
              {
                title: '异常类型',
                dataIndex: 'exception_type',
                key: 'exception_type',
                width: 120,
                render: (type) => (
                  <Tag color={type === 'timeout' ? 'red' : type === 'material_missing' ? 'orange' : type === 'permission_denied' ? 'purple' : 'blue'}>
                    {getExceptionTypeLabel(type)}
                  </Tag>
                ),
              },
              {
                title: '异常详情',
                dataIndex: 'exception_detail',
                key: 'exception_detail',
              },
              {
                title: '节点',
                dataIndex: 'exception_node',
                key: 'exception_node',
                width: 120,
                render: (node) => node ? getNodeLabel(node) : '-',
              },
              {
                title: '状态',
                dataIndex: 'resolved',
                key: 'resolved',
                width: 100,
                render: (resolved) => (
                  <Tag color={resolved ? 'green' : 'red'}>
                    {resolved ? '已解决' : '未解决'}
                  </Tag>
                ),
              },
              {
                title: '记录人',
                dataIndex: 'created_by',
                key: 'created_by',
                width: 100,
              },
              {
                title: '记录时间',
                dataIndex: 'created_at',
                key: 'created_at',
                width: 160,
                render: (date) => formatDate(date, 'MM-DD HH:mm'),
              },
              {
                title: '解决人/时间',
                key: 'resolved_info',
                width: 180,
                render: (_, record) => record.resolved ? (
                  <Space direction="vertical" size={0}>
                    <Text>{record.resolved_by}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatDate(record.resolved_at, 'MM-DD HH:mm')}
                    </Text>
                  </Space>
                ) : '-',
              },
              {
                title: '解决说明',
                dataIndex: 'resolution_note',
                key: 'resolution_note',
                render: (note) => note || '-',
              },
            ]}
          />
        )}
      </Card>
    );
  };

  const renderAuditNotes = () => {
    if (!form) return null;

    return (
      <Card title="审计备注">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              rows={2}
              placeholder="添加审计备注..."
              value={auditNote}
              onChange={(e) => setAuditNote(e.target.value)}
            />
            <Button
              type="primary"
              icon={<MessageOutlined />}
              loading={auditNoteLoading}
              onClick={handleAddAuditNote}
            >
              添加备注
            </Button>
          </Space.Compact>

          {form.auditNotes?.length === 0 ? (
            <Empty description="暂无审计备注" />
          ) : (
            <List
              dataSource={form.auditNotes}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar style={{ backgroundColor: '#722ed1' }}>{item.created_by?.[0]}</Avatar>}
                    title={
                      <Space>
                        <Text strong>{item.created_by}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {formatDate(item.created_at)}
                        </Text>
                      </Space>
                    }
                    description={item.note_content}
                  />
                </List.Item>
              )}
            />
          )}
        </Space>
      </Card>
    );
  };

  const tabs = [
    {
      key: 'basic',
      label: '基本信息',
      children: renderBasicInfo(),
    },
    {
      key: 'attachments',
      label: `附件材料 (${form?.attachments?.length || 0})`,
      children: renderAttachments(),
    },
    {
      key: 'records',
      label: `处理轨迹 (${form?.processingRecords?.length || 0})`,
      children: renderProcessingRecords(),
    },
    {
      key: 'exceptions',
      label: `异常原因 (${form?.exceptions?.length || 0})`,
      children: renderExceptions(),
    },
    {
      key: 'notes',
      label: `审计备注 (${form?.auditNotes?.length || 0})`,
      children: renderAuditNotes(),
    },
  ];

  const renderAttachmentFields = (prefix = '') => (
    <>
      <Divider orientation="left">上传材料（可选）</Divider>
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {newAttachments.map((att, index) => (
          <Space key={att.id} style={{ display: 'flex', width: '100%' }} align="baseline">
            <Input
              placeholder="文件名"
              value={att.fileName}
              onChange={(e) => handleUpdateAttachment(att.id, 'fileName', e.target.value)}
              style={{ flex: 1 }}
            />
            <Select
              placeholder="证据类型"
              value={att.evidenceType}
              onChange={(v) => handleUpdateAttachment(att.id, 'evidenceType', v)}
              style={{ width: 140 }}
            >
              {constants.evidenceTypes.map(e => (
                <Option key={e.value} value={e.value}>{e.label}</Option>
              ))}
            </Select>
            <Input
              placeholder="备注"
              value={att.remark}
              onChange={(e) => handleUpdateAttachment(att.id, 'remark', e.target.value)}
              style={{ width: 140 }}
            />
            <Button type="text" danger onClick={() => handleRemoveAttachment(att.id)}>
              删除
            </Button>
          </Space>
        ))}
        <Button type="dashed" onClick={handleAddAttachment} block icon={<PlusOutlined />}>
          添加材料
        </Button>
      </Space>
    </>
  );

  return (
    <MainLayout>
      {loading ? (
        <Card loading>加载中...</Card>
      ) : form ? (
        <Tabs
          items={tabs}
          defaultActiveKey="basic"
          type="card"
        />
      ) : (
        <Card>入驻单不存在</Card>
      )}

      <Modal
        title={currentOperation?.label}
        open={operationModalVisible}
        onCancel={() => setOperationModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={operationForm}
          layout="vertical"
          onFinish={handleConfirmOperation}
        >
          <Alert
            message={`当前单据：${form?.form_no}`}
            description={`当前状态：${statusTag?.label} | 当前节点：${getNodeLabel(form?.current_node)}`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          {(currentOperation?.key === 'supplement' || currentOperation?.key === 'return_supplement') && (
            <>
              <Divider orientation="left">补正信息</Divider>
              <Form.Item name={['supplementData', 'businessLicenseNo']} label="营业执照号">
                <Input placeholder="请输入营业执照号" defaultValue={form?.business_license_no} />
              </Form.Item>
              <Form.Item name={['supplementData', 'taxRegistrationNo']} label="税务登记号">
                <Input placeholder="请输入税务登记号" defaultValue={form?.tax_registration_no} />
              </Form.Item>
              <Form.Item name={['supplementData', 'legalPersonIdCard']} label="法人身份证号">
                <Input placeholder="请输入法人身份证号" defaultValue={form?.legal_person_id_card} />
              </Form.Item>
              <Form.Item name={['supplementData', 'bankAccountNo']} label="银行账号">
                <Input placeholder="请输入银行账号" defaultValue={form?.bank_account_no} />
              </Form.Item>
              <Form.Item name={['supplementData', 'bankName']} label="开户银行">
                <Input placeholder="请输入开户银行" defaultValue={form?.bank_name} />
              </Form.Item>
              {renderAttachmentFields()}
            </>
          )}

          {!['supplement', 'return_supplement'].includes(currentOperation?.key) &&
            newAttachments.length > 0 && renderAttachmentFields()}

          {!['sign', 'supplement'].includes(currentOperation?.key) && (
            <Form.Item name="opinion" label="处理意见" rules={[{ required: true, message: '请输入处理意见' }]}>
              <TextArea rows={4} placeholder="请输入处理意见..." />
            </Form.Item>
          )}

          {['sign', 'supplement'].includes(currentOperation?.key) && (
            <Form.Item name="opinion" label="处理意见">
              <TextArea rows={3} placeholder="请输入处理意见（可选）" />
            </Form.Item>
          )}

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={operationLoading}>
                确认{currentOperation?.label}
              </Button>
              <Button onClick={() => setOperationModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="补正材料"
        open={supplementModalVisible}
        onCancel={() => setSupplementModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form
          form={supplementForm}
          layout="vertical"
          onFinish={handleConfirmSupplement}
        >
          <Alert
            message="补正说明"
            description="请补充缺失的材料和信息，补正后单据状态将更新为签收完成"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Divider orientation="left">补充信息</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name={['supplementData', 'businessLicenseNo']} label="营业执照号">
                <Input placeholder="请输入营业执照号" defaultValue={form?.business_license_no} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name={['supplementData', 'taxRegistrationNo']} label="税务登记号">
                <Input placeholder="请输入税务登记号" defaultValue={form?.tax_registration_no} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name={['supplementData', 'legalPersonName']} label="法人姓名">
                <Input placeholder="请输入法人姓名" defaultValue={form?.legal_person_name} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name={['supplementData', 'legalPersonIdCard']} label="法人身份证号">
                <Input placeholder="请输入法人身份证号" defaultValue={form?.legal_person_id_card} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name={['supplementData', 'bankAccountName']} label="银行账户名">
                <Input placeholder="请输入银行账户名" defaultValue={form?.bank_account_name} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name={['supplementData', 'bankAccountNo']} label="银行账号">
                <Input placeholder="请输入银行账号" defaultValue={form?.bank_account_no} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name={['supplementData', 'bankName']} label="开户银行">
            <Input placeholder="请输入开户银行" defaultValue={form?.bank_name} />
          </Form.Item>
          <Form.Item name={['supplementData', 'businessScope']} label="经营范围">
            <TextArea rows={2} placeholder="请输入经营范围" defaultValue={form?.business_scope} />
          </Form.Item>

          {renderAttachmentFields('supplement')}

          <Form.Item name="opinion" label="补正说明">
            <TextArea rows={3} placeholder="请输入补正说明（可选）" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={supplementLoading}>
                提交补正
              </Button>
              <Button onClick={() => setSupplementModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </MainLayout>
  );
}
