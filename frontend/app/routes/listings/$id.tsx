import { useState, useEffect, useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '../../contexts/AuthContext'
import {
  getListing,
  submitListing,
  supplementListing,
  processListing,
  reviewListing,
} from '../../lib/listings'
import { getErrorMessage } from '../../lib/apiClient'
import StatusBadge from '../../components/StatusBadge'
import ExpiryIndicator from '../../components/ExpiryIndicator'
import SupplementForm from '../../components/SupplementForm'
import ProcessForm from '../../components/ProcessForm'
import ReviewForm from '../../components/ReviewForm'
import AuditTrail from '../../components/AuditTrail'

const STATUS_MAP: Record<string, string> = {
  DRAFT: '待补正',
  PENDING_SUPPLEMENT: '待补正',
  PENDING_PROCESS: '待补正',
  PROCESSING: '复核中',
  UNDER_REVIEW: '复核中',
  COMPLETED: '办结',
  RETURNED: '待补正',
}

function ListingDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [app, setApp] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('entry')
  const [actionError, setActionError] = useState('')

  const fetchApp = useCallback(async () => {
    try {
      const res = await getListing(Number(id))
      setApp(res.data)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchApp()
  }, [fetchApp])

  const handleSubmit = async () => {
    setActionError('')
    try {
      const res = await submitListing(Number(id), app.status, app.version)
      setApp(res.data)
    } catch (e) {
      setActionError(getErrorMessage(e))
    }
  }

  const handleSupplement = async (data: any) => {
    setActionError('')
    try {
      const res = await supplementListing(
        Number(id),
        data,
        app.status,
        app.version
      )
      setApp(res.data)
    } catch (e) {
      setActionError(getErrorMessage(e))
    }
  }

  const handleProcess = async (data: any) => {
    setActionError('')
    try {
      const res = await processListing(
        Number(id),
        data,
        app.status,
        app.version
      )
      setApp(res.data)
    } catch (e) {
      setActionError(getErrorMessage(e))
    }
  }

  const handleApprove = async (data: any) => {
    setActionError('')
    try {
      const res = await reviewListing(
        Number(id),
        data,
        app.status,
        app.version
      )
      setApp(res.data)
    } catch (e) {
      setActionError(getErrorMessage(e))
    }
  }

  const handleReturn = async (data: any) => {
    setActionError('')
    try {
      const res = await reviewListing(
        Number(id),
        data,
        app.status,
        app.version
      )
      setApp(res.data)
    } catch (e) {
      setActionError(getErrorMessage(e))
    }
  }

  if (loading)
    return (
      <div
        className="page-container"
        style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}
      >
        加载中...
      </div>
    )
  if (error)
    return (
      <div className="page-container">
        <div className="error-message">{error}</div>
      </div>
    )
  if (!app) return null

  const role = currentUser?.role
  const isConsultant = role === 'CONSULTANT'
  const isEvaluator = role === 'EVALUATOR'
  const isManager = role === 'MANAGER'

  const canSubmit =
    isConsultant &&
    ['DRAFT', 'PENDING_SUPPLEMENT', 'RETURNED'].includes(app.status)
  const canSupplement =
    isConsultant &&
    ['PENDING_SUPPLEMENT', 'RETURNED'].includes(app.status)
  const canProcess =
    isEvaluator && ['PENDING_PROCESS', 'PROCESSING'].includes(app.status)
  const canReview = isManager && app.status === 'UNDER_REVIEW'

  const showInspection = [
    'PENDING_PROCESS',
    'PROCESSING',
    'UNDER_REVIEW',
    'COMPLETED',
    'RETURNED',
  ].includes(app.status)
  const showListingConfirm =
    ['UNDER_REVIEW', 'COMPLETED', 'RETURNED'].includes(app.status) ||
    !app.has_listing_evidence

  return (
    <div className="page-container">
      {actionError && <div className="error-message">{actionError}</div>}

      <div className="detail-header">
        <button
          className="btn-outline btn-sm"
          onClick={() => navigate({ to: '/listings' })}
          style={{ marginRight: 8 }}
        >
          ← 返回
        </button>
        <span className="detail-title">{app.application_no}</span>
        <StatusBadge label={app.page_label} />
        <ExpiryIndicator status={app.expiry_status} />
      </div>

      <div className="tab-bar">
        <button
          className={`tab ${activeTab === 'entry' ? 'active' : ''}`}
          onClick={() => setActiveTab('entry')}
        >
          车源录入
        </button>
        {showInspection && (
          <button
            className={`tab ${activeTab === 'inspection' ? 'active' : ''}`}
            onClick={() => setActiveTab('inspection')}
          >
            检测评估
          </button>
        )}
        {showListingConfirm && (
          <button
            className={`tab ${activeTab === 'confirm' ? 'active' : ''}`}
            onClick={() => setActiveTab('confirm')}
          >
            挂牌确认
          </button>
        )}
        <button
          className={`tab ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          审计轨迹
        </button>
      </div>

      {activeTab === 'entry' && (
        <div className="card">
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-label">上架单号</div>
              <div className="detail-value">{app.application_no}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">品牌</div>
              <div className="detail-value">{app.brand}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">型号</div>
              <div className="detail-value">{app.model_name}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">年份</div>
              <div className="detail-value">{app.year}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">车架号</div>
              <div className="detail-value">{app.vin}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">车牌号</div>
              <div className="detail-value">{app.license_plate}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">里程(公里)</div>
              <div className="detail-value">
                {app.mileage?.toLocaleString()}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">门店</div>
              <div className="detail-value">{app.store_name}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">提交人</div>
              <div className="detail-value">
                {app.applicant_display || '-'}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">截止时间</div>
              <div className="detail-value">
                {app.deadline
                  ? app.deadline.replace('T', ' ').slice(0, 16)
                  : '-'}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">是否有挂牌确认证据</div>
              <div className="detail-value">
                {app.has_listing_evidence ? '是' : '否'}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">内部状态</div>
              <div
                className="detail-value"
                style={{ fontSize: 12, color: '#9ca3af' }}
              >
                {app.status} (v{app.version})
              </div>
            </div>
          </div>
          {!app.has_listing_evidence && app.missing_evidence_reason && (
            <div className="warning-box">
              缺挂牌确认证据原因：{app.missing_evidence_reason}
            </div>
          )}
          <div className="action-bar">
            {canSubmit && (
              <button className="btn-primary" onClick={handleSubmit}>
                提交
              </button>
            )}
            {canSupplement && (
              <button
                className="btn-warning"
                onClick={() => setActiveTab('confirm')}
              >
                补正
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'inspection' && (
        <div className="card">
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-label">评估师</div>
              <div className="detail-value">
                {app.evaluator_display || '-'}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">评估结果</div>
              <div className="detail-value">
                {app.evaluation_result || '-'}
              </div>
            </div>
          </div>
          {canProcess && (
            <ProcessForm
              onSubmit={handleProcess}
              status={app.status}
              version={app.version}
            />
          )}
        </div>
      )}

      {activeTab === 'confirm' && (
        <div className="card">
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-label">挂牌确认证据状态</div>
              <div className="detail-value">
                {app.has_listing_evidence ? '已提供' : '缺失'}
              </div>
            </div>
            {!app.has_listing_evidence && (
              <div className="detail-item">
                <div className="detail-label">缺证据原因</div>
                <div
                  className="detail-value"
                  style={{ color: '#ea580c' }}
                >
                  {app.missing_evidence_reason}
                </div>
              </div>
            )}
            {app.supplement_remark && (
              <div className="detail-item">
                <div className="detail-label">补正说明</div>
                <div className="detail-value">{app.supplement_remark}</div>
              </div>
            )}
            {app.review_result && (
              <div className="detail-item">
                <div className="detail-label">复核结果</div>
                <div className="detail-value">{app.review_result}</div>
              </div>
            )}
            {app.reject_reason && (
              <div className="detail-item">
                <div className="detail-label">退回原因</div>
                <div
                  className="detail-value"
                  style={{ color: '#dc2626' }}
                >
                  {app.reject_reason}
                </div>
              </div>
            )}
          </div>
          {!app.has_listing_evidence && app.missing_evidence_reason && (
            <div className="warning-box">
              缺挂牌确认证据原因：{app.missing_evidence_reason}
            </div>
          )}
          {canSupplement && (
            <SupplementForm
              onSubmit={handleSupplement}
              status={app.status}
              version={app.version}
            />
          )}
          {canReview && (
            <ReviewForm
              onApprove={handleApprove}
              onReturn={handleReturn}
              status={app.status}
              version={app.version}
            />
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <AuditTrail applicationId={Number(id)} />
      )}
    </div>
  )
}

export const Route = createFileRoute('/listings/$id')({
  component: ListingDetailPage,
})
