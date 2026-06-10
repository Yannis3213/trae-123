import React, { useState, useMemo } from 'react';
import {
  Modal,
  Form,
  Input,
  Table,
  Tag,
  Button,
  Space,
  Card,
  message,
  Alert,
  Spin,
  Checkbox,
  List,
} from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, PaperClipOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { orderApi, type BatchProcessReq } from '../api';
import type { OrderWithWarning, OrderStage, OrderStatus } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  action: string;
  stage: OrderStage;
  selectedOrders: OrderWithWarning[];
  onSuccess?: () => void;
}

const STAGE_LABELS: Record<OrderStage, string> = {
  listing: '商品刊登',
  inventory: '库存同步',
  fulfillment: '订单履约',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待提交',
  submitted: '已提交',
  returned: '已退回',
  approved: '审核通过',
  completed: '已完成',
};

const ACTION_LABELS: Record<string, string> = {
  submit: '提交',
  resubmit: '重新提交',
  approve: '审核通过',
  return: '退回',
};

interface BatchResult {
  order_id: string;
  order_no: string;
  success: boolean;
  message: string;
}

function BatchProcessModal({ open, onClose, action, stage, selectedOrders, onSuccess }: Props) {
  const [form] = Form.useForm();
  const [auditNote, setAuditNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<BatchResult[] | null>(null);
  const [includeAttachments, setIncludeAttachments] = useState(true);

  const showResults = results !== null;

  const missingEvidenceOrders = useMemo(() => {
    if (action !== 'submit' && action !== 'resubmit') return [];
    return selectedOrders.filter((o) => (o.stage_attach_count || 0) === 0);
  }, [selectedOrders, action]);

  const okEvidenceOrders = useMemo(() => {
    if (action !== 'submit' && action !== 'resubmit') return selectedOrders;
    return selectedOrders.filter((o) => (o.stage_attach_count || 0) > 0);
  }, [selectedOrders, action]);

  const cannotProceed = (action === 'submit' || action === 'resubmit') && okEvidenceOrders.length === 0;

  const handleSubmit = async () => {
    if (action === 'return' && !auditNote.trim()) {
      message.warning('批量退回请填写退回原因');
      return;
    }
    if (cannotProceed) {
      message.error('所有选中订单均缺少材料附件，请先在详情页补充后再批量提交');
      return;
    }
    if (action === 'submit' || action === 'resubmit') {
      if (!includeAttachments) {
        Modal.confirm({
          title: '未勾选「自动携带材料附件」',
          content: `当前${STAGE_LABELS[stage]}环节要求提交时必须绑定材料附件，取消勾选将导致所有订单因缺材料被后端拦截。建议保持勾选状态。`,
          okText: '仍然继续',
          okButtonProps: { danger: true },
          cancelText: '恢复勾选',
          onOk: async () => {
            await doSubmit();
          },
          onCancel: () => {
            setIncludeAttachments(true);
          },
        });
        return;
      }
    }
    await doSubmit();
  };

  const doSubmit = async () => {
    setSubmitting(true);
    setResults(null);
    try {
      const targetOrders =
        action === 'submit' || action === 'resubmit' ? okEvidenceOrders : selectedOrders;
      const skippedOrders = selectedOrders.filter(
        (o) => !targetOrders.find((t) => t.id === o.id)
      );

      const payload: BatchProcessReq = {
        action,
        stage,
        order_ids: targetOrders.map((o) => o.id),
        versions: Object.fromEntries(targetOrders.map((o) => [o.id, o.version])),
      };
      if (action === 'return' || action === 'approve') {
        payload.audit_notes = Object.fromEntries(
          targetOrders.map((o) => [o.id, auditNote])
        );
      }
      if (includeAttachments && (action === 'submit' || action === 'resubmit')) {
        const attachmentMap: Record<string, string[]> = {};
        await Promise.all(
          targetOrders.map(async (o) => {
            try {
              const detail = await orderApi.get(o.id);
              attachmentMap[o.id] = detail.attachments
                .filter((a) => a.stage === stage)
                .map((a) => a.id);
            } catch {
              attachmentMap[o.id] = [];
            }
          })
        );
        payload.attachment_ids = attachmentMap;
      }
      const res = await orderApi.batch(payload);

      const allResults: BatchResult[] = [
        ...res.results,
        ...skippedOrders.map((o) => ({
          order_id: o.id,
          order_no: o.order_no,
          success: false,
          message: `前置校验不通过：${STAGE_LABELS[stage]}环节缺少材料附件，请先上传至少1份（如${
            stage === 'listing' ? '商品规格参数表、高清图片' : stage === 'inventory' ? '入库凭证、盘点表' : '报关单、质检报告'
          }等）`,
        })),
      ];

      setResults(allResults);
      if (res.success_count > 0) {
        message.success(`成功处理 ${res.success_count} 条，失败 ${allResults.length - res.success_count} 条`);
        onSuccess?.();
      } else {
        message.error(`全部 ${allResults.length} 条处理失败`);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.error || '批量处理失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setResults(null);
    setAuditNote('');
    setIncludeAttachments(true);
    form.resetFields();
    onClose();
  };

  const previewColumns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      width: 140,
      render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: '商品',
      dataIndex: 'product_name',
      ellipsis: true,
    },
    {
      title: '环节',
      dataIndex: 'current_stage',
      width: 100,
      render: (v: OrderStage) => STAGE_LABELS[v],
    },
    {
      title: '状态',
      dataIndex: 'current_status',
      width: 100,
      render: (v: OrderStatus) => <Tag>{STATUS_LABELS[v]}</Tag>,
    },
    ...((action === 'submit' || action === 'resubmit')
      ? [
          {
            title: '材料附件',
            dataIndex: 'stage_attach_count' as const,
            width: 120,
            render: (v: number, r: OrderWithWarning) => (
              <Space>
                <Tag
                  icon={<PaperClipOutlined />}
                  color={v > 0 ? 'blue' : 'red'}
                >
                  {v > 0 ? `${v}份 ✓` : '缺材料 ✗'}
                </Tag>
              </Space>
            ),
          },
        ]
      : []),
    {
      title: '版本',
      dataIndex: 'version',
      width: 60,
    },
  ];

  const resultColumns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      width: 140,
      render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: '处理结果',
      dataIndex: 'success',
      width: 100,
      render: (v: boolean) =>
        v ? (
          <span className="batch-result-success">
            <CheckCircleOutlined /> 成功
          </span>
        ) : (
          <span className="batch-result-fail">
            <CloseCircleOutlined /> 失败
          </span>
        ),
    },
    {
      title: '结果说明',
      dataIndex: 'message',
      render: (v: string, r: BatchResult) => (
        <span className={r.success ? 'batch-result-success' : 'batch-result-fail'}>{v}</span>
      ),
    },
  ];

  return (
    <Modal
      title={`批量${ACTION_LABELS[action]} - ${STAGE_LABELS[stage]}`}
      open={open}
      onCancel={handleClose}
      width={900}
      footer={
        showResults ? (
          <Button type="primary" onClick={handleClose}>
            完成
          </Button>
        ) : (
          <Space>
            <Button onClick={handleClose}>取消</Button>
            <Button
              type="primary"
              loading={submitting}
              onClick={handleSubmit}
              danger={cannotProceed}
              disabled={cannotProceed}
            >
              {cannotProceed
                ? '全部缺材料，无法继续'
                : `确认${ACTION_LABELS[action]}${
                    missingEvidenceOrders.length > 0
                      ? `（仅处理 ${okEvidenceOrders.length} 条有材料的订单）`
                      : ''
                  }`}
            </Button>
          </Space>
        )
      }
    >
      {submitting && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,255,255,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <Spin size="large" tip="正在批量处理，请稍候..." />
        </div>
      )}

      {showResults ? (
        <>
          <Alert
            message={`批量处理完成：共 ${results!.length} 条，成功 ${
              results!.filter((r) => r.success).length
            } 条，失败 ${results!.filter((r) => !r.success).length} 条`}
            type={results!.some((r) => !r.success) ? 'warning' : 'success'}
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Table
            rowKey="order_id"
            dataSource={results!}
            columns={resultColumns}
            pagination={false}
            size="small"
          />
        </>
      ) : (
        <>
          <Alert
            message={`即将对以下 ${selectedOrders.length} 个订单执行「${ACTION_LABELS[action]}」操作，请确认：`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          {missingEvidenceOrders.length > 0 && (
            <Alert
              message={
                <Space>
                  <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                  <strong>
                    {missingEvidenceOrders.length} 个订单缺少
                    {STAGE_LABELS[stage]}环节材料证据，将被跳过或拦截：
                  </strong>
                </Space>
              }
              description={
                <List
                  size="small"
                  dataSource={missingEvidenceOrders}
                  renderItem={(o) => (
                    <List.Item>
                      <Space>
                        <Tag icon={<CloseCircleOutlined />} color="red">
                          缺材料
                        </Tag>
                        <span style={{ fontFamily: 'monospace' }}>{o.order_no}</span>
                        <span style={{ color: '#595959' }}>{o.product_name}</span>
                        <Tag color="orange">
                          {STAGE_LABELS[stage]}环节需要上传至少1份附件（如
                          {stage === 'listing'
                            ? '商品规格参数表、高清图片'
                            : stage === 'inventory'
                            ? '入库凭证、盘点表'
                            : '报关单、质检报告'}
                          等）
                        </Tag>
                      </Space>
                    </List.Item>
                  )}
                  style={{ marginTop: 8 }}
                />
              }
              type="error"
              showIcon={false}
              style={{ marginBottom: 16 }}
            />
          )}

          <Card
            title="待处理订单"
            size="small"
            style={{ marginBottom: 16 }}
            bodyStyle={{ padding: 0 }}
          >
            <Table
              rowKey="id"
              dataSource={selectedOrders}
              columns={previewColumns}
              pagination={false}
              size="small"
              scroll={{ y: 220 }}
            />
          </Card>

          {(action === 'return' || action === 'approve') && (
            <Form.Item
              label={action === 'return' ? '退回原因' : '审核说明'}
              required={action === 'return'}
            >
              <Input.TextArea
                value={auditNote}
                onChange={(e) => setAuditNote(e.target.value)}
                rows={3}
                placeholder={
                  action === 'return'
                    ? '请逐条说明退回原因（所有选中订单使用相同原因，可在详情中单独调整）'
                    : '请输入审核说明（可选）'
                }
              />
            </Form.Item>
          )}

          {(action === 'submit' || action === 'resubmit') && (
            <Form.Item label="材料附件">
              <Checkbox
                checked={includeAttachments}
                onChange={(e) => setIncludeAttachments(e.target.checked)}
              >
                自动携带每个订单{STAGE_LABELS[stage]}环节的全部材料附件（推荐）
              </Checkbox>
            </Form.Item>
          )}

          {action === 'return' && (
            <Alert
              message="注意：批量退回将逐条校验，不符合退回条件的订单将被单独拦截，不会影响其他符合条件的订单。"
              type="warning"
              showIcon
            />
          )}
        </>
      )}
    </Modal>
  );
}

export default BatchProcessModal;
