import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Tag, Steps, Button, Space, Modal, Input, Upload, message, Divider } from 'antd';
import { ArrowLeftOutlined, UploadOutlined } from '@ant-design/icons';
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
}

const SUB_MODULE_KEYS = [
  { key: 'tenant_signing_status' as const, label: '租客签约' },
  { key: 'room_confirmation_status' as const, label: '房态确认' },
  { key: 'move_in_handover_status' as const, label: '入住交接' },
];

const ApplicationDetail: React.FC<ApplicationDetailProps> = ({ id, onBack }) => {
  const [detail, setDetail] = useState<Application | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [correctOpen, setCorrectOpen] = useState(false);
  const [correctRemark, setCorrectRemark] = useState('');
  const [verifyFailOpen, setVerifyFailOpen] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');

  const userInfo = getUserInfo();
  const currentRole = userInfo.role as Role;

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

  const handleProcess = async (action: string, data?: Record<string, string>) => {
    try {
      await processApplication(id, { action, ...data });
      message.success('操作成功');
      fetchData();
    } catch {
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

  const showCorrect = currentRole === 'lease_clerk' && detail.status === 'verification_failed';
  const showVerify = currentRole === 'maintenance_coordinator' && detail.status === 'pending_verification';
  const showConfirm = currentRole === 'store_manager' && detail.status === 'verification_complete';

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={onBack} style={{ marginBottom: 16 }}>
        返回列表
      </Button>

      <Card title="基本信息" style={{ marginBottom: 16 }}>
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
            {detail.current_handler_name}（{ROLE_LABELS[detail.current_handler_role]}）
          </Descriptions.Item>
          <Descriptions.Item label="版本号">{detail.version}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{dayjs(detail.created_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{dayjs(detail.updated_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
        </Descriptions>
        {detail.exception_reason && (
          <div style={{ marginTop: 12, color: 'red' }}>异常原因：{detail.exception_reason}</div>
        )}
      </Card>

      <Card title="子模块进度" style={{ marginBottom: 16 }}>
        <Steps
          current={SUB_MODULE_KEYS.findIndex((m) => detail[m.key] === 'pending') || SUB_MODULE_KEYS.length}
          items={SUB_MODULE_KEYS.map((m) => ({
            title: m.label,
            status: getStepStatus(detail[m.key]),
            description: SUB_MODULE_LABELS[detail[m.key]] || detail[m.key],
          }))}
        />
      </Card>

      {(showCorrect || showVerify || showConfirm) && (
        <Card title="操作" style={{ marginBottom: 16 }}>
          <Space>
            {showCorrect && (
              <Button type="primary" onClick={() => setCorrectOpen(true)}>
                {ACTION_LABELS.correct}
              </Button>
            )}
            {showVerify && (
              <>
                <Button type="primary" onClick={() => handleProcess('verify_pass')}>
                  {ACTION_LABELS.verify_pass}
                </Button>
                <Button danger onClick={() => setVerifyFailOpen(true)}>
                  {ACTION_LABELS.verify_fail}
                </Button>
              </>
            )}
            {showConfirm && (
              <Button type="primary" onClick={() => handleProcess('confirm')}>
                {ACTION_LABELS.confirm}
              </Button>
            )}
          </Space>
        </Card>
      )}

      <Card title="附件" style={{ marginBottom: 16 }}>
        {detail.attachments && detail.attachments.length > 0 ? (
          <div>
            {detail.attachments.map((att) => (
              <div key={att.id} style={{ marginBottom: 8 }}>
                <span>{att.file_name}</span>
                <span style={{ color: '#999', marginLeft: 8 }}>
                  {att.uploaded_by} · {dayjs(att.created_at).format('YYYY-MM-DD HH:mm')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#999' }}>暂无附件</div>
        )}
        <Divider />
        <Upload beforeUpload={handleUpload} showUploadList={false}>
          <Button icon={<UploadOutlined />}>上传附件</Button>
        </Upload>
      </Card>

      <Card title="审计轨迹">
        <AuditTrail records={auditLogs} />
      </Card>

      <Modal
        title="补正操作"
        open={correctOpen}
        onOk={handleCorrect}
        onCancel={() => { setCorrectOpen(false); setCorrectRemark(''); }}
      >
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
        onCancel={() => { setVerifyFailOpen(false); setExceptionReason(''); }}
      >
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
