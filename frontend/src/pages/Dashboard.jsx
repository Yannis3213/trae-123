import React, { useState, useEffect } from 'react'
import { Row, Col, Card, List, Tag, Space, Statistic, Spin } from 'antd'
import {
  FileSearchOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import { OrderStatusBadge, DueWarningBadge, ModuleTypeBadge } from '../components/StatusBadge.jsx'
import { statisticsApi } from '../api.js'
import { formatDate, getWarningLevelFromDays } from '../utils/helpers.js'

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [statistics, setStatistics] = useState(null)
  const [warnings, setWarnings] = useState([])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [statsResult, warningsResult] = await Promise.all([
        statisticsApi.getOverview(),
        statisticsApi.getDeadlineWarnings()
      ])
      setStatistics(statsResult)
      if (Array.isArray(warningsResult)) {
        setWarnings(warningsResult)
      } else if (warningsResult && Array.isArray(warningsResult.data)) {
        setWarnings(warningsResult.data)
      } else if (warningsResult && Array.isArray(warningsResult.results)) {
        setWarnings(warningsResult.results)
      } else {
        setWarnings([])
      }
    } catch (err) {
      console.error('获取工作台数据失败', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const statCards = [
    {
      title: '订单总数',
      value: statistics?.total_orders || 0,
      icon: <FileSearchOutlined style={{ fontSize: 32, color: '#1677ff' }} />,
      color: 'linear-gradient(135deg, #e6f4ff, #bae0ff)',
      onClick: () => navigate('/orders')
    },
    {
      title: '待核验',
      value: statistics?.pending_verify || 0,
      icon: <ClockCircleOutlined style={{ fontSize: 32, color: '#faad14' }} />,
      color: 'linear-gradient(135deg, #fffbe6, #ffe58f)',
      onClick: () => navigate('/orders')
    },
    {
      title: '核验失败',
      value: statistics?.verify_failed || 0,
      icon: <ExclamationCircleOutlined style={{ fontSize: 32, color: '#ff4d4f' }} />,
      color: 'linear-gradient(135deg, #fff2f0, #ffccc7)',
      onClick: () => navigate('/orders')
    },
    {
      title: '核验完成',
      value: statistics?.verify_completed || 0,
      icon: <CheckCircleOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
      color: 'linear-gradient(135deg, #f6ffed, #b7eb8f)',
      onClick: () => navigate('/orders')
    },
    {
      title: '进行中',
      value: statistics?.in_progress || 0,
      icon: <ClockCircleOutlined style={{ fontSize: 32, color: '#1677ff' }} />,
      color: 'linear-gradient(135deg, #e6f4ff, #91caff)',
      onClick: () => navigate('/orders')
    },
    {
      title: '已归档',
      value: statistics?.archived || 0,
      icon: <CheckCircleOutlined style={{ fontSize: 32, color: '#8c8c8c' }} />,
      color: 'linear-gradient(135deg, #fafafa, #d9d9d9)',
      onClick: () => navigate('/orders')
    }
  ]

  if (loading) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: 100 }}>
          <Spin size="large" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="page-title" style={{ marginBottom: 24, fontSize: 20, fontWeight: 600 }}>工作台</div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map((card, index) => (
          <Col xs={12} sm={8} md={4} key={index}>
            <div className="stat-card" onClick={card.onClick} style={{ background: card.color }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  {card.icon}
                  <span className="stat-label">{card.title}</span>
                </Space>
                <div className="stat-value">{card.value}</div>
              </Space>
            </div>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={24}>
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: '#ff4d4f' }} />
                到期预警
                <Tag color="red">{warnings.length}</Tag>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            {warnings.length > 0 ? (
              <List
                dataSource={warnings}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <a key="view" onClick={() => navigate(`/orders/${item.order_id || item.id}`)}>查看</a>
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <a onClick={() => navigate(`/orders/${item.order_id || item.id}`)}>
                            {item.order_no || item.orderNo}
                          </a>
                          <ModuleTypeBadge type={item.module_type} />
                          <DueWarningBadge daysLeft={item.days_left} deadline={item.deadline} />
                        </Space>
                      }
                      description={
                        <Space wrap>
                          <span style={{ fontWeight: 500 }}>{item.title || item.project_name}</span>
                          <span style={{ color: 'rgba(0,0,0,0.45)' }}>
                            项目：{item.project_name || '-'}
                          </span>
                          <span style={{ color: 'rgba(0,0,0,0.45)' }}>
                            截止：{formatDate(item.deadline, 'YYYY-MM-DD')}
                          </span>
                          {item.days_left !== undefined && item.days_left !== null && (
                            <span style={{ color: 'rgba(0,0,0,0.45)' }}>
                              剩余：{item.days_left >= 0 ? `${item.days_left}天` : `逾期${Math.abs(item.days_left)}天`}
                            </span>
                          )}
                          <span style={{ color: 'rgba(0,0,0,0.45)' }}>
                            处理人：{item.handler || '-'}
                          </span>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(0,0,0,0.45)' }}>
                暂无到期预警订单
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Layout>
  )
}
