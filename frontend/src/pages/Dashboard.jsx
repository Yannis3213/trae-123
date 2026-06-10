import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'

export default function Dashboard() {
  const navigate = useNavigate()
  const { stats, fetchStats, userLabel } = useApp()

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return (
    <div>
      <div className="dashboard-intro">
        <h3>📋 为什么团队预约单会停在「详情保留痕」？</h3>
        <p>
          景区月底集中处理团队预约单采用<span className="highlight">三人三段式流转</span>机制，
          每一张预约单的状态、证据和异常原因都会永久保留在详情中，原因如下：
        </p>
        <ul style={{ marginTop: 8 }}>
          <li>
            <strong>角色职责清晰，不能跳环节：</strong>
            <span className="highlight">现场调度</span>提交团队预约和入园统计
            → <span className="highlight">票务专员</span>补全票务核销
            → <span className="highlight">景区经理</span>复核归档。
            现场调度<span className="highlight">不能</span>替景区经理归档，票务专员也<span className="highlight">不能</span>跳过处理环节。
          </li>
          <li>
            <strong>状态留痕：</strong>
            所有状态变更（<span className="highlight">待审核 → 审核通过 → 已同步</span>，或<span className="highlight">退回补正</span>）
            都会记录操作人、操作时间、前后状态和备注，方便月底对账审计。
          </li>
          <li>
            <strong>证据留痕：</strong>
            三个业务模块（<span className="highlight">团队预约、票务核销、入园统计</span>）各自的补录、修改都会记录版本号和操作人。
          </li>
          <li>
            <strong>异常留痕：</strong>
            退回补正、材料缺失、超时逾期、状态冲突等异常原因都会逐条保留，
            明确<span className="highlight">谁该补正、补正什么</span>。
          </li>
          <li>
            <strong>状态冲突保护：</strong>
            当后端检测到版本号不一致或当前角色不匹配时，会<span className="highlight">保留原值</span>并提示用户刷新，
            避免覆盖他人的处理结果。
          </li>
        </ul>
        <p style={{ marginTop: 12 }}>
          当前您以「<span className="highlight">{userLabel}</span>」身份登录，
          可在右上角切换角色体验不同环节的操作权限。
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-label">预约单总数</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card normal">
          <div className="stat-label">正常处理</div>
          <div className="stat-value">{stats.normal}</div>
        </div>
        <div className="stat-card approaching">
          <div className="stat-label">临期预警（4小时内）</div>
          <div className="stat-value">{stats.approaching}</div>
        </div>
        <div className="stat-card overdue">
          <div className="stat-label">已逾期</div>
          <div className="stat-value">{stats.overdue}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>🔄 状态流转说明</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <span className="status-tag 待审核" style={{ fontSize: 14, padding: '6px 16px' }}>待审核</span>
              <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>现场调度 / 票务专员处理</div>
            </div>
            <span style={{ fontSize: 20, color: '#999' }}>→</span>
            <div style={{ textAlign: 'center' }}>
              <span className="status-tag 审核通过" style={{ fontSize: 14, padding: '6px 16px' }}>审核通过</span>
              <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>景区经理复核</div>
            </div>
            <span style={{ fontSize: 20, color: '#999' }}>→</span>
            <div style={{ textAlign: 'center' }}>
              <span className="status-tag 已同步" style={{ fontSize: 14, padding: '6px 16px' }}>已同步</span>
              <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>归档完成</div>
            </div>
            <span style={{ fontSize: 20, color: '#999', margin: '0 8px' }}>⇄</span>
            <div style={{ textAlign: 'center' }}>
              <span className="status-tag 退回补正" style={{ fontSize: 14, padding: '6px 16px' }}>退回补正</span>
              <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>补正后回到「待审核」</div>
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 16 }}>
            <button className="btn btn-primary" onClick={() => navigate('/bookings')}>
              查看团队预约单列表 →
            </button>
            <button className="btn btn-warning" onClick={() => navigate('/warnings')}>
              查看到期预警队列 →
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>📊 按状态分布</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {Object.entries(stats.by_status || {}).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`status-tag ${status}`}>{status}</span>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{count}</span>
                <span style={{ color: '#999' }}>张</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
