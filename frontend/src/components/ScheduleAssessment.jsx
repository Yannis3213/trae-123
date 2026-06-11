import React, { useState } from 'react'
import { Card, Form, Input, DatePicker, Button, Space, Modal, message, Descriptions, Empty } from 'antd'
import { EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { orderApi } from '../api.js'
import { formatDate } from '../utils/helpers.js'
import { canSubmitModule, canAuditModule } from '../utils/helpers.js'
import { ModuleStatusBadge } from './StatusBadge.jsx'
import { MODULE_TYPE_KEYS } from '../utils/constants.js'

const { TextArea } = Input

export default function ScheduleAssessment({ order, allowedActions, onRefresh }) {
  const [submitModalOpen, setSubmitModalOpen] = useState(false)
  const [auditModalOpen, setAuditModalOpen] = useState(false)
  const [submitForm] = Form.useForm()
  const [auditForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [auditExceptionReason, setAuditExceptionReason] = useState('')

  const moduleType = MODULE_TYPE_KEYS.SCHEDULE
  const canSubmit = canSubmitModule(allowedActions, moduleType)
  const canAudit = canAuditModule(allowedActions, moduleType)

  const evidence = order?.schedule_evidence || {}
  const moduleStatus = order?.schedule_status

  const handleSubmit = async (values) => {
    setLoading(true)
    try {
      const payload = {
        version: order?.version || 1,
        evidence: {
          schedule_plan: values.schedule_plan,
          resource_allocation: values.resource_allocation
        }
      }
      if (values.deadline) {
        payload.deadline = dayjs(values.deadline).format('YYYY-MM-DD')
      }
      await orderApi.submitSchedule(order.id, payload)
      message.success('排期评估提交成功')
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
      await orderApi.auditSchedule(order.id, payload)
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
          排期评估
          <ModuleStatusBadge status={moduleStatus} />
        </div>
        <div className="module-actions">
          {canSubmit && (
            <Button type="primary" icon={<EditOutlined />} onClick={() => setSubmitModalOpen(true)}>
              {evidence?.schedule_plan || evidence?.resource_allocation ? '重新提交' : '提交'}
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

      {!evidence?.schedule_plan && !evidence?.resource_allocation ? (
        <Empty description="暂无排期评估数据" style={{ padding: '24px 0' }} />
      ) : (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="排期计划 (schedule_plan)">
            {evidence.schedule_plan || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="资源分配 (resource_allocation)">
            {evidence.resource_allocation || '-'}
          </Descriptions.Item>
          {order.schedule_deadline && (
            <Descriptions.Item label="截止日期">
              {formatDate(order.schedule_deadline, 'YYYY-MM-DD')}
            </Descriptions.Item>
          )}
        </Descriptions>
      )}

      <Modal
        title="提交排期评估"
        open={submitModalOpen}
        onCancel={() => setSubmitModalOpen(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form form={submitForm} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="schedule_plan"
            label="排期计划 (schedule_plan)"
            rules={[{ required: true, message: '请输入排期计划' }]}
          >
            <TextArea rows={4} placeholder="请输入排期计划详情" />
          </Form.Item>
          <Form.Item
            name="resource_allocation"
            label="资源分配 (resource_allocation)"
            rules={[{ required: true, message: '请输入资源分配' }]}
          >
            <TextArea rows={3} placeholder="请输入资源分配详情" />
          </Form.Item>
          <Form.Item name="deadline" label="截止日期（可选）">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setSubmitModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                提交
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="审核排期评估（驳回）"
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
