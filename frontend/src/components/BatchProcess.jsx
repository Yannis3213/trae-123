import React, { useState } from 'react'
import { Modal, Form, Input, Select, Button, Space, message } from 'antd'
import { BATCH_ACTIONS } from '../utils/constants.js'
import { orderApi } from '../api.js'

const { TextArea } = Input

export default function BatchProcess({ open, selectedOrders, onCancel, onSuccess }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState(null)

  const handleSubmit = async (values) => {
    if (!selectedOrders || selectedOrders.length === 0) {
      message.warning('请先选择订单')
      return
    }

    setLoading(true)
    setProcessing(true)
    setResults(null)

    try {
      const orderIds = selectedOrders.map((o) => o.id)
      const payload = {
        order_ids: orderIds,
        action: values.action,
        remark: values.remark || ''
      }
      if (values.approved !== undefined) {
        payload.approved = values.approved
      }

      const result = await orderApi.batchProcess(payload)
      setResults(result)
      message.success(
        `批量处理完成：成功 ${result.success_count || 0} 条，失败 ${result.failed_count || 0} 条`
      )
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || '批量处理失败'
      message.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    setResults(null)
    setProcessing(false)
    form.resetFields()
    if (results && (results.success_count || 0) > 0) {
      onSuccess?.(results)
    } else {
      onCancel()
    }
  }

  return (
    <Modal
      title={`批量处理（${selectedOrders?.length || 0} 条订单）`}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={620}
      maskClosable={!loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={loading}>
        <Form.Item
          name="action"
          label="处理动作"
          rules={[{ required: true, message: '请选择处理动作' }]}
        >
          <Select options={BATCH_ACTIONS} placeholder="请选择处理动作" />
        </Form.Item>
        <Form.Item
          name="remark"
          label="处理备注"
        >
          <TextArea rows={3} placeholder="请输入处理备注（选填）" />
        </Form.Item>

        {results && (results.results || []).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 12, fontWeight: 500 }}>
              处理结果：共 {results.total || 0} 条，
              成功 {results.success_count || 0} 条，
              失败 {results.failed_count || 0} 条
            </div>
            <div
              style={{
                maxHeight: 280,
                overflowY: 'auto',
                padding: 12,
                background: '#fafafa',
                borderRadius: 6,
                border: '1px solid #f0f0f0'
              }}
            >
              {(results.results || []).map((r, i) => (
                <div
                  key={i}
                  className={`batch-progress-item ${r.success ? 'batch-progress-success' : 'batch-progress-fail'}`}
                >
                  <Space>
                    <span style={{ fontWeight: 500 }}>
                      {r.success ? '✓' : '✗'}
                    </span>
                    <span>订单号：{r.order_no || r.orderNo}</span>
                    {!r.success && (
                      <span style={{ color: '#cf1322' }}>
                        原因：{r.message || '处理失败'}
                      </span>
                    )}
                  </Space>
                </div>
              ))}
            </div>
          </div>
        )}

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={handleClose} disabled={loading}>
              {results ? '关闭' : '取消'}
            </Button>
            {!results && (
              <Button type="primary" htmlType="submit" loading={loading}>
                确认处理
              </Button>
            )}
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
