import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Tag, Descriptions, Button, Space, Form, Input, Select, Modal,
  Timeline, List, message, Alert, Empty, Upload, Badge, Dropdown, Steps,
  Divider
} from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import {
  FileTextOutlined, UploadOutlined,
  ArrowLeftOutlined, ExclamationCircleOutlined, UserOutlined, ClockCircleOutlined,
  DownOutlined, PaperClipOutlined, InboxOutlined, CheckCircleOutlined,
  WarningOutlined, SafetyCertificateOutlined, EditOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import dayjs from 'dayjs';
import {
  api, InboundOrder, Attachment, ProcessingRecord, AuditNote, ExceptionReason,
  ROLE_LABEL, STATUS_LABEL, MODULE_LABEL, ProcessOrderRequest
} from '../api';

const { TextArea } = Input;
const { Option } = Select;
const { Dragger } = Upload;

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

const MODULE_ICONS: Record<string, string> = {
  appointment: '📅',
  inspection: '🔍',
  registration: '📝',
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
  const [moduleEditors, setModuleEditors] = useState<Record<string, boolean>>({});
  const [moduleForms] = useState<Record<string, any>>({
    appointment: Form.useForm()[0],
    inspection: Form.useForm()[0],
    registration: Form.useForm()[0],
  });
  const [uploadModule, setUploadModule] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [attachUploading, setAttachUploading] = useState(false);

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

  const urgencyTagColor = urgency.key === 'overdue' ? 'red' : urgency.key === 'near' ? 'orange' : 'green';
  const urgencyStyle = urgency.key === 'overdue' ? 'urgency-overdue' : urgency.key === 'near' ? 'urgency-near' : 'urgency-normal';

  const openAction = (action: string) => {
    setCurrentAction(action);
    form.resetFields();
    setActionModalOpen(true);
  };

  const primaryActions = ['提交', '确认通过', '最终确认'];
  const primaryAction = available_actions.find((a) => primaryActions.includes(a)) || '';
  const otherActions = available_actions.filter((a) => !primaryActions.includes(a));

  const getActionIcon = (a: string) => {
    if (a === '最终确认') return <SafetyCertificateOutlined />;
    if (a === '确认通过') return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    if (a === '退回补正') return <WarningOutlined style={{ color: '#fa8c16' }} />;
    if (a === '提交') return <InboxOutlined style={{ color: '#1677ff' }} />;
    return <EditOutlined />;
  };

  const primaryActionIcon = primaryAction ? getActionIcon(primaryAction) : null;

  const otherMenuItems: MenuProps['items'] = otherActions.map((a) => ({
    key: a,
    label: (
      <span onClick={() => openAction(a)}>
        {getActionIcon(a)}
        <span style={{ marginLeft: 6 }}>{a}</span>
      </span>
    ),
  }));

  const actionMenuItems: MenuProps['items'] = available_actions.map((a) => ({
    key: a,
    label: (
      <span onClick={() => openAction(a)}>
        {a === '最终确认' && <SafetyCertificateOutlined style={{ marginRight: 6 }} />}
        {a === '确认通过' && <CheckCircleOutlined style={{ marginRight: 6, color: '#52c41a' }} />}
        {a === '退回补正' && <WarningOutlined style={{ marginRight: 6, color: '#fa8c16' }} />}
        {(a === '提交' || a === '补正' || a === '保存') && <InboxOutlined style={{ marginRight: 6, color: '#1677ff' }} />}
        {a}
      </span>
    ),
  }));

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
        appointment_evidence: values.appointment_evidence,
        inspection_evidence: values.inspection_evidence,
        registration_evidence: values.registration_evidence,
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

  const handleModuleSave = async (moduleKey: string) => {
    const f = moduleForms[moduleKey];
    try {
      const values = await f.validateFields();
      setProcessing(true);
      const fieldMap: Record<string, keyof ProcessOrderRequest> = {
        appointment: 'appointment_evidence',
        inspection: 'inspection_evidence',
        registration: 'registration_evidence',
      };
      const req: ProcessOrderRequest = {
        order_id: order.id,
        version: order.version,
        action: '补正',
        opinion: values.opinion || `补正${MODULE_LABEL[moduleKey] || moduleKey}材料`,
        [fieldMap[moduleKey]]: values.evidence,
      };
      const resp = await api.processOrder(req);
      if (resp.data.success) {
        message.success(`${MODULE_LABEL[moduleKey]}补正成功，版本已更新`);
        setModuleEditors((prev) => ({ ...prev, [moduleKey]: false }));
        f.resetFields();
        loadData();
      } else {
        message.error(resp.data.message || '补正失败');
      }
    } catch {
      /* validateFields failed */
    } finally {
      setProcessing(false);
    }
  };

  const handleUpload = async (file: File, moduleKey: string) => {
    setAttachUploading(true);
    try {
      const resp = await api.uploadAttachment(order.id, file.name, moduleKey);
      if (resp.data.success && resp.data.data) {
        message.success(`附件「${file.name}」已登记`);
        const f = moduleForms[moduleKey];
        const cur = f.getFieldValue('evidence') || '';
        f.setFieldsValue({ evidence: cur ? `${cur}; ${file.name}` : file.name });
        loadData();
      } else {
        message.error(resp.data.message || '上传失败');
      }
    } finally {
      setAttachUploading(false);
    }
  };

  const handleGeneralUpload: UploadProps['customRequest'] = async (options) => {
    const file = options.file as File;
    setAttachUploading(true);
    try {
      const moduleKey = uploadModule || 'general';
      const resp = await api.uploadAttachment(order.id, file.name, moduleKey);
      if (resp.data.success) {
        message.success(`附件「${file.name}」上传成功`);
        loadData();
      } else {
        message.error(resp.data.message || '上传失败');
      }
    } finally {
      setAttachUploading(false);
      setUploadModalOpen(false);
    }
  };

  const actionNeedsException = currentAction === '退回补正';
  const isManager = current_user.role === 'operations_manager';
  const isSupervisor = current_user.role === 'warehouse_supervisor';
  const isKeeper = current_user.role === 'warehouse_keeper';

  const moduleKeys = ['appointment', 'inspection', 'registration'] as const;

  const currentStep = (() => {
    if (order.status === 'rechecked') return 2;
    if (order.current_handler_role === 'operations_manager') return 2;
    if (order.current_handler_role === 'warehouse_supervisor') return 1;
    return 0;
  })();

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
          <Tag color={urgencyTagColor} className={urgencyStyle} style={{ padding: '4px 12px', fontSize: 14 }}>
            <ClockCircleOutlined /> {urgency.label}
          </Tag>
          <Tag color="blue" style={{ padding: '4px 12px', fontSize: 13 }}>
            版本 v{order.version}
          </Tag>
          <Button onClick={loadData} loading={loading}>刷新</Button>
          {available_actions.length > 0 && (
            <>
              {primaryAction && (
                <Button type="primary" icon={primaryActionIcon} onClick={() => openAction(primaryAction)}>
                  {primaryAction}
                </Button>
              )}
              {otherActions.length > 0 && (
                <Dropdown menu={{ items: otherMenuItems }} placement="bottomRight">
                  <Button>
                    <Space>
                      更多操作
                      <DownOutlined />
                    </Space>
                  </Button>
                </Dropdown>
              )}
            </>
          )}
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Steps
         
          current={currentStep}
          status={order.status === 'exception' ? 'error' : order.status === 'rechecked' ? 'finish' : 'process'}
          items={[
            { title: '库管员办理', description: '入库预约/质检/登记', subTitle: current_user.role === 'warehouse_keeper' && order.current_handler_role === 'warehouse_keeper' ? '← 当前' : '' },
            { title: '仓储主管审核', description: '确认或退回补正', subTitle: current_user.role === 'warehouse_supervisor' && order.current_handler_role === 'warehouse_supervisor' ? '← 当前' : '' },
            { title: '运营经理复核', description: '最终确认归档', subTitle: current_user.role === 'operations_manager' && order.current_handler_role === 'operations_manager' ? '← 当前' : '' },
          ]}
        />
      </Card>

      {(urgency.key === 'overdue' || order.status === 'exception') && (
        <Alert
          type={urgency.key === 'overdue' ? 'error' : 'warning'}
          showIcon
          style={{ marginBottom: 16 }}
          message={urgency.key === 'overdue' ? '该单据已逾期，仅允许补正或退回操作' : '该单据处于异常状态，请完成补正后重新提交'}
          description={
            <Space direction="vertical" size={4}>
              {order.deadline && <span>截止时间：{dayjs(order.deadline).format('YYYY-MM-DD HH:mm')}</span>}
              <span>责任角色：{ROLE_LABEL[order.current_handler_role]} · 责任人：{order.current_handler_name || '-'}</span>
            </Space>
          }
        />
      )}

      {exception_reasons.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`⚠️ 存在 ${exception_reasons.length} 条异常原因，请完成补正`}
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {exception_reasons.map((e) => (
                <li key={e.id} style={{ marginBottom: 4 }}>
                  <Tag color="volcano" style={{ marginRight: 8 }}>{MODULE_LABEL[e.module] || e.module}</Tag>
                  <strong>{e.reason}</strong>
                  <span style={{ color: '#8c8c8c', fontSize: 12, marginLeft: 8 }}>
                    （创建：{dayjs(e.created_at).format('YYYY-MM-DD HH:mm')}）
                  </span>
                </li>
              ))}
            </ul>
          }
        />
      )}

      <Row gutter={16}>
        <Col span={16}>
          <Card title="📋 基本信息" style={{ marginBottom: 16 }}>
            <Descriptions column={2}>
              <Descriptions.Item label="入库单号"><strong>{order.order_no}</strong></Descriptions.Item>
              <Descriptions.Item label="版本号"><Tag color="blue">v{order.version}</Tag></Descriptions.Item>
              <Descriptions.Item label="供应商">{order.supplier_name}</Descriptions.Item>
              <Descriptions.Item label="物料名称">{order.material_name}</Descriptions.Item>
              <Descriptions.Item label="数量">{order.quantity.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="单据状态"><Tag color={statusColor()}>{STATUS_LABEL[order.status]}</Tag></Descriptions.Item>
              <Descriptions.Item label="创建时间">{dayjs(order.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="最近更新">{dayjs(order.updated_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="当前处理角色"><Tag color="geekblue">{ROLE_LABEL[order.current_handler_role]}</Tag></Descriptions.Item>
              <Descriptions.Item label="当前处理人"><UserOutlined /> {order.current_handler_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="截止时间" span={2}>
                {order.deadline ? (
                  <span style={{
                    color: urgency.key === 'overdue' ? '#ff4d4f' : urgency.key === 'near' ? '#fa8c16' : '#1f1f1f',
                    fontWeight: 500,
                  }}>
                    <ClockCircleOutlined /> {dayjs(order.deadline).format('YYYY-MM-DD HH:mm')}
                    {'  '}
                    <span style={{ color: '#8c8c8c', fontWeight: 400, fontSize: 12 }}>
                      （{urgency.key === 'overdue' ? `已逾期 ${Math.abs(dayjs(order.deadline).diff(dayjs(), 'hour'))} 小时` : urgency.key === 'near' ? `剩余 ${dayjs(order.deadline).diff(dayjs(), 'hour')} 小时` : `剩余 ${dayjs(order.deadline).diff(dayjs(), 'hour')} 小时`}）
                    </span>
                  </span>
                ) : '无截止时间'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <div className="section-title" style={{ marginTop: 8 }}>🧩 业务模块（可在此补正缺项）</div>
          <Row gutter={12} style={{ marginBottom: 16 }}>
            {moduleKeys.map((mk) => {
              const title = MODULE_LABEL[mk] || mk;
              const icon = MODULE_ICONS[mk];
              const complete = order[`${mk}_complete` as keyof InboundOrder] as boolean;
              const evidence = order[`${mk}_evidence` as keyof InboundOrder] as string | undefined;
              const hasException = exception_reasons.some((e) => e.module === mk);
              const isEditing = moduleEditors[mk];
              const f = moduleForms[mk];
              return (
                <Col span={8} key={mk}>
                  <Card
                   
                    className={`module-card ${complete ? 'complete' : 'incomplete'}`}
                    style={{
                      borderColor: hasException ? '#ff4d4f' : complete ? '#52c41a' : '#faad14',
                      background: hasException ? '#fff1f0' : undefined,
                    }}
                    title={
                      <Space size={8}>
                        <span style={{ fontSize: 20 }}>{icon}</span>
                        <strong>{title}</strong>
                        <Badge
                          status={complete ? 'success' : hasException ? 'error' : 'warning'}
                          text={hasException ? '有异常' : complete ? '已完成' : '待补正'}
                        />
                      </Space>
                    }
                    extra={
                      can_edit_modules && order.status !== 'rechecked' && (
                        <Space size={4}>
                          <Button
                           
                            onClick={() => {
                              setUploadModule(mk);
                              setUploadModalOpen(true);
                            }}
                            icon={<UploadOutlined />}
                          >
                            附件
                          </Button>
                          <Button
                           
                            type={complete ? 'default' : 'primary'}
                            onClick={() => {
                              if (!isEditing) {
                                f.setFieldsValue({
                                  evidence: evidence || '',
                                  opinion: `补正${title}材料`,
                                });
                              }
                              setModuleEditors((prev) => ({ ...prev, [mk]: !isEditing }));
                            }}
                          >
                            {isEditing ? '收起' : complete ? '修改' : '立即补正'}
                          </Button>
                        </Space>
                      )
                    }
                  >
                    {!isEditing ? (
                      <div>
                        {evidence ? (
                          <div>
                            <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 4 }}>证据材料：</div>
                            <div style={{ background: '#fff', padding: '8px 12px', borderRadius: 4, border: '1px solid #e8e8e8', wordBreak: 'break-all' }}>
                              <PaperClipOutlined style={{ color: '#1677ff' }} /> {evidence}
                            </div>
                          </div>
                        ) : (
                          <div style={{ color: '#fa8c16' }}>
                            <ExclamationCircleOutlined /> 暂无证据材料
                            {can_edit_modules && order.status !== 'rechecked' && '，请点击「立即补正」'}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Form form={f} layout="vertical">
                        <Form.Item
                          name="evidence"
                          label={`${title}证据描述/文件名`}
                          rules={[{ required: true, message: `请填写${title}证据信息` }]}
                        >
                          <TextArea rows={2} placeholder={`例如：${title}确认单_${order.supplier_name}_${dayjs().format('YYYYMMDD')}.pdf`} />
                        </Form.Item>
                        <Form.Item name="opinion" label="补正说明（作为处理意见）">
                          <TextArea rows={2} placeholder="可选，填定本次补正的说明" />
                        </Form.Item>
                        <Form.Item style={{ marginBottom: 0 }}>
                          <Space wrap>
                            <Dragger
                              name="file"
                              multiple={false}
                              style={{ padding: 8, marginBottom: 8, width: '100%' }}
                              showUploadList={false}
                              beforeUpload={(file) => { handleUpload(file, mk); return false; }}
                            >
                              <p className="ant-upload-drag-icon"><UploadOutlined /></p>
                              <p className="ant-upload-hint" style={{ fontSize: 12 }}>点击或拖拽上传附件作为证据</p>
                            </Dragger>
                            <Button type="primary" htmlType="submit" loading={processing} onClick={() => handleModuleSave(mk)}>
                              保存补正（版本+1）
                            </Button>
                            <Button onClick={() => setModuleEditors((p) => ({ ...p, [mk]: false }))}>
                              取消
                            </Button>
                          </Space>
                        </Form.Item>
                      </Form>
                    )}
                  </Card>
                </Col>
              );
            })}
          </Row>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Card title="💬 最近处理意见" extra={<Tag color="default">上一处理人</Tag>}>
                <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, minHeight: 60, fontSize: 13 }}>
                  {order.last_opinion || <span style={{ color: '#bfbfbf' }}>暂无处理意见</span>}
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="🔖 最近审计备注" extra={<Tag color="blue">运营经理必填</Tag>}>
                <div style={{ background: '#e6f4ff', padding: 12, borderRadius: 4, minHeight: 60, fontSize: 13 }}>
                  {order.last_audit_note || <span style={{ color: '#bfbfbf' }}>暂无审计备注</span>}
                </div>
              </Card>
            </Col>
          </Row>

          <Card
            title={<Space><PaperClipOutlined style={{ color: '#1677ff' }} />附件列表（{attachments.length}）</Space>}
           
            style={{ marginBottom: 16 }}
            extra={
              can_edit_modules && order.status !== 'rechecked' && (
                <Button
                  type="primary"
                 
                  icon={<UploadOutlined />}
                  onClick={() => { setUploadModule('general'); setUploadModalOpen(true); }}
                >
                  上传附件
                </Button>
              )
            }
          >
            {attachments.length === 0 ? (
              <Empty description="暂无附件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
               
                dataSource={attachments}
                renderItem={(a) => (
                  <List.Item
                    actions={[
                      <Tag key="m" color="blue">{MODULE_LABEL[a.module] || a.module}</Tag>,
                      <span key="t" style={{ color: '#8c8c8c', fontSize: 12 }}>{dayjs(a.uploaded_at).format('MM-DD HH:mm')}</span>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<FileTextOutlined style={{ fontSize: 22, color: '#1677ff' }} />}
                      title={<span style={{ fontWeight: 500 }}>{a.filename}</span>}
                      description={
                        <Space size={12}>
                          <span><UserOutlined /> {a.uploaded_by}</span>
                          <span style={{ color: '#8c8c8c' }}>角色：{ROLE_LABEL[a.uploader_role] || a.uploader_role}</span>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        <Col span={8}>
          <Card title="🔄 处理记录 / 审计轨迹" style={{ marginBottom: 16 }}>
            <div className="timeline-wrapper">
              {processing_records.length === 0 ? (
                <Empty description="暂无处理记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Timeline
                  mode="left"
                  items={processing_records.map((r) => {
                    const isBack = r.action.includes('退回');
                    const isConfirm = r.action.includes('确认') || r.action.includes('最终');
                    return {
                      color: isBack ? 'red' : isConfirm ? 'green' : r.action === '补正' ? 'orange' : 'blue',
                      label: <div style={{ fontSize: 12, color: '#8c8c8c', whiteSpace: 'nowrap' }}>{dayjs(r.processed_at).format('MM-DD HH:mm')}</div>,
                      children: (
                        <div style={{ fontSize: 13 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            {r.action}
                            <Tag style={{ marginLeft: 6, fontSize: 12 }} color="blue">{ROLE_LABEL[r.handler_role]}</Tag>
                          </div>
                          <div style={{ color: '#595959', marginBottom: 4 }}>
                            <UserOutlined /> {r.handler_name}
                          </div>
                          <div style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, marginBottom: 4 }}>
                            {r.opinion}
                          </div>
                          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                            {STATUS_LABEL[r.from_status] || '发起'} → {STATUS_LABEL[r.to_status]}
                          </div>
                        </div>
                      ),
                    };
                  })}
                />
              )}
            </div>
          </Card>

          <Card title="📝 审计备注记录">
            {audit_notes.length === 0 ? (
              <Empty description="暂无审计备注" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
               
                dataSource={audit_notes}
                renderItem={(n) => (
                  <List.Item style={{ alignItems: 'flex-start', padding: '10px 0' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, marginBottom: 4 }}>
                        <Tag color="purple">{ROLE_LABEL[n.creator_role] || n.creator_role}</Tag>
                        <span style={{ color: '#8c8c8c' }}>{dayjs(n.created_at).format('MM-DD HH:mm')}</span>
                      </div>
                      <div style={{ background: '#e6f4ff', padding: 10, borderRadius: 6, border: '1px solid #91caff' }}>
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
        title={
          <Space>
            {currentAction === '退回补正' ? <WarningOutlined style={{ color: '#fa8c16' }} /> : currentAction === '最终确认' ? <SafetyCertificateOutlined style={{ color: '#1677ff' }} /> : <InboxOutlined />}
            <span>办理操作：{currentAction}</span>
          </Space>
        }
        open={actionModalOpen}
        onCancel={() => setActionModalOpen(false)}
        footer={null}
        width={600}
        destroyOnClose
        maskClosable={false}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`将对单据「${order.order_no}」执行「${currentAction}」操作`}
          description={
            <Space direction="vertical" size={0} style={{ fontSize: 12 }}>
              <span>当前状态：<Tag color={statusColor()}>{STATUS_LABEL[order.status]}</Tag> · 版本：<Tag color="blue">v{order.version}</Tag></span>
              <span>当前角色：{ROLE_LABEL[order.current_handler_role]} · 处理人：{order.current_handler_name}</span>
              {isManager && <span style={{ color: '#fa8c16' }}>※ 运营经理操作必须填写审计备注</span>}
              {currentAction === '退回补正' && <span style={{ color: '#fa8c16' }}>※ 退回必须指明异常模块和原因</span>}
            </Space>
          }
        />
        <Form form={form} layout="vertical" onFinish={handleAction}>
          {isKeeper && (currentAction === '提交') && (
            <Row gutter={12}>
              {moduleKeys.map((mk) => {
                const done = order[`${mk}_complete` as keyof InboundOrder] as boolean;
                const ev = order[`${mk}_evidence` as keyof InboundOrder] as string | undefined;
                const field = `${mk}_evidence`;
                return (
                  <Col span={8} key={mk}>
                    <Form.Item
                      name={field}
                      label={
                        <Space>
                          {MODULE_ICONS[mk]} {MODULE_LABEL[mk]}
                          {done ? <Tag color="green">已有</Tag> : <Tag color="red">缺项</Tag>}
                        </Space>
                      }
                      extra={ev ? <span style={{ fontSize: 11, color: '#8c8c8c' }}>原：{ev}</span> : undefined}
                    >
                      <Input placeholder={done ? '可留空沿用' : `请输入${MODULE_LABEL[mk]}证据`} />
                    </Form.Item>
                  </Col>
                );
              })}
            </Row>
          )}
          {(isSupervisor || isManager) && (currentAction === '确认通过' || currentAction === '最终确认') && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="系统已校验三模块完整性，如仍有缺项将被后端拦截"
            />
          )}
          <Form.Item
            name="opinion"
            label={<strong><span style={{ color: '#ff4d4f' }}>*</span> 处理意见</strong>}
            rules={[{ required: true, message: '处理意见必填（最少 5 个字）', min: 5 }]}
          >
            <TextArea rows={3} placeholder={`请详细描述本次「${currentAction}」的处理意见...`} showCount maxLength={500} />
          </Form.Item>
          {actionNeedsException && (
            <>
              <Divider orientation="left" plain style={{ margin: '8px 0' }}>退回信息（必填）</Divider>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item
                    name="exception_module"
                    label={<strong><span style={{ color: '#ff4d4f' }}>*</span> 异常所属模块</strong>}
                    rules={[{ required: true, message: '请指明异常模块' }]}
                  >
                    <Select placeholder="选择异常模块">
                      <Option value="appointment">入库预约</Option>
                      <Option value="inspection">质检上架</Option>
                      <Option value="registration">入库单登记</Option>
                      <Option value="general">综合/其他</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="exception_reason"
                label={<strong><span style={{ color: '#ff4d4f' }}>*</span> 异常原因</strong>}
                rules={[{ required: true, message: '异常原因必填（最少 10 个字）', min: 10 }]}
              >
                <TextArea rows={3} placeholder="请详细描述异常原因，便于后续补正..." showCount maxLength={500} />
              </Form.Item>
            </>
          )}
          {isManager && (
            <>
              <Divider orientation="left" plain style={{ margin: '8px 0' }}>审计信息（运营经理必填）</Divider>
              <Form.Item
                name="audit_note"
                label={<strong><span style={{ color: '#ff4d4f' }}>*</span> 审计备注</strong>}
                rules={[{ required: true, message: '运营经理必须填写审计备注', min: 5 }]}
              >
                <TextArea rows={2} placeholder="请填写审计备注，作为永久审计留痕..." showCount maxLength={300} />
              </Form.Item>
            </>
          )}
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setActionModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={processing} danger={currentAction === '退回补正'}>
                确认执行「{currentAction}」
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <UploadOutlined style={{ color: '#1677ff' }} />
            <span>上传附件 - {MODULE_LABEL[uploadModule || 'general'] || '通用'}</span>
          </Space>
        }
        open={uploadModalOpen}
        onCancel={() => { setUploadModalOpen(false); setUploadModule(null); }}
        footer={null}
        width={480}
        destroyOnClose
      >
        <Dragger
          name="file"
          multiple={false}
          customRequest={handleGeneralUpload}
          showUploadList={false}
          accept="*"
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持单文件上传，登记后将持久化到 SQLite 并关联此入库单</p>
        </Dragger>
        {uploadModule && uploadModule !== 'general' && (
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 12 }}
            message={`上传的附件将标记为「${MODULE_LABEL[uploadModule]}」模块证据`}
            description="提示：上传后请在对应模块点击「立即补正」填写证据描述，以完成模块补正"
          />
        )}
      </Modal>
    </div>
  );
}
