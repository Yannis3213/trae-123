import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Descriptions,
  Tag,
  Button,
  Space,
  Input,
  Steps,
  Timeline,
  Form,
  Modal,
  message,
  Spin,
  Tabs,
  Divider,
  List,
  Alert,
  Tooltip,
  Badge,
  Empty,
  Upload,
  Collapse,
  Checkbox,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  PaperClipOutlined,
  UploadOutlined,
  PlusOutlined,
  FileTextOutlined,
  UserOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { orderApi, type SubmitOrderRequest } from '../api';
import type {
  OrderDetailResponse,
  OrderStage,
  OrderStatus,
  ProcessingRecord,
  Role,
  WarningLevel,
  OrderAttachment,
  AuditNote,
  ExceptionLog,
} from '../types';
import { useAuth } from '../contexts/AuthContext';

const { TextArea } = Input;

const STAGE_ITEMS: OrderStage[] = ['listing', 'inventory', 'fulfillment'];

const STAGE_CONFIG: Record<
  OrderStage,
  { label: string; color: string; placeholder: string; fields: string[] }
> = {
  listing: {
    label: '商品刊登',
    color: 'blue',
    placeholder: '请输入商品刊登信息：标题、描述、图片、规格参数等（JSON格式或文本）',
    fields: ['标题', '详细描述', '高清图片', '规格参数表', '认证文件'],
  },
  inventory: {
    label: '库存同步',
    color: 'purple',
    placeholder: '请输入库存同步信息：仓库、实际库存数量、库位编码等',
    fields: ['仓库名称', '实际库存数量', '货架库位编码', '批次号', '入库凭证'],
  },
  fulfillment: {
    label: '订单履约',
    color: 'green',
    placeholder: '请输入履约信息：物流方式、运单号、报关资料、质检报告等',
    fields: ['物流方式', '运单号', '报关资料', '质检报告', '原产地证明'],
  },
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待提交',
  submitted: '已提交待审核',
  returned: '已退回需补正',
  approved: '审核通过',
  completed: '履约完成',
};

const ACTION_LABEL: Record<string, string> = {
  submit: '提交',
  resubmit: '重新提交',
  approve: '审核通过',
  return: '退回补正',
};

function getStageData(order: any, stage: OrderStage): string {
  switch (stage) {
    case 'listing':
      return order.listing_data || '';
    case 'inventory':
      return order.inventory_data || '';
    case 'fulfillment':
      return order.fulfillment_data || '';
  }
}

function getStageDueAt(order: any, stage: OrderStage): string | undefined {
  switch (stage) {
    case 'listing':
      return order.listing_due_at;
    case 'inventory':
      return order.inventory_due_at;
    case 'fulfillment':
      return order.fulfillment_due_at;
  }
}

function getWarningLevelForStage(dueAt?: string): { level: WarningLevel; text: string; cls: string } {
  if (!dueAt) return { level: 'normal', text: '正常', cls: 'warning-tag-normal' };
  const now = dayjs();
  const due = dayjs(dueAt);
  if (now.isAfter(due)) return { level: 'overdue', text: '已逾期', cls: 'warning-tag-overdue' };
  if (due.diff(now, 'hour') < 48) return { level: 'near_due', text: '临期', cls: 'warning-tag-near' };
  return { level: 'normal', text: '正常', cls: 'warning-tag-normal' };
}

function getPrevStage(stage: OrderStage): OrderStage | null {
  const idx = STAGE_ITEMS.indexOf(stage);
  return idx > 0 ? STAGE_ITEMS[idx - 1] : null;
}

function OrderDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<OrderDetailResponse | null>(null);
  const [form] = Form.useForm();
  const [dataInput, setDataInput] = useState('');
  const [auditNote, setAuditNote] = useState('');
  const [actionModal, setActionModal] = useState<{ open: boolean; action: string }>({
    open: false,
    action: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [activeStage, setActiveStage] = useState<OrderStage>('listing');
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [attachmentForm, setAttachmentForm] = useState({ file_name: '', file_url: '', file_type: '' });
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<Record<OrderStage, string[]>>({
    listing: [],
    inventory: [],
    fulfillment: [],
  });

  const loadDetail = async () => {
    setLoading(true);
    try {
      const d = await orderApi.get(id);
      setDetail(d);
      setDataInput(getStageData(d.order, d.order.current_stage));
      setActiveStage(d.order.current_stage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [id]);

  useEffect(() => {
    if (detail) {
      setDataInput(getStageData(detail.order, activeStage));
    }
  }, [activeStage, detail]);

  if (loading || !detail) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const { order, warning_level, warning_text, attachments, records, audit_notes, exceptions } = detail;
  const role = user?.role as Role;
  const isMyTurn = order.current_handler_id === user?.id;
  const cfg = STAGE_CONFIG[order.current_stage];
  const stageDueAt = getStageDueAt(order, order.current_stage);
  const stageWarning = getWarningLevelForStage(stageDueAt);

  const handleUploadAttachment = async () => {
    if (!attachmentForm.file_name || !attachmentForm.file_url) {
      message.warning('请填写文件名和文件URL');
      return;
    }
    try {
      await orderApi.uploadAttachment(id, {
        stage: activeStage,
        ...attachmentForm,
      });
      message.success('附件上传成功');
      setAttachmentForm({ file_name: '', file_url: '', file_type: '' });
      setAttachmentModalOpen(false);
      loadDetail();
    } catch (e: any) {
      message.error(e?.response?.data?.error || '上传失败');
    }
  };

  const canDoAction = (action: string) => {
    if (!isMyTurn) return false;
    if (activeStage !== order.current_stage) return false;
    if (action === 'submit' || action === 'resubmit') {
      return (
        role === 'ops_specialist' &&
        (order.current_status === 'pending' || order.current_status === 'returned')
      );
    }
    if (action === 'approve' || action === 'return') {
      if (order.current_status !== 'submitted') return false;
      if (order.current_stage === 'fulfillment') {
        return role === 'shop_owner';
      }
      return role === 'warehouse_manager';
    }
    return false;
  };

  const handleAction = async (action: string) => {
    if ((action === 'submit' || action === 'resubmit') && !dataInput.trim()) {
      message.warning(`请填写${cfg.label}数据`);
      return;
    }
    if (action === 'return' && !auditNote.trim()) {
      message.warning('请填写退回原因');
      return;
    }
    setSubmitting(true);
    try {
      const payload: SubmitOrderRequest = {
        stage: order.current_stage,
        data: dataInput,
        version: order.version,
        audit_note: auditNote,
        attachment_ids:
          action === 'submit' || action === 'resubmit'
            ? selectedAttachmentIds[order.current_stage]
            : undefined,
      };
      await orderApi.action(id, action, payload);
      message.success(`${ACTION_LABEL[action]}成功`);
      setActionModal({ open: false, action: '' });
      setAuditNote('');
      setSelectedAttachmentIds((prev) => ({ ...prev, [order.current_stage]: [] }));
      await loadDetail();
    } catch (e: any) {
      message.error(e?.response?.data?.error || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      await orderApi.addAuditNote(id, activeStage, newNote);
      message.success('备注已添加');
      setNewNote('');
      setNoteModalOpen(false);
      loadDetail();
    } catch (e: any) {
      message.error(e?.response?.data?.error || '添加失败');
    }
  };

  const getStageStatus = (stage: OrderStage) => {
    const stageIdx = STAGE_ITEMS.indexOf(stage);
    const curIdx = STAGE_ITEMS.indexOf(order.current_stage);
    if (stageIdx < curIdx) return 'finish';
    if (stageIdx === curIdx) return order.current_status === 'completed' ? 'finish' : 'process';
    return 'wait';
  };

  const getStageExtra = (stage: OrderStage) => {
    const dueAt = getStageDueAt(order, stage);
    const w = getWarningLevelForStage(dueAt);
    return (
      <Tooltip title={dueAt ? `到期时间: ${dayjs(dueAt).format('YYYY-MM-DD HH:mm')}` : ''}>
        <span className={w.cls} style={{ padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>
          {w.text}
        </span>
      </Tooltip>
    );
  };

  const isStagePassed = (stage: OrderStage) => {
    return STAGE_ITEMS.indexOf(stage) < STAGE_ITEMS.indexOf(order.current_stage);
  };

  const renderPreviousStageReview = (stage: OrderStage) => {
    const prevStage = getPrevStage(stage);
    if (!prevStage) return null;
    if (!isStagePassed(prevStage) && prevStage !== order.current_stage) return null;

    const prevData = getStageData(order, prevStage);
    const prevCfg = STAGE_CONFIG[prevStage];
    const prevAttachments: OrderAttachment[] = attachments.filter((a) => a.stage === prevStage);
    const prevNotes: AuditNote[] = audit_notes.filter((n) => n.stage === prevStage);
    const prevRecords: ProcessingRecord[] = records.filter((r) => r.stage === prevStage);
    const prevExceptions: ExceptionLog[] = exceptions.filter((e) => e.stage === prevStage);

    const items = [];

    if (prevData) {
      items.push({
        key: 'data',
        label: <Space><FileTextOutlined /> {prevCfg.label}数据</Space>,
        children: (
          <pre style={{ background: '#fafafa', padding: 12, borderRadius: 4, whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'monospace', fontSize: 13 }}>
            {prevData}
          </pre>
        ),
      });
    }

    if (prevAttachments.length > 0) {
      items.push({
        key: 'attachments',
        label: <Space><PaperClipOutlined /> 材料附件（{prevAttachments.length}份）</Space>,
        children: (
          <Space wrap>
            {prevAttachments.map((a) => (
              <Tag key={a.id} icon={<PaperClipOutlined />} style={{ padding: '4px 10px' }}>
                {a.file_name} ({a.uploaded_by?.name})
              </Tag>
            ))}
          </Space>
        ),
      });
    }

    if (prevNotes.length > 0) {
      items.push({
        key: 'notes',
        label: <Space><FileTextOutlined /> 审计备注（{prevNotes.length}条）</Space>,
        children: (
          <List
            size="small"
            dataSource={prevNotes}
            renderItem={(n) => (
              <List.Item>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div style={{ color: '#262626' }}>{n.content}</div>
                  <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                    {n.author?.name || '未知'} · {dayjs(n.created_at).format('YYYY-MM-DD HH:mm')}
                  </div>
                </Space>
              </List.Item>
            )}
          />
        ),
      });
    }

    if (prevExceptions.length > 0) {
      items.push({
        key: 'exceptions',
        label: <Space><ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> 异常记录（{prevExceptions.length}条）</Space>,
        children: (
          <List
            size="small"
            dataSource={prevExceptions}
            renderItem={(e) => (
              <List.Item>
                <Space>
                  <Tag color={e.is_resolved ? 'green' : 'red'}>
                    {e.is_resolved ? '已补正' : '待补正'}
                  </Tag>
                  <span style={{ color: '#595959' }}>{e.reason}</span>
                  {e.corrected_action && (
                    <span style={{ color: '#52c41a' }}>→ {e.corrected_action}</span>
                  )}
                  <span style={{ color: '#bfbfbf', fontSize: 12 }}>
                    {dayjs(e.created_at).format('MM-DD HH:mm')}
                  </span>
                </Space>
              </List.Item>
            )}
          />
        ),
      });
    }

    if (prevRecords.length > 0) {
      items.push({
        key: 'records',
        label: <Space><ClockCircleOutlined /> 处理记录（{prevRecords.length}条）</Space>,
        children: (
          <Timeline
            size="small"
            items={prevRecords.map((r) => ({
              color: r.is_exception ? 'red' : 'blue',
              children: (
                <div>
                  <div>
                    <span className={r.is_exception ? 'timeline-exception' : 'timeline-action'}>
                      {r.operator?.name || '未知'}
                    </span>
                    {' '}
                    {ACTION_LABEL[r.action] || r.action}：
                    {STATUS_LABELS[r.from_status]} → {STATUS_LABELS[r.to_status]}
                  </div>
                  {r.note && <div style={{ color: '#595959', marginTop: 4 }}>{r.note}</div>}
                  {r.is_exception && r.exception_reason && (
                    <div style={{ color: '#cf1322', marginTop: 4 }}>
                      <ExclamationCircleOutlined /> {r.exception_reason}
                    </div>
                  )}
                  <div style={{ color: '#bfbfbf', fontSize: 12, marginTop: 4 }}>
                    {dayjs(r.created_at).format('YYYY-MM-DD HH:mm:ss')}
                  </div>
                </div>
              ),
            }))}
          />
        ),
      });
    }

    if (items.length === 0) return null;

    return (
      <Alert
        type="info"
        showIcon
        icon={<RollbackOutlined />}
        style={{ marginBottom: 16 }}
        message={
          <Space>
            <strong>上一环节材料回顾：{prevCfg.label}</strong>
            <Tag color={prevCfg.color}>第{STAGE_ITEMS.indexOf(prevStage) + 1}阶段</Tag>
            <span style={{ color: '#8c8c8c', fontSize: 12 }}>
              请核对以下材料后再进行本环节操作
            </span>
          </Space>
        }
        description={
          <Collapse
            size="small"
            ghost
            defaultActiveKey={items.map((i) => i.key)}
            items={items}
            style={{ marginTop: 8 }}
          />
        }
      />
    );
  };

  const renderActionButtons = (stage: OrderStage) => {
    if (stage !== order.current_stage) {
      return null;
    }
    if (order.current_status === 'completed') {
      return <Tag color="success" icon={<CheckCircleOutlined />}>订单已完成</Tag>;
    }
    if (!isMyTurn) {
      return (
        <Tooltip title={order.current_handler ? `当前处理人: ${order.current_handler?.name}` : ''}>
          <Tag icon={<UserOutlined />}>等待他人处理</Tag>
        </Tooltip>
      );
    }

    return (
      <Space>
        {canDoAction('submit') && (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            size="large"
            onClick={() => setActionModal({ open: true, action: order.current_status === 'returned' ? 'resubmit' : 'submit' })}
          >
            {order.current_status === 'returned' ? '重新提交' : '提交审核'}
          </Button>
        )}
        {canDoAction('approve') && (
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            size="large"
            onClick={() => setActionModal({ open: true, action: 'approve' })}
          >
            审核通过
          </Button>
        )}
        {canDoAction('return') && (
          <Button
            danger
            icon={<CloseCircleOutlined />}
            size="large"
            onClick={() => setActionModal({ open: true, action: 'return' })}
          >
            退回补正
          </Button>
        )}
      </Space>
    );
  };

  const renderProcessPanel = (stage: OrderStage) => {
    const isCurrent = order.current_stage === stage;
    const stagePassed = isStagePassed(stage);
    const stageCfg = STAGE_CONFIG[stage];
    const stageData = getStageData(order, stage);
    const stageNotes = audit_notes.filter((n) => n.stage === stage);
    const stageAttachments = attachments.filter((a) => a.stage === stage);
    const stageExceptions = exceptions.filter((e) => e.stage === stage);
    const stageRecords = records.filter((r) => r.stage === stage);
    const isEditable = isCurrent && isMyTurn && role === 'ops_specialist' && order.current_status !== 'completed';

    const displayData = isCurrent && isEditable ? dataInput : stageData;

    return (
      <div style={{ padding: '8px 0' }}>
        {renderPreviousStageReview(stage)}

        {stageExceptions.length > 0 && (
          <Alert
            message="本环节异常记录"
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            description={
              <List
                size="small"
                dataSource={stageExceptions}
                renderItem={(e) => (
                  <List.Item>
                    <Space>
                      <Tag color={e.is_resolved ? 'green' : 'red'}>
                        {e.is_resolved ? '已补正' : '待补正'}
                      </Tag>
                      <span style={{ color: '#595959' }}>{e.reason}</span>
                      {e.corrected_action && (
                        <span style={{ color: '#52c41a' }}>→ {e.corrected_action}</span>
                      )}
                      <span style={{ color: '#bfbfbf', fontSize: 12 }}>
                        {dayjs(e.created_at).format('MM-DD HH:mm')}
                      </span>
                    </Space>
                  </List.Item>
                )}
              />
            }
          />
        )}

        {stageNotes.length > 0 && (
          <Card
            title={<span><FileTextOutlined /> 审计备注</span>}
            size="small"
            style={{ marginBottom: 16 }}
          >
            <List
              dataSource={stageNotes}
              renderItem={(n) => (
                <List.Item>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ color: '#262626' }}>{n.content}</div>
                    <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                      {n.author?.name || '未知'} · {dayjs(n.created_at).format('YYYY-MM-DD HH:mm')}
                    </div>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        )}

        {stageAttachments.length > 0 && (
          <Card
            title={
              <Space>
                <PaperClipOutlined /> 材料附件（{stageAttachments.length}份）
                {isEditable && (
                  <Tag color="blue">
                    已选 {selectedAttachmentIds[stage].length} 份
                  </Tag>
                )}
              </Space>
            }
            size="small"
            style={{ marginBottom: 16 }}
          >
            {isEditable ? (
              <Checkbox.Group
                value={selectedAttachmentIds[stage]}
                onChange={(vals) =>
                  setSelectedAttachmentIds((prev) => ({
                    ...prev,
                    [stage]: vals as string[],
                  }))
                }
              >
                <Space wrap>
                  {stageAttachments.map((a) => (
                    <Checkbox key={a.id} value={a.id}>
                      <Tag icon={<PaperClipOutlined />} style={{ padding: '4px 10px', margin: 0 }}>
                        {a.file_name} ({a.uploaded_by?.name})
                      </Tag>
                    </Checkbox>
                  ))}
                </Space>
              </Checkbox.Group>
            ) : (
              <Space wrap>
                {stageAttachments.map((a) => (
                  <Tag key={a.id} icon={<PaperClipOutlined />} style={{ padding: '4px 10px' }}>
                    {a.file_name} ({a.uploaded_by?.name})
                  </Tag>
                ))}
              </Space>
            )}
          </Card>
        )}

        <Card
          title={
            <Space>
              <FileTextOutlined /> {stageCfg.label}数据
              {stagePassed && <Tag color="green">已完成</Tag>}
              {isCurrent && !stagePassed && <Tag color="processing">办理中</Tag>}
              {!isCurrent && !stagePassed && <Tag>未开始</Tag>}
            </Space>
          }
          size="small"
          style={{ marginBottom: 16 }}
          extra={
            isCurrent && isMyTurn && (role === 'ops_specialist') && (
              <Button
                size="small"
                icon={<UploadOutlined />}
                onClick={() => setAttachmentModalOpen(true)}
              >
                上传材料
              </Button>
            )
          }
        >
          {(isCurrent || stagePassed) && displayData ? (
            <>
              {(isCurrent || stagePassed) && (
                <Alert
                  message={`必填材料：${stageCfg.fields.join('、')}`}
                  type="info"
                  showIcon
                  style={{ marginBottom: 12 }}
                />
              )}
              {isEditable ? (
                <TextArea
                  value={dataInput}
                  onChange={(e) => setDataInput(e.target.value)}
                  rows={6}
                  placeholder={stageCfg.placeholder}
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                />
              ) : (
                <pre style={{ background: '#fafafa', padding: 12, borderRadius: 4, whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'monospace', fontSize: 13 }}>
                  {displayData}
                </pre>
              )}
            </>
          ) : (
            <Empty description="本环节尚未开始，暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>

        {isCurrent && renderActionButtons(stage)}

        {stageRecords.length > 0 && (
          <Card
            title={<Space><ClockCircleOutlined /> 本环节处理记录（{stageRecords.length}条）</Space>}
            size="small"
            style={{ marginTop: 16 }}
          >
            <Timeline
              items={stageRecords.map((r) => ({
                color: r.is_exception ? 'red' : 'blue',
                children: (
                  <div>
                    <div>
                      <span className={r.is_exception ? 'timeline-exception' : 'timeline-action'}>
                        {r.operator?.name || '未知'}
                      </span>
                      {' '}
                      {ACTION_LABEL[r.action] || r.action}：
                      {STATUS_LABELS[r.from_status]} → {STATUS_LABELS[r.to_status]}
                    </div>
                    {r.note && <div style={{ color: '#595959', marginTop: 4 }}>{r.note}</div>}
                    {r.is_exception && r.exception_reason && (
                      <div style={{ color: '#cf1322', marginTop: 4 }}>
                        <ExclamationCircleOutlined /> 异常原因：{r.exception_reason}
                      </div>
                    )}
                    <div style={{ color: '#bfbfbf', fontSize: 12, marginTop: 4 }}>
                      {dayjs(r.created_at).format('YYYY-MM-DD HH:mm:ss')}
                    </div>
                  </div>
                ),
              }))}
            />
          </Card>
        )}
      </div>
    );
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回列表
        </Button>
        <Button icon={<SyncOutlined />} onClick={loadDetail}>
          刷新
        </Button>
        <Button icon={<PlusOutlined />} onClick={() => setNoteModalOpen(true)}>
          添加备注
        </Button>
        <Space style={{ marginLeft: 'auto' }}>
          <Tag color={cfg.color} style={{ fontSize: 14, padding: '4px 12px' }}>
            {cfg.label}
          </Tag>
          <Tag color={warning_level === 'overdue' ? 'red' : warning_level === 'near_due' ? 'orange' : 'green'}>
            {warning_level === 'overdue' ? <ExclamationCircleOutlined /> : warning_level === 'near_due' ? <WarningOutlined /> : <ClockCircleOutlined />}
            {warning_text}
          </Tag>
          <Badge count={`v${order.version}`} show color="#faad14" />
        </Space>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions title="订单基本信息" bordered size="small" column={3}>
          <Descriptions.Item label="订单号">
            <span style={{ fontFamily: 'monospace' }}>{order.order_no}</span>
          </Descriptions.Item>
          <Descriptions.Item label="商品">{order.product_name}</Descriptions.Item>
          <Descriptions.Item label="SKU">{order.sku}</Descriptions.Item>
          <Descriptions.Item label="店铺">{order.shop_name}</Descriptions.Item>
          <Descriptions.Item label="目的国">{order.country}</Descriptions.Item>
          <Descriptions.Item label="数量 / 金额">
            {order.quantity}件 / ¥{order.amount.toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="当前状态">
            <Space>
              <Tag>{STATUS_LABELS[order.current_status]}</Tag>
              {order.is_resubmitted && <Tag color="orange">重新提交</Tag>}
              {order.resubmit_count > 0 && <Tag>重提{order.resubmit_count}次</Tag>}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="当前处理人">
            {order.current_handler?.name || <Tag>无</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="当前环节到期时间">
            <Space>
              {stageDueAt ? dayjs(stageDueAt).format('YYYY-MM-DD HH:mm') : '-'}
              <span className={stageWarning.cls} style={{ padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>
                {stageWarning.text}
              </span>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="创建人">{order.created_by?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(order.created_at).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {dayjs(order.updated_at).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Steps
          current={STAGE_ITEMS.indexOf(order.current_stage)}
          items={STAGE_ITEMS.map((s) => ({
            title: STAGE_CONFIG[s].label,
            status: getStageStatus(s),
            description: getStageExtra(s),
          }))}
        />
      </Card>

      <Card className="stage-tabs">
        <Tabs
          activeKey={activeStage}
          onChange={(k) => setActiveStage(k as OrderStage)}
          items={STAGE_ITEMS.map((s) => ({
            key: s,
            label: (
              <Space>
                {STAGE_CONFIG[s].label}
                {s === order.current_stage && <Badge color="#1677ff" />}
                {isStagePassed(s) && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
              </Space>
            ),
            children: renderProcessPanel(s),
          }))}
        />
      </Card>

      <Modal
        title={
          actionModal.action === 'return'
            ? '退回补正'
            : actionModal.action === 'approve'
            ? '审核通过确认'
            : actionModal.action === 'resubmit'
            ? '重新提交'
            : '提交审核'
        }
        open={actionModal.open}
        onCancel={() => setActionModal({ open: false, action: '' })}
        onOk={() => handleAction(actionModal.action)}
        confirmLoading={submitting}
        okText={actionModal.action === 'return' ? '确认退回' : '确认提交'}
        okButtonProps={{
          danger: actionModal.action === 'return',
        }}
        width={600}
      >
        {actionModal.action === 'return' && (
          <>
            <Alert
              message="退回将记录异常原因并要求运营专员补正材料"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Form.Item label="退回原因" required style={{ marginBottom: 0 }}>
              <TextArea
                value={auditNote}
                onChange={(e) => setAuditNote(e.target.value)}
                rows={4}
                placeholder="请详细说明需要补正的材料和不符合要求的原因"
              />
            </Form.Item>
          </>
        )}
        {actionModal.action === 'approve' && (
          <>
            <Alert
              message={
                order.current_stage === 'fulfillment'
                  ? '确认通过后订单将标记为已完成'
                  : `确认通过后将进入${STAGE_CONFIG[getNextStage(order.current_stage)].label}环节`
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Form.Item label="审核说明（可选）" style={{ marginBottom: 0 }}>
              <TextArea
                value={auditNote}
                onChange={(e) => setAuditNote(e.target.value)}
                rows={3}
                placeholder="可填写审核通过说明"
              />
            </Form.Item>
          </>
        )}
        {(actionModal.action === 'submit' || actionModal.action === 'resubmit') && (
          <>
            {stageWarning.level === 'overdue' && (
              <Alert
                message="注意：本环节已逾期，提交后将自动记录逾期异常日志"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
            {selectedAttachmentIds[order.current_stage].length > 0 && (
              <Alert
                message={`本次提交附带 ${selectedAttachmentIds[order.current_stage].length} 份材料附件，提交后将与订单数据一起进入审核`}
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
            <Alert
              message={`提交后将由${
                order.current_stage === 'fulfillment' ? '店铺负责人' : '仓配主管'
              }进行审核，请确认材料完整。提交前版本: v${order.version}`}
              type="info"
              showIcon
            />
          </>
        )}
      </Modal>

      <Modal
        title={`添加审计备注 - ${STAGE_CONFIG[activeStage].label}`}
        open={noteModalOpen}
        onCancel={() => setNoteModalOpen(false)}
        onOk={handleAddNote}
      >
        <TextArea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={4}
          placeholder="请输入备注内容"
        />
      </Modal>

      <Modal
        title={`上传材料附件 - ${STAGE_CONFIG[activeStage].label}`}
        open={attachmentModalOpen}
        onCancel={() => setAttachmentModalOpen(false)}
        onOk={handleUploadAttachment}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            placeholder="文件名（如：商品规格参数表.pdf）"
            value={attachmentForm.file_name}
            onChange={(e) => setAttachmentForm({ ...attachmentForm, file_name: e.target.value })}
          />
          <Input
            placeholder="文件类型（如：application/pdf）"
            value={attachmentForm.file_type}
            onChange={(e) => setAttachmentForm({ ...attachmentForm, file_type: e.target.value })}
          />
          <Input
            placeholder="文件URL或存储路径"
            value={attachmentForm.file_url}
            onChange={(e) => setAttachmentForm({ ...attachmentForm, file_url: e.target.value })}
          />
        </Space>
      </Modal>
    </div>
  );
}

function getNextStage(current: OrderStage): OrderStage {
  switch (current) {
    case 'listing':
      return 'inventory';
    case 'inventory':
      return 'fulfillment';
    default:
      return 'fulfillment';
  }
}

export default OrderDetail;
