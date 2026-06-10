import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Tag, Steps, Button, Space, Modal, Input, Upload, message, Divider, Alert, Badge } from 'antd';
import { ArrowLeftOutlined, UploadOutlined, CheckCircleTwoTone, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getApplication, processApplication, getAuditTrail, uploadAttachment } from '../api/application';
import {
  STATUS_LABELS, STATUS_COLORS, EXPIRY_LABELS, EXPIRY_COLORS,
  SUB_MODULE_LABELS, ROLE_LABELS, ACTION_LABELS, getUserInfo,
} from '../constants';
import type { Application, AuditLog, Role, SubModuleStatus } from '../types';
import AuditTrail from './AuditTrail';

interface ApplicationDetailProps {
  id: string;
  onBack: () => void;
  onRefresh?: () => void;
}

const SUB_MODULE_KEYS = [
  { key: 'tenant_signing_status' as const, label: '租客签约' },
  { key: 'room_confirmation_status' as const, label: '房态确认' },
  { key: 'move_in_handover_status' as const, label: '入住交接' },
];

const ApplicationDetail: React.FC<ApplicationDetailProps> = ({ id, onBack, onRefresh }) => {
  const [detail, setDetail] = useState<Application | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [correctOpen, setCorrectOpen] = useState(false);
  const [correctRemark, setCorrectRemark] = useState('');
  const [verifyFailOpen, setVerifyFailOpen] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);

  const userInfo = getUserInfo();
  const currentRole = userInfo.role as Role;
  const currentUserId = userInfo.userId;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [app, logs] = await Promise.all([
        getApplication(id),
        getAuditTrail(id),
      ]);
      setDetail(app);
      setAuditLogs(logs);
    } catch {
      message.error('获取详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const afterAction = () => {
    fetchData();
    onRefresh?.();
  };

  const handleProcess = async (action: string, data?: Record<string, string>) => {
    if (!detail) return;
    setConfirmLoading(true);
    try {
      await processApplication(id, { action, version: detail.version, ...data });
      message.success('操作成功');
      afterAction();
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCorrect = () => {
    if (!correctRemark.trim()) {
      message.warning('请填写补正说明');
      return;
    }
    handleProcess('correct', { remark: correctRemark });
    setCorrectOpen(false);
    setCorrectRemark('');
  };

  const handleVerifyFail = () => {
    if (!exceptionReason.trim()) {
      message.warning('请填写异常原因');
      return;
    }
    handleProcess('verify_fail', { exception_reason: exceptionReason });
    setVerifyFailOpen(false);
    setExceptionReason('');
  };

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      await uploadAttachment(id, formData);
      message.success('上传成功');
      fetchData();
    } catch {
    }
    return false;
  };

  if (!detail) {
    return <Card loading={loading}>加载中...</Card>;
  }

  const getStepStatus = (status: SubModuleStatus): 'wait' | 'process' | 'finish' | 'error' => {
    switch (status) {
      case 'complete': return 'finish';
      case 'failed': return 'error';
      case 'pending': return 'wait';
      default: return 'wait';
    }
  };

  const isHandlerMatch = () => {
    if (!detail.current_handler_id) return true;
    return detail.current_handler_id === currentUserId;
  };

  const isRoleMatch = () => {
    if (detail.status === 'pending_verification') {
      return currentRole === 'maintenance_coordinator';
    }
    if (detail.status === 'verification_failed') {
      return currentRole === 'lease_clerk';
    }
    if (detail.status === 'verification_complete') {
      return currentRole === 'store_manager';
    }
    return false;
  };

  const canAct = isRoleMatch() && isHandlerMatch() && !detail.confirmed;
  const attachmentCount = detail.attachments?.length || 0;
  const needAttachment = detail.status === 'pending_verification' && currentRole === 'maintenance_coordinator';
  const hasAttachment = attachmentCount > 0;

  const showCorrect = currentRole === 'lease_clerk' && detail.status === 'verification_failed';
  const showVerify = currentRole === 'maintenance_coordinator' && detail.status === 'pending_verification';
  const showConfirm = currentRole === 'store_manager' && detail.status === 'verification_complete' && !detail.confirmed;

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={onBack} style={{ marginBottom: 16 }}>
        返回列表
      </Button>

      <Card
        title={
          <Space>
            <span>租约申请详情</span>
            {detail.confirmed && (
              <Badge status="success" text={<span style={{ color: '#52c41a' }}><CheckCircleTwoTone twoToneColor="#52c41a" /> 门店经理已确认</span>} />
            )}
          </Space>
        }
        style={{ marginBottom: 16 }}
        extra={<Tag color="blue">v{detail.version}</Tag>}
      >
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="small">
          <Descriptions.Item label="申请编号">{detail.application_no}</Descriptions.Item>
          <Descriptions.Item label="租客姓名">{detail.tenant_name}</Descriptions.Item>
          <Descriptions.Item label="租客电话">{detail.tenant_phone}</Descriptions.Item>
          <Descriptions.Item label="房间号">{detail.room_number}</Descriptions.Item>
          <Descriptions.Item label="楼栋名称">{detail.building_name}</Descriptions.Item>
          <Descriptions.Item label="月租金">¥{detail.monthly_rent}</Descriptions.Item>
          <Descriptions.Item label="押金">¥{detail.deposit}</Descriptions.Item>
          <Descriptions.Item label="签约开始日期">{detail.lease_start_date}</Descriptions.Item>
          <Descriptions.Item label="签约结束日期">{detail.lease_end_date}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={STATUS_COLORS[detail.status]}>{STATUS_LABELS[detail.status]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="到期状态">
            <Tag color={EXPIRY_COLORS[detail.expiry_status]}>{EXPIRY_LABELS[detail.expiry_status]}</Tag>
            {detail.overdue_days > 0 && <span style={{ color: 'red', marginLeft: 8 }}>逾期{detail.overdue_days}天</span>}
          </Descriptions.Item>
          <Descriptions.Item label="当前处理人">
            {detail.current_handler_name
              ? `${detail.current_handler_name}（${ROLE_LABELS[detail.current_handler_role]}）`
              : detail.current_handler_role
                ? `待${ROLE_LABELS[detail.current_handler_role]}处理`
                : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">{dayjs(detail.created_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{dayjs(detail.updated_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
        </Descriptions>

        {detail.exception_reason && (
          <Alert
            style={{ marginTop: 16 }}
            message="异常原因"
            description={detail.exception_reason}
            type="error"
            showIcon
          />
        )}

        {needAttachment && !hasAttachment && (
          <Alert
            style={{ marginTop: 12 }}
            message="核验证据不足"
            description="请先上传至少一份附件后再进行核验通过操作"
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
          />
        )}

        {!isRoleMatch() && detail.status !== 'verification_complete' && (
          <Alert
            style={{ marginTop: 12 }}
            message="非当前角色处理"
            description={`当前申请应由${ROLE_LABELS[detail.current_handler_role]}处理，您只能查看`}
            type="info"
            showIcon
          />
        )}

        {isRoleMatch() && !isHandlerMatch() && (
          <Alert
            style={{ marginTop: 12 }}
            message="非指定处理人"
            description={`当前申请由 ${detail.current_handler_name} 负责处理，您无权操作`}
            type="warning"
            showIcon
          />
        )}

        {detail.confirmed && (
          <Alert
            style={{ marginTop: 12 }}
            message="该申请已由门店经理确认"
            description="确认后的租约申请不可再次确认"
            type="success"
            showIcon
          />
        )}
      </Card>

      <Card title="业务模块进度" style={{ marginBottom: 16 }}>
        <Steps
          current={SUB_MODULE_KEYS.findIndex((m) => detail[m.key] === 'pending') || SUB_MODULE_KEYS.length}
          items={SUB_MODULE_KEYS.map((m) => ({
            title: m.label,
            status: getStepStatus(detail[m.key]),
            description: SUB_MODULE_LABELS[detail[m.key]] || detail[m.key],
          }))}
        />
      </Card>

      {canAct && (
        <Card title="办理操作" style={{ marginBottom: 16 }}>
          <Space wrap>
            {showCorrect && (
              <Button type="primary" loading={confirmLoading} onClick={() => setCorrectOpen(true)}>
                {ACTION_LABELS.correct}
              </Button>
            )}
            {showVerify && (
              <>
                <Button
                  type="primary"
                  loading={confirmLoading}
                  disabled={!hasAttachment}
                  onClick={() => handleProcess('verify_pass')}
                >
                  {ACTION_LABELS.verify_pass}
                </Button>
                <Button danger loading={confirmLoading} onClick={() => setVerifyFailOpen(true)}>
                  {ACTION_LABELS.verify_fail}
                </Button>
              </>
            )}
            {showConfirm && (
              <Button type="primary" loading={confirmLoading} onClick={() => handleProcess('confirm')}>
                {ACTION_LABELS.confirm}
              </Button>
            )}
          </Space>
          {showVerify && !hasAttachment && (
            <div style={{ color: '#faad14', marginTop: 8, fontSize: 12 }}>
              <ExclamationCircleOutlined /> 核验通过前请先上传证据附件
            </div>
          )}
        </Card>
      )}

      <Card title={`附件凭证（${attachmentCount}份）`} style={{ marginBottom: 16 }}>
        {detail.attachments && detail.attachments.length > 0 ? (
          <div>
            {detail.attachments.map((att) => (
              <div key={att.id} style={{ marginBottom: 8, padding: '8px 12px', background: '#fafafa', borderRadius: 4 }}>
                <span style={{ fontWeight: 500 }}>{att.file_name}</span>
                <span style={{ color: '#999', marginLeft: 12, fontSize: 12 }}>
                  {att.uploaded_by} · {ROLE_LABELS[att.upload_role as Role] || att.upload_role} · {dayjs(att.created_at).format('YYYY-MM-DD HH:mm')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#999' }}>暂无附件凭证</div>
        )}
        <Divider />
        <Upload beforeUpload={handleUpload} showUploadList={false}>
          <Button icon={<UploadOutlined />}>上传凭证</Button>
        </Upload>
      </Card>

      <Card title="审计轨迹">
        <AuditTrail records={auditLogs} />
      </Card>

      <Modal
        title="补正操作"
        open={correctOpen}
        onOk={handleCorrect}
        confirmLoading={confirmLoading}
        onCancel={() => { setCorrectOpen(false); setCorrectRemark(''); }}
        okText="提交补正"
      >
        <div style={{ marginBottom: 8, color: '#666' }}>当前版本：v{detail.version}</div>
        <Input.TextArea
          rows={4}
          placeholder="请填写补正说明"
          value={correctRemark}
          onChange={(e) => setCorrectRemark(e.target.value)}
        />
      </Modal>

      <Modal
        title="核验失败"
        open={verifyFailOpen}
        onOk={handleVerifyFail}
        confirmLoading={confirmLoading}
        onCancel={() => { setVerifyFailOpen(false); setExceptionReason(''); }}
        okText="提交失败"
        okButtonProps={{ danger: true }}
      >
        <div style={{ marginBottom: 8, color: '#666' }}>当前版本：v{detail.version}</div>
        <Input.TextArea
          rows={4}
          placeholder="请填写异常原因（必填）"
          value={exceptionReason}
          onChange={(e) => setExceptionReason(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default ApplicationDetail;
