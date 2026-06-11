import React, { useEffect, useState } from 'react';
import { Button, Space, Spin, Tag, Descriptions, Tabs, message, Modal, Form, Input } from 'antd';
import { ArrowLeftOutlined, EditOutlined, AuditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import request from '../utils/request';
import { getStatusName, getPriorityName, getQueueName } from '../utils/auth';
import type { CaseDetail, ProcessingRecord, Attachment, AuditNote, ExceptionReason } from '../../types';

const { TextArea } = Input;

interface CaseDetailProps {
  caseId: number;
}

const getStatusClass = (status: string): string => {
  const classMap: Record<string, string> = {
    draft: 'status-draft',
    pending_submit: 'status-pending',
    submitted: 'status-processing',
    returned: 'status-returned',
    resubmitted: 'status-processing',
    reviewing: 'status-processing',
    assigned: 'status-processing',
    followup: 'status-processing',
    completed: 'status-completed',
    archived: 'status-completed',
  };
  return classMap[status] || 'status-draft';
};

const getPriorityClass = (priority: string): string => {
  return `priority-${priority}`;
};

const CaseDetailComponent: React.FC<CaseDetailProps> = ({ caseId }) => {
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [records, setRecords] = useState<ProcessingRecord[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [auditNotes, setAuditNotes] = useState<AuditNote[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionReason[]>([]);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchCaseDetail();
    fetchRecords();
    fetchAttachments();
    fetchAuditNotes();
    fetchExceptions();
  }, [caseId]);

  const fetchCaseDetail = async () => {
    try {
      const data = await request.get<CaseDetail>(`/cases/${caseId}`);
      setCaseData(data);
    } catch {
      message.error('获取案件详情失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async () => {
    try {
      const data = await request.get<ProcessingRecord[]>(`/cases/${caseId}/records`);
      setRecords(data);
    } catch {
      console.error('获取处理记录失败');
    }
  };

  const fetchAttachments = async () => {
    try {
      const data = await request.get<Attachment[]>(`/cases/${caseId}/attachments`);
      setAttachments(data);
    } catch {
      console.error('获取附件失败');
    }
  };

  const fetchAuditNotes = async () => {
    try {
      const data = await request.get<AuditNote[]>(`/cases/${caseId}/audit-notes`);
      setAuditNotes(data);
    } catch {
      console.error('获取审核备注失败');
    }
  };

  const fetchExceptions = async () => {
    try {
      const data = await request.get<ExceptionReason[]>(`/cases/${caseId}/exceptions`);
      setExceptions(data);
    } catch {
      console.error('获取异常原因失败');
    }
  };

  const handleAction = (action: string) => {
    setCurrentAction(action);
    setActionModalVisible(true);
    form.resetFields();
  };

  const handleActionSubmit = async () => {
    try {
      const values = await form.validateFields();
      setActionLoading(true);

      await request.post(`/cases/${caseId}/action`, {
        caseId,
        action: currentAction,
        remark: values.remark,
        version: caseData?.version,
      });

      message.success('操作成功');
      setActionModalVisible(false);
      fetchCaseDetail();
      fetchRecords();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin />
      </div>
    );
  }

  if (!caseData) {
    return <div>案件不存在</div>;
  }

  const availableActions: Record<string, string[]> = {
    draft: ['submit'],
    pending_submit: ['submit'],
    submitted: ['return', 'approve'],
    returned: ['resubmit'],
    resubmitted: ['return', 'approve'],
    reviewing: ['return', 'assign'],
    assigned: ['start_followup'],
    followup: ['complete'],
    completed: ['archive'],
  };

  const actionLabels: Record<string, string> = {
    submit: '提交',
    resubmit: '重新提交',
    return: '退回',
    approve: '通过审核',
    assign: '分配案件',
    start_followup: '开始跟进',
    complete: '完成跟进',
    archive: '归档',
  };

  const actions = availableActions[caseData.status] || [];

  const tabItems = [
    {
      key: 'basic',
      label: '基本信息',
      children: (
        <>
          {caseData.registration && (
            <div className="detail-section">
              <h3>立案信息</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="label">当事人姓名：</span>
                  <span className="value">{caseData.registration.clientName || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">联系电话：</span>
                  <span className="value">{caseData.registration.clientPhone || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">身份证号：</span>
                  <span className="value">{caseData.registration.clientIdCard || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">咨询类型：</span>
                  <span className="value">{caseData.registration.consultationType || '-'}</span>
                </div>
                <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="label">咨询内容：</span>
                  <span className="value">{caseData.registration.consultationContent || '-'}</span>
                </div>
                <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="label">证据材料：</span>
                  <span className="value">{caseData.registration.evidenceProvided || '-'}</span>
                </div>
                <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="label">立案备注：</span>
                  <span className="value">{caseData.registration.registrationRemark || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">立案人：</span>
                  <span className="value">{caseData.registration.registeredAt ? caseData.createdByName : '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">立案时间：</span>
                  <span className="value">{caseData.registration.registeredAt ? dayjs(caseData.registration.registeredAt).format('YYYY-MM-DD HH:mm') : '-'}</span>
                </div>
              </div>
            </div>
          )}

          {caseData.assignment && (
            <div className="detail-section">
              <h3>分案信息</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="label">律师助理：</span>
                  <span className="value">{caseData.assignment.assistantName || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">主办律师：</span>
                  <span className="value">{caseData.assignment.lawyerName || '-'}</span>
                </div>
                <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="label">分案理由：</span>
                  <span className="value">{caseData.assignment.assignmentReason || '-'}</span>
                </div>
                <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="label">分案备注：</span>
                  <span className="value">{caseData.assignment.assignmentRemark || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">分案人：</span>
                  <span className="value">{caseData.assignment.assignedAt ? caseData.createdByName : '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">分案时间：</span>
                  <span className="value">{caseData.assignment.assignedAt ? dayjs(caseData.assignment.assignedAt).format('YYYY-MM-DD HH:mm') : '-'}</span>
                </div>
              </div>
            </div>
          )}

          {caseData.followup && (
            <div className="detail-section">
              <h3>跟进信息</h3>
              <div className="detail-grid">
                <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="label">跟进结果：</span>
                  <span className="value">{caseData.followup.followupResult || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">客户满意度：</span>
                  <span className="value">{caseData.followup.clientSatisfaction || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">跟进人：</span>
                  <span className="value">{caseData.followup.followupAt ? caseData.createdByName : '-'}</span>
                </div>
                <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="label">跟进备注：</span>
                  <span className="value">{caseData.followup.followupRemark || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">跟进时间：</span>
                  <span className="value">{caseData.followup.followupAt ? dayjs(caseData.followup.followupAt).format('YYYY-MM-DD HH:mm') : '-'}</span>
                </div>
              </div>
            </div>
          )}
        </>
      ),
    },
    {
      key: 'records',
      label: '处理记录',
      children: (
        <div className="detail-section">
          <h3>处理记录</h3>
          <div className="timeline">
            {records.map((record) => (
              <div key={record.id} className="timeline-item">
                <div className="time">{dayjs(record.createdAt).format('YYYY-MM-DD HH:mm')}</div>
                <div className="action">{record.action}</div>
                <div className="operator">操作人：{record.operatorName || '-'}</div>
                {record.remark && <div className="remark">{record.remark}</div>}
              </div>
            ))}
            {records.length === 0 && <div style={{ color: '#999' }}>暂无处理记录</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'attachments',
      label: '附件',
      children: (
        <div className="detail-section">
          <h3>附件列表</h3>
          {attachments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {attachments.map((att) => (
                <div key={att.id} style={{ padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                  <div style={{ fontWeight: 500 }}>{att.fileName}</div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                    {att.fileType} · {att.fileSize ? `${(att.fileSize / 1024).toFixed(2)} KB` : '-'} · 上传于 {dayjs(att.createdAt).format('YYYY-MM-DD HH:mm')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#999' }}>暂无附件</div>
          )}
        </div>
      ),
    },
    {
      key: 'audit',
      label: '审核备注',
      children: (
        <div className="detail-section">
          <h3>审核备注</h3>
          {auditNotes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {auditNotes.map((note) => (
                <div key={note.id} style={{ padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 500 }}>{note.auditType}</span>
                    <span style={{ fontSize: 12, color: '#999' }}>
                      {note.operatorName || '-'} · {dayjs(note.createdAt).format('YYYY-MM-DD HH:mm')}
                    </span>
                  </div>
                  <div>{note.content}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#999' }}>暂无审核备注</div>
          )}
        </div>
      ),
    },
    {
      key: 'exceptions',
      label: '异常原因',
      children: (
        <div className="detail-section">
          <h3>异常原因</h3>
          {exceptions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {exceptions.map((exc) => (
                <div key={exc.id} style={{ padding: 12, background: '#fff1f0', borderRadius: 4, border: '1px solid #ffccc7' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 500, color: '#ff4d4f' }}>{exc.exceptionType}</span>
                    <span style={{ fontSize: 12, color: '#999' }}>
                      {exc.operatorName || '-'} · {dayjs(exc.createdAt).format('YYYY-MM-DD HH:mm')}
                    </span>
                  </div>
                  <div>{exc.reason}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#999' }}>暂无异常记录</div>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <Button
            icon={<ArrowLeftOutlined />}
            href="/cases"
            style={{ marginRight: 16 }}
          >
            返回列表
          </Button>
          <span className="page-title">{caseData.caseNo} - {caseData.title}</span>
        </div>
        <Space>
          {actions.map((action) => (
            <Button
              key={action}
              type={action === 'submit' || action === 'approve' || action === 'complete' ? 'primary' : 'default'}
              onClick={() => handleAction(action)}
            >
              {actionLabels[action]}
            </Button>
          ))}
          <Button icon={<EditOutlined />} href={`/cases/${caseId}/edit`}>
            编辑
          </Button>
        </Space>
      </div>

      <div className="detail-section">
        <Descriptions column={2} bordered size="middle">
          <Descriptions.Item label="案件编号">{caseData.caseNo}</Descriptions.Item>
          <Descriptions.Item label="案件标题">{caseData.title}</Descriptions.Item>
          <Descriptions.Item label="优先级">
            <Tag className={getPriorityClass(caseData.priority)}>{getPriorityName(caseData.priority)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag className={getStatusClass(caseData.status)}>{getStatusName(caseData.status)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="当前队列">{getQueueName(caseData.queue)}</Descriptions.Item>
          <Descriptions.Item label="当前处理人">{caseData.currentHandlerName || '-'}</Descriptions.Item>
          <Descriptions.Item label="截止日期">
            {caseData.deadline ? dayjs(caseData.deadline).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="版本号">v{caseData.version}</Descriptions.Item>
          <Descriptions.Item label="创建人">{caseData.createdByName || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{dayjs(caseData.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
        </Descriptions>
      </div>

      <Tabs items={tabItems} defaultActiveKey="basic" />

      <Modal
        title={actionLabels[currentAction] || '操作'}
        open={actionModalVisible}
        onOk={handleActionSubmit}
        onCancel={() => setActionModalVisible(false)}
        confirmLoading={actionLoading}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="remark"
            label="备注"
            rules={[{ required: currentAction === 'return', message: '请填写退回原因' }]}
          >
            <TextArea rows={4} placeholder={currentAction === 'return' ? '请填写退回原因' : '请输入备注（可选）'} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default CaseDetailComponent;
