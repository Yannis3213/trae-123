import React, { useState } from 'react'
import { Modal, Form, Input, Select, Button, Space, message, Radio, Tag } from 'antd'
import { BATCH_ACTIONS } from '../utils/constants.js'
import { orderApi } from '../api.js'

const { TextArea } = Input

const getFailureType = (failureReason) => {
  if (!failureReason) return 'other'
  const reason = String(failureReason).toLowerCase()
  if (reason.includes('版本冲突') || reason.includes('旧版本') || reason.includes('version')) {
    return 'version'
  }
  if (reason.includes('非当前处理人') || reason.includes('当前处理人') || reason.includes('handler')) {
    return 'handler'
  }
  if (reason.includes('缺少必填证据') || reason.includes('缺证据') || reason.includes('evidence') || reason.includes('必填')) {
    return 'evidence'
  }
  if (reason.includes('越权') || reason.includes('权限')) {
    return 'permission'
  }
  if (reason.includes('状态冲突') || reason.includes('状态')) {
    return 'status'
  }
  return 'other'
}

const failureTypeConfig = {
  version: {
    label: '旧版本',
    color: '#722ed1',
    bgColor: '#f9f0ff',
    borderColor: '#d3adf7',
    icon: '🔄'
  },
  handler: {
    label: '非当前处理人',
    color: '#fa8c16',
    bgColor: '#fff7e6',
    borderColor: '#ffd591',
    icon: '👤'
  },
  evidence: {
    label: '缺证据',
    color: '#eb2f96',
    bgColor: '#fff0f6',
    borderColor: '#ffadd2',
    icon: '📄'
  },
  permission: {
    label: '越权',
    color: '#f5222d',
    bgColor: '#fff1f0',
    borderColor: '#ffa39e',
    icon: '🔒'
  },
  status: {
    label: '状态冲突',
    color: '#faad14',
    bgColor: '#fffbe6',
    borderColor: '#ffe58f',
    icon: '⚠️'
  },
  other: {
    label: '其他',
    color: '#8c8c8c',
    bgColor: '#fafafa',
    borderColor: '#d9d9d9',
    icon: '❌'
  }
}

export default function BatchProcess({ open, selectedOrders, onCancel, onSuccess }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState(null)
  const [selectedAction, setSelectedAction] = useState(null)

  const handleActionChange = (value) => {
    setSelectedAction(value)
    form.setFieldsValue({ approved: null })
  }

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
      const orderVersions = {}
      selectedOrders.forEach((o) => {
        if (o.id && o.version !== undefined) {
          orderVersions[o.id] = o.version
        }
      })

      const payload = {
        order_ids: orderIds,
        action: values.action,
        remark: values.remark || '',
        order_versions: orderVersions
      }
      if (values.action === 'verify' && values.approved !== undefined && values.approved !== null) {
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
    setSelectedAction(null)
    form.resetFields()
    if (results && (results.success_count || 0) > 0) {
      onSuccess?.(results)
    } else {
      onCancel()
    }
  }

  const getModalTitle = () => {
    const count = selectedOrders?.length || 0
    if (selectedAction === 'verify') {
      return `批量核验（${count} 条订单）`
    }
    if (selectedAction === 'advance') {
      return `批量推进（${count} 条订单）`
    }
    return `批量处理（${count} 条订单）`
  }

  const getRemarkPlaceholder = () => {
    if (selectedAction === 'verify') {
      return '请输入核验备注（选填）'
    }
    if (selectedAction === 'advance') {
      return '请输入推进备注（选填）'
    }
    return '请输入处理备注（选填）'
  }

  return (
    <Modal
      title={getModalTitle()}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={680}
      maskClosable={!loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={loading}>
        <Form.Item
          name="action"
          label="处理动作"
          rules={[{ required: true, message: '请选择处理动作' }]}
        >
          <Select options={BATCH_ACTIONS} placeholder="请选择处理动作" onChange={handleActionChange} />
        </Form.Item>

        {selectedAction === 'verify' && (
          <Form.Item
            name="approved"
            label="核验结果"
            rules={[{ required: true, message: '请选择核验结果' }]}
          >
            <Radio.Group>
              <Radio value={true}>核验通过</Radio>
              <Radio value={false}>核验不通过</Radio>
            </Radio.Group>
          </Form.Item>
        )}

        <Form.Item
          name="remark"
          label="处理备注"
        >
          <TextArea rows={3} placeholder={getRemarkPlaceholder()} />
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
                maxHeight: 360,
                overflowY: 'auto',
                padding: 12,
                background: '#fafafa',
                borderRadius: 6,
                border: '1px solid #f0f0f0'
              }}
            >
              {(results.results || []).map((r, i) => {
                const bizResult = r.biz_result || r.bizResult
                const exceptionReason = r.exception_reason || r.exceptionReason
                const failureReason = r.failure_reason || r.failureReason
                const orderNo = r.order_no || r.orderNo
                const type = getFailureType(failureReason)
                const typeConfig = failureTypeConfig[type]

                return (
                  <div
                    key={i}
                    style={{
                      padding: '12px 0',
                      borderBottom: i < (results.results || []).length - 1 ? '1px solid #e8e8e8' : 'none'
                    }}
                  >
                    <div style={{ marginBottom: 8, fontWeight: 500 }}>
                      订单号：{orderNo}
                    </div>

                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 4,
                        marginBottom: 6,
                        background: r.success ? '#f6ffed' : typeConfig.bgColor,
                        border: `1px solid ${r.success ? '#b7eb8f' : typeConfig.borderColor}`,
                        color: r.success ? '#389e0d' : typeConfig.color
                      }}
                    >
                      <Space>
                        <span style={{ fontWeight: 500 }}>{r.success ? '✓' : typeConfig.icon}</span>
                        <span>业务处理结果：{bizResult || (r.success ? '处理成功' : '处理失败')}</span>
                      </Space>
                    </div>

                    {exceptionReason && (
                      <div
                        style={{
                          padding: '8px 12px',
                          borderRadius: 4,
                          marginBottom: 6,
                          background: '#fffbe6',
                          border: '1px solid #ffe58f',
                          color: '#d46b08'
                        }}
                      >
                        异常原因：{exceptionReason}
                      </div>
                    )}

                    {!r.success && failureReason && (
                      <>
                        <div style={{ marginBottom: 6 }}>
                          <Tag color={typeConfig.color}>
                            {typeConfig.icon} {typeConfig.label}
                          </Tag>
                        </div>
                        <div
                          style={{
                            padding: '8px 12px',
                            borderRadius: 4,
                            background: typeConfig.bgColor,
                            border: `1px solid ${typeConfig.borderColor}`,
                            color: typeConfig.color
                          }}
                        >
                          失败原因：{failureReason}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
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
