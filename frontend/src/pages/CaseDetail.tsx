import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Table,
  List,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tabs,
  Row,
  Col,
  Statistic,
  Alert,
  Typography,
  Timeline,
  Checkbox,
  Divider,
  Tooltip,
  Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  ReloadOutlined,
  PaperClipOutlined,
  EditOutlined,
  AuditOutlined,
  RollbackOutlined,
  CheckOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { caseApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import {
  CaseWithDetail,
  CaseStatus,
  ProcessingStage,
  STATUS_DISPLAY,
  STATUS_COLOR,
  STAGE_DISPLAY,
  EXPIRY_DISPLAY,
  EXPIRY_COLOR,
  ROLE_DISPLAY,
  ProcessingRecord,
  Attachment,
  AuditNote,
  Role,
} from '../types';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { TabPane } = Tabs;
const { confirm } = Modal;
const { Option } = Select;

interface ProcessingTimelineStep {
  stage: ProcessingStage;
  title: string;
  role: Role;
  roleName: string;
  completed: boolean;
  active: boolean;
  records: ProcessingRecord[];
}

const CaseDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [caseData, setCaseData] = useState<CaseWithDetail | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState<CaseStatus | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [attachModalVisible, setAttachModalVisible] = useState(false);
  const [attachLoading, setAttachLoading] = useState(false);
  const [noteForm] = Form.useForm();
  const [actionForm] = Form.useForm();
  const [attachForm] = Form.useForm();

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await caseApi.getCaseDetail(id);
      setCaseData(data);
    } catch (err: any) {
      message.error(err.response?.data?.message || '获取详情失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getTimelineSteps = (): ProcessingTimelineStep[] => {
    if (!caseData) return [];

    const stages: ProcessingTimelineStep[] = [
      {
        stage: 'registration',
        title: '警情登记',
        role: 'dispatcher',
        roleName: '警情处置登记员',
        completed: caseData.registration_materials_complete && caseData.current_stage !== 'registration',
        active: caseData.current_stage === 'registration',
        records: caseData.processing_records.filter((r) => r.stage === 'registration'),
      },
      {
        stage: 'dispatch',
        title: '处置派警',
        role: 'police_officer',
        roleName: '警情处置审核主管',
        completed: caseData.current_stage === 'review' || caseData.status === 'completed',
        active: caseData.current_stage === 'dispatch',
        records: caseData.processing_records.filter((r) => r.stage === 'dispatch'),
      },
      {
        stage: 'review',
        title: '复核归档',
        role: 'reviewer',
        roleName: '派出所复核负责人',
        completed: caseData.status === 'completed',
        active: caseData.current_stage === 'review' && caseData.status !== 'completed',
        records: caseData.processing_records.filter((r) => r.stage === 'review'),
      },
    ];

    return stages;
  };

  const getAllowedActions = () => {
    if (!caseData || !user || caseData.status === 'completed') return [];

    const actions: {
      key: CaseStatus;
      label: string;
      type: 'primary' | 'default';
      danger?: boolean;
      disabled?: boolean;
      disabledReason?: string;
    }[] = [];

    switch (user.role) {
      case 'dispatcher':
        if (caseData.status === 'pending_correction' && caseData.current_stage === 'registration' && caseData.created_by === user.id) {
          const canSubmit = caseData.registration_materials_complete;
          actions.push({
            key: 'under_review',
            label: '提交审核',
            type: 'primary',
            disabled: !canSubmit,
            disabledReason: canSubmit ? '' : '请先确认登记材料已齐全',
          });
        }
        break;

      case 'police_officer':
        if (
          caseData.status === 'under_review' &&
          caseData.current_stage === 'dispatch' &&
          caseData.current_handler_id === user.id
        ) {
          const canSubmit =
            caseData.registration_materials_complete &&
            caseData.dispatch_timeline_met &&
            caseData.followup_evidence_complete;
          actions.push({
            key: 'under_review',
            label: '完成处置，移交复核',
            type: 'primary',
            disabled: !canSubmit,
            disabledReason: canSubmit
              ? ''
              : '请确保登记材料齐全、派及时限达标、回访证据完整',
          });
        }
        break;

      case 'reviewer':
        if (caseData.status === 'under_review' && caseData.current_stage === 'review') {
          const canComplete =
            caseData.registration_materials_complete &&
            caseData.dispatch_timeline_met &&
            caseData.followup_evidence_complete;
          actions.push({
            key: 'pending_correction',
            label: '退回补正',
            type: 'default',
            danger: true,
          });
          actions.push({
            key: 'completed',
            label: '复核通过，办结归档',
            type: 'primary',
            disabled: !canComplete,
            disabledReason: canComplete
              ? ''
              : '请确保登记材料齐全、派及时限达标、回访证据完整',
          });
        }
        break;
    }

    return actions;
  };

  const handleActionClick = (action: CaseStatus) => {
    setCurrentAction(action);
    actionForm.resetFields();
    actionForm.setFieldsValue({
      registration_materials_complete: caseData?.registration_materials_complete,
      dispatch_timeline_met: caseData?.dispatch_timeline_met,
      followup_evidence_complete: caseData?.followup_evidence_complete,
    });
    setActionModalVisible(true);
  };

  const handleActionSubmit = async (values: any) => {
    if (!caseData || !currentAction || !id) return;

    setActionLoading(true);
    try {
      const expiryStatus = caseData.expiry_status;
      if (expiryStatus === 'overdue' && currentAction === 'completed') {
        confirm({
          title: '案件已逾期',
          content: '该案件已超过办理期限，是否先添加逾期说明备注再办理？',
          okText: '先添加备注',
          cancelText: '继续办理',
          onOk: () => {
            setNoteModalVisible(true);
            setActionModalVisible(false);
          },
          onCancel: async () => {
            await doSubmit(values);
          },
        });
        setActionLoading(false);
        return;
      }

      await doSubmit(values);
    } catch (err: any) {
      const errorData = err.response?.data;
      let errorMsg = errorData?.message || '操作失败';

      if (errorData?.details?.errors) {
        const errors = errorData.details.errors as Array<{ field: string; message: string }>;
        errorMsg = errors.map((e) => e.message).join('；');
      }

      Modal.error({
        title: '操作失败',
        content: (
          <div>
            <p>{errorMsg}</p>
            {errorData?.error === 'CONFLICT' && (
              <p style={{ color: '#fa8c16', marginTop: 8 }}>
                提示：可能存在版本冲突，请刷新页面后重试
              </p>
            )}
            {errorData?.error === 'FORBIDDEN' && (
              <p style={{ color: '#fa8c16', marginTop: 8 }}>
                提示：你当前的角色无权执行此操作，请切换正确的角色
              </p>
            )}
          </div>
        ),
      });
    } finally {
      setActionLoading(false);
    }
  };

  const doSubmit = async (values: any) => {
    if (!caseData || !currentAction || !id) return;

    await caseApi.updateStatus({
      case_id: id,
      to_status: currentAction,
      remarks: values.remarks,
      version: caseData.version,
      registration_materials_complete: values.registration_materials_complete,
      dispatch_timeline_met: values.dispatch_timeline_met,
      followup_evidence_complete: values.followup_evidence_complete,
    });

    message.success('操作成功');
    setActionModalVisible(false);
    setCurrentAction(null);
    fetchData();
  };

  const handleAddNote = async (values: any) => {
    if (!id) return;
    try {
      await caseApi.addAuditNote({
        case_id: id,
        note: values.note,
        anomaly_reason: values.anomaly_reason,
      });
      message.success('备注添加成功');
      setNoteModalVisible(false);
      noteForm.resetFields();
      fetchData();
    } catch (err: any) {
      message.error(err.response?.data?.message || '添加备注失败');
    }
  };

  const handleAddAttachment = async (values: any) => {
    if (!id) return;
    setAttachLoading(true);
    try {
      await caseApi.addAttachment({
        case_id: id,
        file_name: values.file_name,
        file_type: values.file_type || 'application/pdf',
        file_size: values.file_size || 102400,
        category: values.category,
      });
      message.success('附件添加成功');
      setAttachModalVisible(false);
      attachForm.resetFields();
      fetchData();
    } catch (err: any) {
      message.error(err.response?.data?.message || '添加附件失败');
    } finally {
      setAttachLoading(false);
    }
  };

  const renderEvidenceStatus = () => {
    if (!caseData) return null;

    const items = [
      {
        key: 'registration',
        label: '警情登记材料',
        value: caseData.registration_materials_complete,
        desc: '报案笔录、受案回执等',
      },
      {
        key: 'dispatch',
        label: '处置派警时限',
        value: caseData.dispatch_timeline_met,
        desc: '是否在规定时限内派警处置',
      },
      {
        key: 'followup',
        label: '回访确认证据',
        value: caseData.followup_evidence_complete,
        desc: '回访录音、当事人确认记录等',
      },
    ];

    return (
      <Row gutter={16}>
        {items.map((item) => (
          <Col span={8} key={item.key}>
            <Card
              size="small"
              style={{
                borderColor: item.value ? '#52c41a' : '#ff4d4f',
                borderWidth: 2,
              }}
            >
              <Space align="center">
                {item.value ? (
                  <CheckCircleOutlined className="evidence-ok" style={{ fontSize: 24 }} />
                ) : (
                  <CloseCircleOutlined className="evidence-no" style={{ fontSize: 24 }} />
                )}
                <div>
                  <Text strong>{item.label}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {item.desc}
                  </Text>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  const renderProcessingTimeline = () => {
    const steps = getTimelineSteps();

    return (
      <Timeline
        items={steps.map((step) => ({
          color: step.completed ? 'green' : step.active ? 'blue' : 'gray',
          children: (
            <div>
              <Space align="center">
                <Text strong style={{ fontSize: 16 }}>
                  {step.title}
                </Text>
                <Tag color={step.completed ? 'green' : step.active ? 'blue' : 'default'}>
                  {step.completed ? '已完成' : step.active ? '进行中' : '待处理'}
                </Tag>
              </Space>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                  责任人：{step.roleName}
                  {caseData?.current_stage === step.stage && caseData?.current_handler_name && (
                    <span>（当前：{caseData.current_handler_name}）</span>
                  )}
                </Text>
              </div>
              {step.records.length > 0 && (
                <div style={{ marginTop: 12, paddingLeft: 16, borderLeft: '2px solid #d9d9d9' }}>
                  {step.records.map((record) => (
                    <div key={record.id} style={{ marginBottom: 12 }}>
                      <div>
                        <Text strong>{record.action}</Text>
                        <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                          {record.handler_name} ({ROLE_DISPLAY[record.handler_role]})
                        </Text>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss')}
                      </Text>
                      {record.remarks && (
                        <div style={{ marginTop: 4, background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                          {record.remarks}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ),
        }))}
      />
    );
  };

  const renderAttachments = () => {
    if (!caseData || caseData.attachments.length === 0) {
      return <Text type="secondary">暂无附件</Text>;
    }

    const columns = [
      {
        title: '文件名称',
        dataIndex: 'file_name',
        key: 'file_name',
        render: (text: string) => (
          <Space>
            <PaperClipOutlined />
            {text}
          </Space>
        ),
      },
      {
        title: '类型',
        dataIndex: 'category',
        key: 'category',
        render: (cat: string) => {
          const map: Record<string, string> = {
            registration: '登记材料',
            evidence: '证据材料',
            followup: '回访材料',
          };
          return map[cat] || cat;
        },
      },
      {
        title: '大小',
        dataIndex: 'file_size',
        key: 'file_size',
        render: (size: number) => {
          if (size < 1024) return `${size} B`;
          if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
          return `${(size / (1024 * 1024)).toFixed(1)} MB`;
        },
      },
      {
        title: '上传人',
        dataIndex: 'uploaded_by_name',
        key: 'uploaded_by_name',
      },
      {
        title: '上传时间',
        dataIndex: 'uploaded_at',
        key: 'uploaded_at',
        render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
      },
    ];

    return (
      <Table
        dataSource={caseData.attachments}
        columns={columns}
        rowKey="id"
        pagination={false}
        size="small"
      />
    );
  };

  const renderAuditNotes = () => {
    if (!caseData) return null;

    const notes = [...caseData.audit_notes].sort(
      (a, b) => dayjs(b.noted_at).valueOf() - dayjs(a.noted_at).valueOf()
    );

    if (notes.length === 0) {
      return <Text type="secondary">暂无审计备注</Text>;
    }

    return (
      <List
        dataSource={notes}
        renderItem={(note) => (
          <List.Item key={note.id}>
            <List.Item.Meta
              avatar={<UserOutlined />}
              title={
                <Space>
                  <Text strong>{note.noted_by_name}</Text>
                  {note.anomaly_reason && (
                    <Tag color="red" icon={<ExclamationCircleOutlined />}>
                      异常原因
                    </Tag>
                  )}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(note.noted_at).format('YYYY-MM-DD HH:mm:ss')}
                  </Text>
                </Space>
              }
              description={
                <div>
                  <div>{note.note}</div>
                  {note.anomaly_reason && (
                    <Alert
                      message={note.anomaly_reason}
                      type="error"
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}
                </div>
              }
            />
          </List.Item>
        )}
      />
    );
  };

  if (!caseData) {
    return <Card loading={loading} />;
  }

  const isOverdue = caseData.expiry_status === 'overdue';
  const isNearing = caseData.expiry_status === 'nearing_expiry';
  const allowedActions = getAllowedActions();

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/cases')}>
            返回列表
          </Button>
          <Space>
            {user?.role !== 'dispatcher' && caseData.status !== 'completed' && (
              <Button icon={<EditOutlined />} onClick={() => setNoteModalVisible(true)}>
                添加备注
              </Button>
            )}
            {allowedActions.map((action) => (
              <Tooltip key={action.key} title={action.disabledReason}>
                <Button
                  type={action.type}
                  danger={action.danger}
                  disabled={action.disabled}
                  onClick={() => handleActionClick(action.key)}
                >
                  {action.key === 'pending_correction' && <RollbackOutlined />}
                  {action.key === 'completed' && <CheckOutlined />}
                  {action.key === 'under_review' && <AuditOutlined />}
                  {action.label}
                </Button>
              </Tooltip>
            ))}
            <Button icon={<ReloadOutlined />} onClick={fetchData}>
              刷新
            </Button>
          </Space>
        </div>

        {isOverdue && (
          <Alert
            message="该案件已逾期"
            description={`该案件应于 ${dayjs(caseData.deadline).format(
              'YYYY-MM-DD'
            )} 前办结，现已逾期 ${Math.abs(
              dayjs(caseData.deadline).diff(dayjs(), 'day')
            )} 天，请尽快处理并说明原因。`}
            type="error"
            showIcon
            action={
              <Button size="small" danger onClick={() => setNoteModalVisible(true)}>
                添加逾期说明
              </Button>
            }
          />
        )}

        {isNearing && !isOverdue && (
          <Alert
            message="该案件即将到期"
            description={`该案件将于 ${dayjs(caseData.deadline).format(
              'YYYY-MM-DD'
            )} 到期，距今天还有 ${dayjs(caseData.deadline).diff(dayjs(), 'day')} 天，请抓紧处理。`}
            type="warning"
            showIcon
          />
        )}

        <Card title="案件基本信息">
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="案件编号">
              <Text strong copyable>
                {caseData.case_number}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="案件类型">{caseData.case_type}</Descriptions.Item>
            <Descriptions.Item label="标题" span={2}>
              {caseData.title}
            </Descriptions.Item>
            <Descriptions.Item label="案情描述" span={2}>
              {caseData.description}
            </Descriptions.Item>
            <Descriptions.Item label="发生地点">{caseData.location}</Descriptions.Item>
            <Descriptions.Item label="报案人">
              {caseData.reporter_name} ({caseData.reporter_phone})
            </Descriptions.Item>
            <Descriptions.Item label="当前状态">
              <Tag color={STATUS_COLOR[caseData.status]}>
                {STATUS_DISPLAY[caseData.status]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="当前阶段">
              {STAGE_DISPLAY[caseData.current_stage]}
            </Descriptions.Item>
            <Descriptions.Item label="到期状态">
              <Tag color={EXPIRY_COLOR[caseData.expiry_status]}>
                {EXPIRY_DISPLAY[caseData.expiry_status]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="截止日期">
              <span className={isOverdue ? 'evidence-no' : ''}>
                {dayjs(caseData.deadline).format('YYYY-MM-DD HH:mm')}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="当前处理人">
              {caseData.current_handler_name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="登记人">
              {caseData.created_by_name}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(caseData.created_at).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="版本号">
              <Tag color="blue">v{caseData.version}</Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="证据完整性校验">{renderEvidenceStatus()}</Card>

        <Card title="处理流程（按时间顺序）">{renderProcessingTimeline()}</Card>

        <Card title="案件材料" extra={
  caseData.status !== 'completed' && (
    (user?.role === 'dispatcher' && (caseData.current_stage === 'registration' || caseData.created_by === user?.id)) ||
    (user?.role === 'police_officer' && caseData.current_handler_id === user?.id) ||
    (user?.role === 'reviewer')
  ) && (
    <Button size="small" icon={<PlusOutlined />} onClick={() => { attachForm.resetFields(); setAttachModalVisible(true); }}>
      添加附件
    </Button>
  )
}>
          <Tabs defaultActiveKey="attachments">
            <TabPane tab={`附件 (${caseData.attachments.length})`} key="attachments">
              {renderAttachments()}
            </TabPane>
            <TabPane tab={`审计备注 (${caseData.audit_notes.length})`} key="notes">
              {renderAuditNotes()}
            </TabPane>
          </Tabs>
        </Card>
      </Space>

      <Modal
        title={
          <Space>
            {currentAction === 'pending_correction' && <RollbackOutlined />}
            {currentAction === 'completed' && <CheckOutlined />}
            {currentAction === 'under_review' && <AuditOutlined />}
            {currentAction === 'pending_correction' && '退回补正'}
            {currentAction === 'completed' && '办结归档'}
            {currentAction === 'under_review' && caseData.status === 'pending_correction' && '提交审核'}
            {currentAction === 'under_review' && caseData.status === 'under_review' && '移交复核'}
          </Space>
        }
        open={actionModalVisible}
        onCancel={() => {
          setActionModalVisible(false);
          setCurrentAction(null);
        }}
        footer={null}
        width={600}
      >
        <Form form={actionForm} layout="vertical" onFinish={handleActionSubmit}>
          {caseData && user?.role === 'dispatcher' && caseData.status === 'pending_correction' && (
            <Form.Item
              name="registration_materials_complete"
              label="警情登记材料已齐全"
              valuePropName="checked"
            >
              <Checkbox>我确认警情登记材料（报案笔录、受案回执等）已齐全</Checkbox>
            </Form.Item>
          )}

          {caseData && user?.role === 'police_officer' && (
            <>
              <Form.Item
                name="dispatch_timeline_met"
                label="处置派警时限已达标"
                valuePropName="checked"
              >
                <Checkbox>我确认已在规定时限内派警处置</Checkbox>
              </Form.Item>
              <Form.Item
                name="followup_evidence_complete"
                label="回访确认证据已完整"
                valuePropName="checked"
              >
                <Checkbox>我确认回访录音、当事人确认记录等证据已完整</Checkbox>
              </Form.Item>
            </>
          )}

          {caseData && user?.role === 'reviewer' && (
            <>
              <Alert
                message="复核校验"
                description={
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <div>
                      警情登记材料：
                      {caseData.registration_materials_complete ? (
                        <span className="evidence-ok">✓ 齐全</span>
                      ) : (
                        <span className="evidence-no">✗ 不齐全</span>
                      )}
                    </div>
                    <div>
                      处置派警时限：
                      {caseData.dispatch_timeline_met ? (
                        <span className="evidence-ok">✓ 达标</span>
                      ) : (
                        <span className="evidence-no">✗ 超时</span>
                      )}
                    </div>
                    <div>
                      回访确认证据：
                      {caseData.followup_evidence_complete ? (
                        <span className="evidence-ok">✓ 完整</span>
                      ) : (
                        <span className="evidence-no">✗ 不完整</span>
                      )}
                    </div>
                  </Space>
                }
                type={
                  caseData.registration_materials_complete &&
                  caseData.dispatch_timeline_met &&
                  caseData.followup_evidence_complete
                    ? 'success'
                    : 'warning'
                }
                showIcon
                style={{ marginBottom: 16 }}
              />
              {currentAction === 'completed' && (
                <Form.Item
                  name="registration_materials_complete"
                  label="确认登记材料"
                  valuePropName="checked"
                >
                  <Checkbox>我已核实警情登记材料齐全</Checkbox>
                </Form.Item>
              )}
            </>
          )}

          <Form.Item
            label="处理备注"
            name="remarks"
            rules={[{ required: true, message: '请填写处理备注' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder={
                currentAction === 'pending_correction'
                  ? '请说明需要补正的具体内容...'
                  : currentAction === 'completed'
                  ? '请填写复核意见...'
                  : '请填写处理说明...'
              }
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setActionModalVisible(false);
                  setCurrentAction(null);
                }}
              >
                取消
              </Button>
              <Popconfirm
                title="确认操作"
                description={
                  currentAction === 'pending_correction'
                    ? '确定要将此案件退回补正吗？'
                    : currentAction === 'completed'
                    ? '确定要办结此案件吗？办结后无法修改。'
                    : '确定要提交此操作吗？'
                }
                onConfirm={actionForm.submit}
              >
                <Button type="primary" loading={actionLoading}>
                  确认
                </Button>
              </Popconfirm>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加审计备注"
        open={noteModalVisible}
        onCancel={() => {
          setNoteModalVisible(false);
          noteForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form form={noteForm} layout="vertical" onFinish={handleAddNote}>
          <Form.Item
            label="备注内容"
            name="note"
            rules={[{ required: true, message: '请填写备注内容' }]}
          >
            <Input.TextArea rows={4} placeholder="请输入备注内容..." />
          </Form.Item>
          <Form.Item label="异常原因（可选）" name="anomaly_reason">
            <Input.TextArea rows={3} placeholder="如果存在异常情况，请在此说明原因..." />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setNoteModalVisible(false);
                  noteForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加附件"
        open={attachModalVisible}
        onCancel={() => {
          setAttachModalVisible(false);
          attachForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form form={attachForm} layout="vertical" onFinish={handleAddAttachment}>
          <Form.Item
            label="文件名称"
            name="file_name"
            rules={[{ required: true, message: '请输入文件名称' }]}
          >
            <Input placeholder="例如：报案笔录.pdf" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="文件类型"
                name="file_type"
                initialValue="application/pdf"
              >
                <Select placeholder="选择类型">
                  <Option value="application/pdf">PDF文档</Option>
                  <Option value="image/jpeg">JPEG图片</Option>
                  <Option value="image/png">PNG图片</Option>
                  <Option value="audio/mpeg">MP3音频</Option>
                  <Option value="video/mp4">MP4视频</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="附件类别"
                name="category"
                rules={[{ required: true, message: '请选择附件类别' }]}
              >
                <Select placeholder="选择类别">
                  <Option value="registration" disabled={user?.role === 'police_officer'}>登记材料</Option>
                  <Option value="evidence" disabled={user?.role === 'dispatcher'}>证据材料</Option>
                  <Option value="followup" disabled={user?.role === 'dispatcher'}>回访材料</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="文件大小（字节）"
            name="file_size"
            initialValue={102400}
          >
            <Input type="number" placeholder="文件大小" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setAttachModalVisible(false); attachForm.resetFields(); }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={attachLoading}>
                添加
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CaseDetail;
