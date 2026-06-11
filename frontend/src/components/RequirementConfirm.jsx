import React, { useState } from 'react'
import { Card, Form, Input, DatePicker, Upload, Button, Space, Modal, message, Descriptions, Empty } from 'antd'
import { UploadOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { orderApi } from '../api.js'
import { formatDate } from '../utils/helpers.js'
import { canSubmitModule, canAuditModule } from '../utils/helpers.js'
import { ModuleStatusBadge } from './StatusBadge.jsx'
import { MODULE_TYPE_KEYS } from '../utils/constants.js'

const { TextArea } = Input

export default function RequirementConfirm({ order, allowedActions, onRefresh, isCorrectMode = false }) {
  const [submitModalOpen, setSubmitModalOpen] = useState(false)
  const [auditModalOpen, setAuditModalOpen] = useState(false)
  const [submitForm] = Form.useForm()
  const [auditForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [auditExceptionReason, setAuditExceptionReason] = useState('')

  const moduleType = MODULE_TYPE_KEYS.REQUIREMENT
  const canSubmit = canSubmitModule(allowedActions, moduleType)
  const canAudit = canAuditModule(allowedActions, moduleType)
  const canCorrect = isCorrectMode

  const evidence = order?.requirement_evidence || {}
  const moduleStatus = order?.requirement_status

  const handleSubmit = async (values) => {
    setLoading(true)
    try {
      const payload = {
        version: order?.version || 1,
        evidence: {
          confirmation_document: values.confirmation_document,
          stakeholder_signature: values.stakeholder_signature
        }
      }
      if (values.deadline) {
        payload.deadline = dayjs(values.deadline).format('YYYY-MM-DD')
      }
      await orderApi.submitRequirement(order.id, payload)
      message.success('需求确认提交成功')
      setSubmitModalOpen(false)
      submitForm.resetFields()
      onRefresh?.()
    } catch (err) {
      message.error('提交失败：' + (err.response?.data?.detail || err.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  const handleAudit = async (values, approved) => {
    if (!approved && !values.remark) {
      message.error('请输入审核意见')
      return
    }
    setLoading(true)
    try {
      const payload = {
        version: order?.version || 1,
        approved,
        remark: values.remark || ''
      }
      if (!approved && auditExceptionReason) {
        payload.exception_reason = auditExceptionReason
      }
      await orderApi.auditRequirement(order.id, payload)
      message.success(approved ? '审核通过' : '已驳回')
      setAuditModalOpen(false)
      auditForm.resetFields()
      setAuditExceptionReason('')
      onRefresh?.()
    } catch (err) {
      message.error('审核失败：' + (err.response?.data?.detail || err.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="module-card">
      <div className="module-header">
        <div className="module-title">
          需求确认
          <ModuleStatusBadge status={moduleStatus} />
        </div>
        <div className="module-actions">
          {(canSubmit || canCorrect) && (
            <Button type="primary" icon={<EditOutlined />} onClick={() => setSubmitModalOpen(true)}>
              {canCorrect ? '补正提交' : (evidence?.confirmation_document || evidence?.stakeholder_signature ? '重新提交' : '提交')}
            </Button>
          )}
          {canAudit && (
            <>
              <Button icon={<CloseOutlined />} danger onClick={() => setAuditModalOpen(true)}>
                驳回
              </Button>
              <Button type="primary" icon={<CheckOutlined />} onClick={() => handleAudit({}, true)} loading={loading}>
                通过
              </Button>
            </>
          )}
        </div>
      </div>

      {!evidence?.confirmation_document && !evidence?.stakeholder_signature ? (
        <Empty description="暂无需求确认数据" style={{ padding: '24px 0' }} />
      ) : (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="确认文档 (confirmation_document)">
            {evidence.confirmation_document || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="干系人签字 (stakeholder_signature)">
            {evidence.stakeholder_signature || '-'}
          </Descriptions.Item>
          {order.requirement_deadline && (
            <Descriptions.Item label="截止日期">
              {formatDate(order.requirement_deadline, 'YYYY-MM-DD')}
            </Descriptions.Item>
          )}
        </Descriptions>
      )}

      <Modal
        title={canCorrect ? '补正 - 需求确认' : '提交需求确认'}
        open={submitModalOpen}
        onCancel={() => setSubmitModalOpen(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form form={submitForm} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="confirmation_document"
            label="确认文档 (confirmation_document)"
            rules={[{ required: true, message: '请输入确认文档' }]}
          >
            <TextArea rows={4} placeholder="请输入需求确认文档内容" />
          </Form.Item>
          <Form.Item
            name="stakeholder_signature"
            label="干系人签字 (stakeholder_signature)"
            rules={[{ required: true, message: '请输入干系人签字信息' }]}
          >
            <TextArea rows={2} placeholder="请输入干系人签字信息" />
          </Form.Item>
          <Form.Item name="deadline" label="截止日期（可选）">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setSubmitModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                {canCorrect ? '补正提交' : '提交'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="审核需求确认（驳回）"
        open={auditModalOpen}
        onCancel={() => setAuditModalOpen(false)}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form form={auditForm} layout="vertical" onFinish={(v) => handleAudit(v, false)}>
          <Form.Item
            name="remark"
            label="审核意见"
            rules={[{ required: true, message: '请输入审核意见' }]}
          >
            <TextArea rows={3} placeholder="请输入驳回原因" />
          </Form.Item>
          <div style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 8, color: 'rgba(0,0,0,0.85)' }}>异常原因（可选）</div>
            <TextArea
              rows={2}
              placeholder="请输入异常原因"
              value={auditExceptionReason}
              onChange={(e) => setAuditExceptionReason(e.target.value)}
            />
          </div>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAuditModalOpen(false)}>取消</Button>
              <Button danger htmlType="submit" loading={loading}>
                确认驳回
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
