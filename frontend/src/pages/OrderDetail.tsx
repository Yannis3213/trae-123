import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Tag, Descriptions, Button, Space, Form, Input, Select, Modal,
  Timeline, List, Divider, message, Alert, Empty, Upload, Badge, Tooltip
} from 'antd';
import {
  FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined, UploadOutlined,
  ArrowLeftOutlined, ExclamationCircleOutlined, UserOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  api, InboundOrder, Attachment, ProcessingRecord, AuditNote, ExceptionReason,
  ROLE_LABEL, STATUS_LABEL, MODULE_LABEL, ProcessOrderRequest
} from '../api';

const { TextArea } = Input;
const { Option } = Select;

type DetailData = {
  order: InboundOrder;
  urgency: { label: string; key: string };
  attachments: Attachment[];
  processing_records: ProcessingRecord[];
  audit_notes: AuditNote[];
  exception_reasons: ExceptionReason[];
  available_actions: string[];
  can_edit_modules: boolean;
  current_user: { id: string; name: string; role: string; role_display: string };
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState('');
  const [form] = Form.useForm();
  const [processing, setProcessing] = useState(false);
  const [moduleForm] = Form.useForm();
  const [editingModule, setEditingModule] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const resp = await api.getOrder(id);
      if (resp.data.success && resp.data.data) {
        setData(resp.data.data);
      } else {
        message.error(resp.data.message || '加载失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  if (!data) {
    return <div style={{ padding: 24 }}>{loading ? '加载中...' : <Empty />}</div>;
  }

  const { order, urgency, attachments, processing_records, audit_notes, exception_reasons, available_actions, can_edit_modules, current_user } = data;

  const statusColor = () => {
    if (order.status === 'pending_confirmation') return 'processing';
    if (order.status === 'exception') return 'warning';
    if (order.status === 'rechecked') return 'success';
    return 'default';
  };

  const urgencyStyle = urgency.key === 'overdue' ? 'urgency-overdue' : urgency.key === 'near' ? 'urgency-near' : 'urgency-normal';

  const openAction = (action: string) => {
    setCurrentAction(action);
    form.resetFields();
    setActionModalOpen(true);
  };

  const handleAction = async (values: any) => {
    setProcessing(true);
    try {
      const req: ProcessOrderRequest = {
        order_id: order.id,
        version: order.version,
        action: currentAction,
        opinion: values.opinion,
        audit_note: values.audit_note,
        exception_reason: values.exception_reason,
        exception_module: values.exception_module,
      };
      const resp = await api.processOrder(req);
      if (resp.data.success) {
        message.success(`操作「${currentAction}」执行成功`);
        setActionModalOpen(false);
        loadData();
      } else {
        message.error(resp.data.message || '操作失败');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleModuleSave = async (moduleKey: string, values: any) => {
    setProcessing(true);
    try {
      const fieldMap: Record<string, keyof ProcessOrderRequest> = {
        appointment: 'appointment_evidence',
        inspection: 'inspection_evidence',
        registration: 'registration_evidence',
      };
      const req: ProcessOrderRequest = {
        order_id: order.id,
        version: order.version,
        action: '补正',
        opinion: `补正${MODULE_LABEL[moduleKey] || moduleKey}材料`,
        [fieldMap[moduleKey]]: values.evidence,
      };
      const resp = await api.processOrder(req);
      if (resp.data.success) {
        message.success('补正成功');
        setEditingModule(null);
        moduleForm.resetFields();
        loadData();
      } else {
        message.error(resp.data.message || '补正失败');
      }
    } finally {
      setProcessing(false);
    }
  };

  const ModuleCard = ({
    moduleKey, title, icon, complete, evidence,
  }: {
    moduleKey: string;
    title: string;
    icon: string;
    complete: boolean;
    evidence?: string;
  }) => {
    const isEditing = editingModule === moduleKey;
    return (
      <Card
        size="small"
        className={`module-card ${complete ? 'complete' : 'incomplete'}`}
        style={{ borderColor: complete ? '#52c41a' : '#faad14' }}
        title={
          <div className="section-title" style={{ marginBottom: 0 }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span>{title}</span>
            <Badge status={complete ? 'success' : 'warning'} text={complete ? '已完成' : '待补正'} />
          </div>
        }
        extra={
          can_edit_modules && !order.status.includes('rechecked') && (
            <Button size="small" type={complete ? 'default' : 'primary'} onClick={() => {
              setEditingModule(isEditing ? null : moduleKey);
              moduleForm.setFieldsValue({ evidence: evidence || '' });
            }}>
              {isEditing ? '取消' : complete ? '修改' : '补正'}
            </Button>
          )
        }
      >
        {!isEditing ? (
          <div>
            {evidence ? (
              <div>
                <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>证据材料：</div>
                <div style={{ background: '#fff', padding: '8px 12px', borderRadius: 4, border: '1px solid #e8e8e8' }}>
                  📎 {evidence}
                </div>
              </div>
            ) : (
              <div style={{ color: '#fa8c16' }}>
                <ExclamationCircleOutlined /> 暂无证据材料，请补正
              </div>
            )}
          </div>
        ) : (
          <Form form={moduleForm} layout="vertical" onFinish={(v) => handleModuleSave(moduleKey, v)}>
            <Form.Item name="evidence" label="证据描述/文件名" rules={[{ required: true, message: '请填写证据信息' }]}>
              <Input placeholder="例如：入库预约确认单_供应商A.pdf" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Space>
                <Upload beforeUpload={() => false}>
                  <Button size="small" icon={<UploadOutlined />}>选择文件</Button>
                </Upload>
                <Button type="primary" size="small" htmlType="submit" loading={processing}>保存补正</Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Card>
    );
  };

  const actionNeedsException = currentAction === '退回补正';
  const isManager = current_user.role === 'operations_manager';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>返回列表</Button>
            <span className="page-title">入库单详情 - {order.order_no}</span>
          </Space>
        </div>
        <Space>
          <Tag color={statusColor()} style={{ padding: '4px 12px', fontSize: 14 }}>
            <FileTextOutlined /> {STATUS_LABEL[order.status] || order.status}
          </Tag>
          <Tag className={urgencyStyle} style={{ padding: '4px 12px', fontSize: 14 }}>
            <ClockCircleOutlined /> {urgency.label}
          </Tag>
          <Button onClick={loadData}>刷新</Button>
          {available_actions.length > 0 && (
            <Dropdown.Button
              type="primary"
              onClick={() => openAction(available_actions[0])}
              menus={{ items: available_actions.map((a) => ({ key: a, label: a })) }}
            >
              {available_actions[0]}
            </Dropdown.Button>
          )}
        </Space>
      </div>

      {(urgency.key === 'overdue' || order.status === 'exception') && (
        <Alert
          type={urgency.key === 'overdue' ? 'error' : 'warning'}
          showIcon
          style={{ marginBottom: 16 }}
          message={urgency.key === 'overdue' ? '该单据已逾期，仅允许补正或退回操作' : '该单据处于异常状态，请完成补正后重新提交'}
          description={order.deadline ? `截止时间：${dayjs(order.deadline).format('YYYY-MM-DD HH:mm')}，责任人：${order.current_handler_name || '-'}` : ''}
        />
      )}

      {exception_reasons.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="异常原因"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {exception_reasons.map((e) => (
                <li key={e.id}>
                  <Tag color="orange" style={{ marginRight: 8 }}>{MODULE_LABEL[e.module] || e.module}</Tag>
                  {e.reason}
                  <span style={{ color: '#8c8c8c', fontSize: 12, marginLeft: 8 }}>
                    （{dayjs(e.created_at).format('YYYY-MM-DD HH:mm')}）
                  </span>
                </li>
              ))}
            </ul>
          }
        />
      )}

      <Row gutter={16}>
        <Col span={16}>
          <Card title="📋 基本信息" style={{ marginBottom: 16 }} size="small">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="入库单号">{order.order_no}</Descriptions.Item>
              <Descriptions.Item label="版本号">v{order.version}</Descriptions.Item>
              <Descriptions.Item label="供应商">{order.supplier_name}</Descriptions.Item>
              <Descriptions.Item label="物料名称">{order.material_name}</Descriptions.Item>
              <Descriptions.Item label="数量">{order.quantity}</Descriptions.Item>
              <Descriptions.Item label="状态">{STATUS_LABEL[order.status]}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{dayjs(order.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="最近更新">{dayjs(order.updated_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="当前处理角色">{ROLE_LABEL[order.current_handler_role]}</Descriptions.Item>
              <Descriptions.Item label="当前处理人">{order.current_handler_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="截止时间" span={2}>
                {order.deadline ? (
                  <span style={{ color: urgency.key === 'overdue' ? '#ff4d4f' : urgency.key === 'near' ? '#fa8c16' : '#1f1f1f', fontWeight: 500 }}>
                    {dayjs(order.deadline).format('YYYY-MM-DD HH:mm')}
                  </span>
                ) : '无'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <div className="section-title">🧩 业务模块</div>
          <Row gutter={12} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <ModuleCard
                moduleKey="appointment"
                title="入库预约"
                icon="📅"
                complete={order.appointment_complete}
                evidence={order.appointment_evidence}
              />
            </Col>
            <Col span={8}>
              <ModuleCard
                moduleKey="inspection"
                title="质检上架"
                icon="🔍"
                complete={order.inspection_complete}
                evidence={order.inspection_evidence}
              />
            </Col>
            <Col span={8}>
              <ModuleCard
                moduleKey="registration"
                title="入库单登记"
                icon="📝"
                complete={order.registration_complete}
                evidence={order.registration_evidence}
              />
            </Col>
          </Row>

          <Card title="💬 上一处理人意见 / 审计备注" style={{ marginBottom: 16 }} size="small">
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 6 }}>最近处理意见</div>
                <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, minHeight: 50 }}>
                  {order.last_opinion || <span style={{ color: '#bfbfbf' }}>暂无</span>}
                </div>
              </Col>
              <Col span={12}>
                <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 6 }}>最近审计备注</div>
                <div style={{ background: '#e6f4ff', padding: 12, borderRadius: 4, minHeight: 50 }}>
                  {order.last_audit_note || <span style={{ color: '#bfbfbf' }}>暂无</span>}
                </div>
              </Col>
            </Row>
          </Card>

          <Card title="📎 附件" style={{ marginBottom: 16 }} size="small">
            {attachments.length === 0 ? (
              <Empty description="暂无附件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={attachments}
                renderItem={(a) => (
                  <List.Item>
                    <Space>
                      <FileTextOutlined style={{ color: '#1677ff' }} />
                      <span>{a.filename}</span>
                      <Tag>{MODULE_LABEL[a.module] || a.module}</Tag>
                      <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                        上传者：{a.uploaded_by} · {dayjs(a.uploaded_at).format('MM-DD HH:mm')}
                      </span>
                    </Space>
                  </List.Item>
                )}
              />
            )}
            {can_edit_modules && (
              <Upload beforeUpload={() => false} style={{ marginTop: 8 }}>
                <Button size="small" icon={<UploadOutlined />}>上传附件</Button>
              </Upload>
            )}
          </Card>
        </Col>

        <Col span={8}>
          <Card title="🔄 处理记录 / 审计轨迹" size="small" style={{ marginBottom: 16 }}>
            <div className="timeline-wrapper">
              <Timeline
                mode="left"
                items={processing_records.map((r) => ({
                  color: r.action.includes('退回') ? 'red' : r.action.includes('确认') || r.action.includes('最终') ? 'green' : 'blue',
                  label: (
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      {dayjs(r.processed_at).format('MM-DD HH:mm')}
                    </div>
                  ),
                  children: (
                    <div style={{ fontSize: 13 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        {r.action}
                        <Tag style={{ marginLeft: 8 }} color="blue">{ROLE_LABEL[r.handler_role]}</Tag>
                      </div>
                      <div style={{ color: '#595959', marginBottom: 4 }}>
                        <UserOutlined /> {r.handler_name}
                      </div>
                      <div style={{ background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                        {r.opinion}
                      </div>
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                        {STATUS_LABEL[r.from_status] || '发起'} → {STATUS_LABEL[r.to_status]}
                      </div>
                    </div>
                  ),
                }))}
              />
            </div>
          </Card>

          <Card title="📝 审计备注记录" size="small">
            {audit_notes.length === 0 ? (
              <Empty description="暂无审计备注" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={audit_notes}
                renderItem={(n) => (
                  <List.Item style={{ alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
                        {ROLE_LABEL[n.creator_role] || n.creator_role} · {dayjs(n.created_at).format('MM-DD HH:mm')}
                      </div>
                      <div style={{ background: '#e6f4ff', padding: 8, borderRadius: 4 }}>
                        {n.note}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title={`办理操作：${currentAction}`}
        open={actionModalOpen}
        onCancel={() => setActionModalOpen(false)}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`将对单据「${order.order_no}」执行「${currentAction}」操作`}
          description={`当前状态：${STATUS_LABEL[order.status]} · 版本：v${order.version}`}
        />
        <Form form={form} layout="vertical" onFinish={handleAction}>
          <Form.Item name="opinion" label="处理意见" rules={[{ required: true, message: '请填写处理意见' }]}>
            <TextArea rows={3} placeholder={`请填写「${currentAction}」的处理意见`} />
          </Form.Item>
          {actionNeedsException && (
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
          )}
          {isManager && (
            <Form.Item name="audit_note" label="审计备注（必填）" rules={[{ required: true, message: '运营经理必须填写审计备注' }]}>
              <TextArea rows={2} placeholder="请填写审计备注" />
            </Form.Item>
          )}
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={processing}>确认执行</Button>
              <Button onClick={() => setActionModalOpen(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function DropdownButton({ type, onClick, menus, children }: any) {
  return (
    <Space.Compact>
      <Button type={type} onClick={onClick}>{children}</Button>
      <Select
        defaultValue=""
        style={{ width: 44 }}
        onChange={(v) => onClick()}
        options={menus.items.map((m: any) => ({ label: m.label, value: m.key }))}
      />
    </Space.Compact>
  );
}
