import React, { useState, useEffect } from 'react'
import { Tabs, Card, Descriptions, List, Button, Empty, Space, Spin, Divider, message, Modal } from 'antd'
import {
  ArrowLeftOutlined,
  FileOutlined,
  PaperClipOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InboxOutlined
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import Layout from './Layout.jsx'
import { OrderStatusBadge, DueWarningBadge, ModuleStatusBadge, ModuleTypeBadge } from './StatusBadge.jsx'
import ProcessingTimeline from './ProcessingTimeline.jsx'
import RequirementConfirm from './RequirementConfirm.jsx'
import ScheduleAssessment from './ScheduleAssessment.jsx'
import DeliveryAcceptance from './DeliveryAcceptance.jsx'
import UserTag from './UserTag.jsx'
import { orderApi } from '../api.js'
import { formatDate, formatDateSimple, getWarningLevel, getFileSize, canReview, canArchive, canCorrectModule } from '../utils/helpers.js'
import { MODULE_TYPE_KEYS } from '../utils/constants.js'

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [allowedActions, setAllowedActions] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewRemark, setReviewRemark] = useState('')
  const [exceptionReason, setExceptionReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchDetail = async () => {
    setLoading(true)
    try {
      const [detailResult, actionsResult] = await Promise.all([
        orderApi.detail(id),
        orderApi.getAllowedActions(id).catch(() => ({ actions: [] }))
      ])
      setOrder(detailResult)
      setAllowedActions(actionsResult?.actions || [])
    } catch (err) {
      console.error('获取订单详情失败', err)
      message.error('获取订单详情失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDetail()
  }, [id, refreshKey])

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const handleReview = async (approved) => {
    if (!reviewRemark && !approved) {
      message.error('请输入驳回原因')
      return
    }
    setActionLoading(true)
    try {
      await orderApi.review(id, {
        version: order?.version || 1,
        approved,
        remark: reviewRemark,
        exception_reason: !approved ? (exceptionReason || reviewRemark) : undefined
      })
      message.success(approved ? '复核通过' : '已驳回')
      setReviewModalOpen(false)
      setReviewRemark('')
      setExceptionReason('')
      handleRefresh()
    } catch (err) {
      message.error('复核操作失败：' + (err.response?.data?.detail || err.message))
    } finally {
      setActionLoading(false)
    }
  }

  const handleArchive = async () => {
    Modal.confirm({
      title: '确认归档',
      content: '确定要归档此订单吗？归档后将无法再修改。',
      okText: '确认归档',
      cancelText: '取消',
      onOk: async () => {
        try {
          await orderApi.archive(id)
          message.success('归档成功')
          handleRefresh()
        } catch (err) {
          message.error('归档失败：' + (err.response?.data?.detail || err.message))
        }
      }
    })
  }

  if (loading) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: 100 }}>
          <Spin size="large" />
        </div>
      </Layout>
    )
  }

  if (!order) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: 100 }}>
          <Empty description="订单不存在" />
        </div>
      </Layout>
    )
  }

  const requirementStatusKey = order.requirement_status
  const scheduleStatusKey = order.schedule_status
  const deliveryStatusKey = order.delivery_status

  const tabItems = [
    {
      key: MODULE_TYPE_KEYS.REQUIREMENT,
      label: (
        <Space>
          需求确认
          <ModuleStatusBadge status={requirementStatusKey} />
        </Space>
      ),
      children: (
        <RequirementConfirm
          order={order}
          allowedActions={allowedActions}
          onRefresh={handleRefresh}
          isCorrectMode={canCorrectModule(allowedActions, MODULE_TYPE_KEYS.REQUIREMENT)}
        />
      )
    },
    {
      key: MODULE_TYPE_KEYS.SCHEDULE,
      label: (
        <Space>
          排期评估
          <ModuleStatusBadge status={scheduleStatusKey} />
        </Space>
      ),
      children: (
        <ScheduleAssessment
          order={order}
          allowedActions={allowedActions}
          onRefresh={handleRefresh}
          isCorrectMode={canCorrectModule(allowedActions, MODULE_TYPE_KEYS.SCHEDULE)}
        />
      )
    },
    {
      key: MODULE_TYPE_KEYS.DELIVERY,
      label: (
        <Space>
          交付验收
          <ModuleStatusBadge status={deliveryStatusKey} />
        </Space>
      ),
      children: (
        <DeliveryAcceptance
          order={order}
          allowedActions={allowedActions}
          onRefresh={handleRefresh}
          isCorrectMode={canCorrectModule(allowedActions, MODULE_TYPE_KEYS.DELIVERY)}
        />
      )
    }
  ]

  const renderDeadline = (deadline, label) => {
    if (!deadline) return null
    const level = getWarningLevel(deadline)
    return (
      <Descriptions.Item label={label}>
        <Space>
          <span className={`warning-${level}`}>
            {formatDateSimple(deadline)}
          </span>
          <DueWarningBadge deadline={deadline} />
        </Space>
      </Descriptions.Item>
    )
  }

  return (
    <Layout>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>
            返回列表
          </Button>
          {canReview(allowedActions) && (
            <>
              <Button
                icon={<CloseCircleOutlined />}
                danger
                onClick={() => setReviewModalOpen(true)}
              >
                复核驳回
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleReview(true)}
              >
                复核通过
              </Button>
            </>
          )}
          {canArchive(allowedActions) && (
            <Button
              icon={<InboxOutlined />}
              onClick={handleArchive}
            >
              归档
            </Button>
          )}
        </Space>
      </div>

      <div className="page-container">
        <div className="page-title">
          <Space>
            订单详情：{order.order_no || order.orderNo}
            <OrderStatusBadge status={order.status} />
          </Space>
        </div>

        <div className="detail-section">
          <div className="detail-section-title">基础信息</div>
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="订单标题" span={2}>{order.title || '-'}</Descriptions.Item>
            <Descriptions.Item label="项目名称">{order.project_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="版本">V{order.version || 1}</Descriptions.Item>
            <Descriptions.Item label="需求确认线索">{order.requirement_confirmation_clue || '-'}</Descriptions.Item>
            <Descriptions.Item label="当前处理人"><UserTag user={order.current_handler} /></Descriptions.Item>
            <Descriptions.Item label="创建人"><UserTag user={order.created_by} /></Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatDate(order.created_at || order.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatDate(order.updated_at || order.updatedAt)}</Descriptions.Item>
            {renderDeadline(order.requirement_deadline, '需求截止日期')}
            {renderDeadline(order.schedule_deadline, '排期截止日期')}
            {renderDeadline(order.delivery_deadline, '交付截止日期')}
          </Descriptions>
        </div>

        <div className="detail-section">
          <div className="detail-section-title">业务处理模块</div>
          <Tabs items={tabItems} />
        </div>

        <div className="detail-section">
          <div className="detail-section-title">处理记录</div>
          <ProcessingTimeline records={order.processing_records || order.processingRecords || []} />
        </div>

        <div className="detail-section">
          <div className="detail-section-title">
            <Space>
              <ExclamationCircleOutlined style={{ color: '#faad14' }} />
              异常原因
            </Space>
          </div>
          {(order.exception_reasons || order.exceptions || []).length > 0 ? (
            <List
              dataSource={order.exception_reasons || order.exceptions || []}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={item.reason || item.content || item.description || '-'}
                    description={
                      <Space>
                        <UserTag user={item.handler || item.operator || item.created_by} />
                        <span>·</span>
                        <span>{formatDate(item.created_at || item.createdAt)}</span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无异常记录" />
          )}
        </div>

        <div className="detail-section">
          <div className="detail-section-title">
            <Space>
              <PaperClipOutlined />
              附件列表
            </Space>
          </div>
          {(order.attachments || []).length > 0 ? (
            <List
              dataSource={order.attachments || []}
              renderItem={(item) => (
                <List.Item
                  actions={item.url ? [
                    <a key="download" href={item.url} target="_blank" rel="noopener noreferrer">下载</a>
                  ] : []}
                >
                  <List.Item.Meta
                    avatar={<FileOutlined style={{ fontSize: 24, color: '#1677ff' }} />}
                    title={item.name || item.file_name || item.filename || '未命名文件'}
                    description={
                      <Space>
                        <span>{getFileSize(item.size)}</span>
                        <span>·</span>
                        <UserTag user={item.uploaded_by || item.uploader || item.created_by} />
                        <span>·</span>
                        <span>{formatDate(item.uploaded_at || item.created_at || item.createdAt)}</span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无附件" />
          )}
        </div>

        <div className="detail-section">
          <div className="detail-section-title">审计备注</div>
          {(order.audit_notes || order.auditRemarks || []).length > 0 ? (
            (order.audit_notes || order.auditRemarks || []).map((item, i) => (
              <div className="audit-remark">
                <div className="audit-remark-meta">
                  <UserTag user={item.author || item.operator || item.handler || item.created_by} /> · {formatDate(item.created_at || item.createdAt)}
                </div>
                <div>{item.note || item.remark || item.content || '-'}</div>
              </div>
            ))
          ) : (
            <Empty description="暂无审计备注" />
          )}
        </div>
      </div>

      <Modal
        title="复核驳回"
        open={reviewModalOpen}
        onCancel={() => setReviewModalOpen(false)}
        footer={null}
        width={520}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, color: 'rgba(0,0,0,0.85)' }}>驳回原因</div>
          <textarea
            className="ant-input"
            rows={3}
            placeholder="请输入驳回原因"
            value={reviewRemark}
            onChange={(e) => setReviewRemark(e.target.value)}
            style={{ width: '100%', marginBottom: 12 }}
          />
          <div style={{ marginBottom: 8, color: 'rgba(0,0,0,0.85)' }}>异常原因（可选）</div>
          <textarea
            className="ant-input"
            rows={2}
            placeholder="请输入异常原因"
            value={exceptionReason}
            onChange={(e) => setExceptionReason(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={() => setReviewModalOpen(false)}>取消</Button>
            <Button danger onClick={() => handleReview(false)} loading={actionLoading}>
              确认驳回
            </Button>
          </Space>
        </div>
      </Modal>
    </Layout>
  )
}
