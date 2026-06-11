import React, { useState } from 'react';
import { Modal, Form, Select, Input, Button, message, Space, Alert, Table, Tag } from 'antd';
import { SendOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { batchApi } from '../utils/api';
import { STATUS_BUTTONS, STATUS_MAP } from '../utils/constants';
import type { LegalCase, BatchResult } from '../../types';

const { TextArea } = Input;

interface BatchProcessModalProps {
  open: boolean;
  selectedCases: LegalCase[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function BatchProcessModal({ 
  open, 
  selectedCases, 
  onClose, 
  onSuccess 
}: BatchProcessModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BatchResult[] | null>(null);

  const handleSubmit = async (values: { action: string; remark?: string }) => {
    setLoading(true);
    try {
      const result = await batchApi.process({
        case_ids: selectedCases.map(c => c.id),
        action: values.action,
        remark: values.remark,
        versions: Object.fromEntries(selectedCases.map(c => [c.id, c.version])),
      });
      setResults(result as BatchResult[]);
      message.success('批量处理完成');
    } catch (error: any) {
      message.error(error.message || '批量处理失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    setResults(null);
    onClose();
    if (results) {
      onSuccess();
    }
  };

  const validCases = selectedCases.filter(c => 
    ['pending_submit', 'returned'].includes(c.status)
  );

  const invalidCases = selectedCases.filter(c => 
    !['pending_submit', 'returned'].includes(c.status)
  );

  const availableActions = STATUS_BUTTONS.filter(btn => 
    selectedCases.some(c => c.status === btn.status)
  ).reduce((acc: typeof STATUS_BUTTONS, btn) => {
    if (!acc.some(b => b.action === btn.action)) {
      acc.push(btn);
    }
    return acc;
  }, []);

  const resultColumns = [
    {
      title: '案号',
      dataIndex: 'case_no',
      key: 'case_no',
    },
    {
      title: '处理结果',
      dataIndex: 'success',
      key: 'success',
      render: (success: boolean) => (
        <Tag color={success ? 'success' : 'error'}>
          {success ? (
            <Space><CheckCircleOutlined /> 成功</Space>
          ) : (
            <Space><CloseCircleOutlined /> 失败</Space>
          )}
        </Tag>
      ),
    },
    {
      title: '说明',
      dataIndex: 'message',
      key: 'message',
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <SendOutlined />
          批量处理
        </Space>
      }
      open={open}
      onCancel={handleClose}
      width={700}
      footer={results ? [
        <Button key="close" type="primary" onClick={handleClose}>
          关闭
        </Button>
      ] : [
        <Button key="cancel" onClick={handleClose}>
          取消
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          loading={loading}
          onClick={() => form.submit()}
        >
          确认处理
        </Button>,
      ]}
    >
      {!results ? (
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          {invalidCases.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message="部分案件无法处理"
              description={
                <div>
                  <p>以下案件状态不支持批量提交操作：</p>
                  <ul>
                    {invalidCases.map(c => (
                      <li key={c.id}>
                        {c.case_no} - {c.title} ({STATUS_MAP[c.status]})
                      </li>
                    ))}
                  </ul>
                </div>
              }
              style={{ marginBottom: 16 }}
            />
          )}

          <Alert
            type="info"
            showIcon
            message={`即将对 ${validCases.length} 个案件进行批量处理`}
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="action"
            label="操作类型"
            rules={[{ required: true, message: '请选择操作类型' }]}
          >
            <Select 
              placeholder="请选择要执行的操作"
              options={availableActions.map(btn => ({
                value: btn.action,
                label: btn.label,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="remark"
            label="备注说明"
          >
            <TextArea 
              rows={3} 
              placeholder="请输入备注说明（可选）"
              maxLength={500}
              showCount
            />
          </Form.Item>

          <div>
            <p style={{ marginBottom: 8, color: '#666' }}>案件列表：</p>
            <div 
              style={{ 
                maxHeight: 200, 
                overflowY: 'auto',
                border: '1px solid #f0f0f0',
                borderRadius: 4,
                padding: 8,
              }}
            >
              {validCases.map(c => (
                <div key={c.id} style={{ padding: '4px 8px' }}>
                  {c.case_no} - {c.title}
                </div>
              ))}
            </div>
          </div>
        </Form>
      ) : (
        <Table
          columns={resultColumns}
          dataSource={results}
          rowKey="case_id"
          pagination={false}
          size="small"
        />
      )}
    </Modal>
  );
}
