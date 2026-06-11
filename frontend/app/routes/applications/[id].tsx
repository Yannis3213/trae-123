import { Component, createSignal, Show, onMount, For } from 'solid-js';
import { useParams, useNavigate, A } from '@solidjs/router';
import Layout from '~/components/Layout';
import StatusBadge from '~/components/StatusBadge';
import WarningTag from '~/components/WarningTag';
import AttachmentsList from '~/components/AttachmentsList';
import ProcessTimeline from '~/components/ProcessTimeline';
import FormModal from '~/components/FormModal';
import { getApplication, processApplication } from '~/api/applications';
import { user, fetchMe } from '~/store/auth';
import {
  getAllowedActions,
  ACTION_LABELS,
  getActionButtonClass,
  REASON_CODE_LABELS,
} from '~/utils/status';
import { getRoleLabel } from '~/utils/role';
import type { Application, ProcessAction } from '~/types';
import dayjs from 'dayjs';

type DetailSection = 'attachments' | 'records' | 'audit_notes' | 'exceptions';

const ApplicationDetail: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = createSignal<Application | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [processing, setProcessing] = createSignal(false);
  const [modalOpen, setModalOpen] = createSignal(false);
  const [currentAction, setCurrentAction] = createSignal<ProcessAction>('confirm');
  const [activeSection, setActiveSection] = createSignal<DetailSection>('attachments');
  const [error, setError] = createSignal('');
  const [processError, setProcessError] = createSignal('');

  const applicationId = () => Number(params.id);

  const loadData = async () => {
    if (!user()) {
      await fetchMe();
    }

    setLoading(true);
    setError('');
    try {
      const data = await getApplication(applicationId());
      setApplication(data);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadData();
  });

  const allowedActions = (): ProcessAction[] => {
    if (!application() || !user()) return [];
    return getAllowedActions(application()!.status, user()!.role);
  };

  const openModal = (action: ProcessAction) => {
    setCurrentAction(action);
    setProcessError('');
    setModalOpen(true);
  };

  const handleProcess = async (payload: {
    comment?: string;
    reason_code?: string;
    reason_detail?: string;
    payment_evidence?: string;
    overdue_note?: string;
  }) => {
    if (!application()) return;

    setProcessing(true);
    setProcessError('');
    try {
      const updated = await processApplication(applicationId(), {
        action: currentAction(),
        version: application()!.version,
        ...payload,
      });
      setApplication(updated);
      setModalOpen(false);
    } catch (err: any) {
      setProcessError(err.message || '处理失败');
    } finally {
      setProcessing(false);
    }
  };

  const sections: Array<{ key: DetailSection; label: string; count: () => number }> = [
    { key: 'attachments', label: '附件', count: () => application()?.attachments.length || 0 },
    { key: 'records', label: '处理记录', count: () => application()?.process_records.length || 0 },
    { key: 'audit_notes', label: '审计备注', count: () => application()?.audit_notes.length || 0 },
    { key: 'exceptions', label: '异常原因', count: () => application()?.exceptions.length || 0 },
  ];

  return (
    <Layout>
      <div class="container">
        <div
          style={{
            marginBottom: '16px',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'space-between',
          }}
        >
          <A
            href="/applications"
            style={{
              color: '#1890ff',
              'font-size': '14px',
              display: 'inline-flex',
              'align-items': 'center',
              gap: '4px',
            }}
          >
            ← 返回列表
          </A>
        </div>

        <Show when={loading()}>
          <div
            class="card"
            style={{ 'text-align': 'center', padding: '48px', color: '#999' }}
          >
            加载中...
          </div>
        </Show>

        <Show when={error() && !loading()}>
          <div class="card" style={{ color: '#ff4d4f', marginBottom: '16px' }}>
            {error()}
            <button
              class="btn btn-primary"
              style={{ 'margin-left': '16px' }}
              onClick={loadData}
            >
              重试
            </button>
          </div>
        </Show>

        <Show when={!loading() && application()}>
          <div class="card" style={{ marginBottom: '16px' }}>
            <div
              style={{
                display: 'flex',
                'justify-content': 'space-between',
                'align-items': 'flex-start',
                marginBottom: '24px',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    gap: '12px',
                    marginBottom: '8px',
                    'flex-wrap': 'wrap',
                  }}
                >
                  <h2
                    style={{
                      'font-size': '20px',
                      'font-weight': '600',
                      margin: 0,
                    }}
                  >
                    {application()?.application_no}
                  </h2>
                  <StatusBadge status={application()!.status} />
                  <WarningTag
                    dueDate={application()!.due_date}
                    isOverdue={application()!.is_overdue}
                  />
                  <span
                    class="tag"
                    style={{
                      background: '#f0f0f0',
                      color: '#666',
                      border: '1px solid #d9d9d9',
                      'font-weight': '500',
                    }}
                  >
                    v{application()?.version}
                  </span>
                </div>
                <div style={{ color: '#333', 'font-size': '15px', marginTop: '8px' }}>
                  {application()?.title}
                </div>
                <div style={{ color: '#999', 'font-size': '13px', marginTop: '4px' }}>
                  {application()?.applicant_name} · {application()?.type}
                  {application()?.current_handler && (
                    <>
                      {' · '}当前处理人：
                      <span style={{ color: '#1890ff' }}>
                        {application()!.current_handler}
                      </span>
                      {application()?.current_handler_role &&
                        `（${getRoleLabel(application()!.current_handler_role)}）`}
                    </>
                  )}
                </div>
              </div>
              <div style={{ 'text-align': 'right' }}>
                <div style={{ color: '#999', 'font-size': '13px', marginBottom: '4px' }}>
                  申请金额
                </div>
                <div
                  style={{
                    color: '#f5222d',
                    'font-size': '32px',
                    'font-weight': '700',
                  }}
                >
                  ¥
                  {application()
                    ?.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                'grid-template-columns': 'repeat(4, 1fr)',
                gap: '16px',
                padding: '20px',
                background: '#fafafa',
                'border-radius': '8px',
              }}
            >
              <div>
                <div style={{ color: '#999', 'font-size': '13px', marginBottom: '4px' }}>
                  申请人
                </div>
                <div style={{ color: '#333', 'font-size': '15px', 'font-weight': '500' }}>
                  {application()?.applicant_name}
                </div>
              </div>
              <div>
                <div style={{ color: '#999', 'font-size': '13px', marginBottom: '4px' }}>
                  申请类型
                </div>
                <div style={{ color: '#333', 'font-size': '15px', 'font-weight': '500' }}>
                  {application()?.type}
                </div>
              </div>
              <div>
                <div style={{ color: '#999', 'font-size': '13px', marginBottom: '4px' }}>
                  创建时间
                </div>
                <div style={{ color: '#333', 'font-size': '15px' }}>
                  {dayjs(application()?.created_at).format('YYYY-MM-DD HH:mm')}
                </div>
              </div>
              <div>
                <div style={{ color: '#999', 'font-size': '13px', marginBottom: '4px' }}>
                  到期日
                </div>
                <div style={{ color: '#333', 'font-size': '15px' }}>
                  {dayjs(application()?.due_date).format('YYYY-MM-DD')}
                </div>
              </div>
            </div>

            {application()?.payment_evidence && (
              <div
                style={{
                  marginTop: '20px',
                  padding: '16px',
                  background: '#f6ffed',
                  'border-radius': '8px',
                  border: '1px solid #b7eb8f',
                }}
              >
                <div style={{ color: '#389e0d', 'font-size': '13px', marginBottom: '8px' }}>
                  付款凭证
                </div>
                <div style={{ color: '#333', lineHeight: '1.6' }}>
                  {application()!.payment_evidence}
                </div>
              </div>
            )}
          </div>

          <div class="card" style={{ marginBottom: '16px' }}>
            <div class="tabs" style={{ marginBottom: '20px' }}>
              <For each={sections}>
                {(section) => (
                  <div
                    class={{ 'tab-item': true, 'active': activeSection() === section.key }}
                    onClick={() => setActiveSection(section.key)}
                  >
                    {section.label}
                    {section.count() > 0 && (
                      <span
                        class="badge"
                        style={{
                          background:
                            section.key === 'exceptions' ? '#ff4d4f' : '#1890ff',
                        }}
                      >
                        {section.count()}
                      </span>
                    )}
                  </div>
                )}
              </For>
            </div>

            <Show when={activeSection() === 'attachments'}>
              <AttachmentsList attachments={application()!.attachments} />
            </Show>

            <Show when={activeSection() === 'records'}>
              <ProcessTimeline records={application()!.process_records} />
            </Show>

            <Show when={activeSection() === 'audit_notes'}>
              <div>
                {application()!.audit_notes.length === 0 ? (
                  <div
                    style={{
                      color: '#999',
                      'font-size': '14px',
                      padding: '16px 0',
                    }}
                  >
                    暂无审计备注
                  </div>
                ) : (
                  <For each={application()!.audit_notes}>
                    {(note) => (
                      <div
                        style={{
                          padding: '16px',
                          background: '#fffbe6',
                          'border-radius': '8px',
                          border: '1px solid #ffe58f',
                          marginBottom: '12px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            'justify-content': 'space-between',
                            marginBottom: '8px',
                          }}
                        >
                          <span style={{ color: '#d4b106', 'font-weight': '500' }}>
                            {note.operator_name}
                          </span>
                          <span style={{ color: '#999', 'font-size': '12px' }}>
                            {dayjs(note.created_at).format('YYYY-MM-DD HH:mm')}
                          </span>
                        </div>
                        <div style={{ color: '#666', lineHeight: '1.8' }}>{note.note}</div>
                      </div>
                    )}
                  </For>
                )}
              </div>
            </Show>

            <Show when={activeSection() === 'exceptions'}>
              <div>
                {application()!.exceptions.length === 0 ? (
                  <div
                    style={{
                      color: '#999',
                      'font-size': '14px',
                      padding: '16px 0',
                    }}
                  >
                    暂无异常记录
                  </div>
                ) : (
                  <For each={application()!.exceptions}>
                    {(exc) => (
                      <div
                        style={{
                          padding: '16px',
                          background: exc.resolved ? '#f6ffed' : '#fff1f0',
                          'border-radius': '8px',
                          border: `1px solid ${exc.resolved ? '#b7eb8f' : '#ffa39e'}`,
                          marginBottom: '12px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            'justify-content': 'space-between',
                            'align-items': 'center',
                            marginBottom: '12px',
                            'flex-wrap': 'wrap',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                            <span
                              class="tag"
                              style={{
                                background: exc.resolved ? '#f6ffed' : '#fff1f0',
                                color: exc.resolved ? '#389e0d' : '#cf1322',
                                border: `1px solid ${exc.resolved ? '#b7eb8f' : '#ffa39e'}`,
                              }}
                            >
                              {REASON_CODE_LABELS[exc.reason_code] || exc.reason_code}
                            </span>
                            {exc.resolved ? (
                              <span
                                class="tag"
                                style={{
                                  background: '#52c41a',
                                  color: '#fff',
                                  border: '1px solid #52c41a',
                                }}
                              >
                                已解决
                              </span>
                            ) : (
                              <span
                                class="tag"
                                style={{
                                  background: '#ff4d4f',
                                  color: '#fff',
                                  border: '1px solid #ff4d4f',
                                }}
                              >
                                未解决
                              </span>
                            )}
                          </div>
                          <span style={{ color: '#999', 'font-size': '12px' }}>
                            {exc.handler_name && `处理人：${exc.handler_name}`}
                            {exc.resolved_at &&
                              ` · 解决时间：${dayjs(exc.resolved_at).format('YYYY-MM-DD HH:mm')}`}
                          </span>
                        </div>
                        <div
                          style={{
                            padding: '12px',
                            background: '#fff',
                            'border-radius': '4px',
                            marginBottom: '8px',
                          }}
                        >
                          <div style={{ color: '#999', 'font-size': '12px', marginBottom: '4px' }}>
                            异常详情
                          </div>
                          <div style={{ color: '#333', lineHeight: '1.6' }}>
                            {exc.reason_detail}
                          </div>
                        </div>
                        {exc.rectify_note && (
                          <div
                            style={{
                              padding: '12px',
                              background: '#fff',
                              'border-radius': '4px',
                            }}
                          >
                            <div
                              style={{
                                color: '#52c41a',
                                'font-size': '12px',
                                marginBottom: '4px',
                              }}
                            >
                              补正说明
                            </div>
                            <div style={{ color: '#333', lineHeight: '1.6' }}>
                              {exc.rectify_note}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </For>
                )}
              </div>
            </Show>
          </div>

          <div class="card">
            <div
              style={{
                display: 'flex',
                'justify-content': 'space-between',
                'align-items': 'center',
                marginBottom: '16px',
                'flex-wrap': 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ 'font-size': '16px', 'font-weight': '600' }}>办理操作</div>
              <div style={{ color: '#999', 'font-size': '13px' }}>
                当前角色：
                <span style={{ color: '#1890ff', fontWeight: 500 }}>
                  {user() ? getRoleLabel(user()!.role) : ''}
                </span>
              </div>
            </div>

            <Show when={processError()}>
              <div
                style={{
                  padding: '12px 16px',
                  background: '#fff1f0',
                  border: '1px solid #ffa39e',
                  color: '#ff4d4f',
                  'border-radius': '4px',
                  marginBottom: '16px',
                  'font-size': '14px',
                }}
              >
                {processError()}
              </div>
            </Show>

            <Show when={allowedActions().length === 0}>
              <div
                style={{
                  padding: '24px',
                  'text-align': 'center',
                  color: '#999',
                  background: '#fafafa',
                  'border-radius': '8px',
                }}
              >
                当前状态下您无可用操作
              </div>
            </Show>

            <Show when={allowedActions().length > 0}>
              <div style={{ display: 'flex', gap: '12px', 'flex-wrap': 'wrap' }}>
                <For each={allowedActions()}>
                  {(action) => (
                    <button
                      class={getActionButtonClass(action)}
                      onClick={() => openModal(action)}
                      style={{ padding: '10px 24px', 'font-size': '14px' }}
                    >
                      {ACTION_LABELS[action]}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        <FormModal
          open={modalOpen()}
          action={currentAction()}
          applicationNo={application()?.application_no}
          isOverdue={application()?.is_overdue}
          onClose={() => setModalOpen(false)}
          onConfirm={handleProcess}
          loading={processing()}
        />
      </div>
    </Layout>
  );
};

export default ApplicationDetail;
