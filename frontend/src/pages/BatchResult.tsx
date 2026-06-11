import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, List, Tag, Button, Space, Empty, Result, Alert, Statistic, Row, Col, Descriptions, Divider } from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, ArrowLeftOutlined,
  FileTextOutlined, EyeOutlined, UserOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import { BatchResultItem, ROLE_LABEL, STATUS_LABEL } from '../api';
import dayjs from 'dayjs';

export default function BatchResult() {
  const navigate = useNavigate();
  const [results, setResults] = useState<BatchResultItem[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem('lastBatchResult');
    if (raw) {
      try {
        setResults(JSON.parse(raw));
      } catch {}
    }
  }, []);

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  if (results.length === 0) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <Space>
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>返回列表</Button>
              <span className="page-title">批量处理结果</span>
            </Space>
          </div>
        </div>
        <Empty description="暂无批量处理结果，请先从列表批量处理入库单" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>返回列表</Button>
            <span className="page-title">批量处理结果</span>
          </Space>
        </div>
        <Space>
          <Button type="primary" onClick={() => navigate('/orders')}>返回列表继续处理</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <div className="stats-card">
            <div className="stats-number" style={{ color: '#1677ff' }}>{results.length}</div>
            <div className="stats-label">处理总数</div>
          </div>
        </Col>
        <Col span={8}>
          <div className="stats-card">
            <div className="stats-number" style={{ color: '#52c41a' }}>{successCount}</div>
            <div className="stats-label">成功</div>
          </div>
        </Col>
        <Col span={8}>
          <div className="stats-card">
            <div className="stats-number" style={{ color: '#ff4d4f' }}>{failCount}</div>
            <div className="stats-label">失败</div>
          </div>
        </Col>
      </Row>

      <Card title="📋 处理明细" size="small">
        <List
          itemLayout="horizontal"
          dataSource={results}
          renderItem={(item) => (
                <List.Item
                  className={item.success ? 'batch-result-success' : 'batch-result-fail'}
                  style={{
                    border: `1px solid ${item.success ? '#b7eb8f' : '#ffccc7'}`,
                    borderRadius: 8,
                    marginBottom: 8,
                    padding: '12px 16px',
                    background: item.success ? '#f6ffed' : '#fff2f0',
                  }}
                  actions={[
                    <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/orders/${item.order_id}`)}>
                      查看详情
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      item.success
                        ? <CheckCircleOutlined style={{ fontSize: 28, color: '#52c41a' }} />
                        : <CloseCircleOutlined style={{ fontSize: 28, color: '#ff4d4f' }} />
                    }
                    title={
                      <Space>
                        <span style={{ fontSize: 15, fontWeight: 600 }}>
                          <FileTextOutlined /> {item.order_no}
                        </span>
                        <Tag color={item.success ? 'green' : 'red'}>
                          {item.success ? '处理成功' : '处理失败'}
                        </Tag>
                        {item.new_status && (
                          <Tag color={item.new_status === 'rechecked' ? 'success' : item.new_status === 'exception' ? 'warning' : 'processing'}>
                            {item.new_status_display || STATUS_LABEL[item.new_status] || item.new_status}
                          </Tag>
                        )}
                        {item.new_version !== undefined && (
                          <Tag color="blue" style={{ fontSize: 12 }}>v{item.new_version}</Tag>
                        )}
                        {(item.exception_count ?? 0) > 0 && (
                          <Tag color="volcano" style={{ fontSize: 12 }} title={item.exception_latest || ''}>
                            异常{item.exception_count}条
                          </Tag>
                        )}
                      </Space>
                    }
                    description={
                      <div>
                        <Alert
                          type={item.success ? 'success' : 'error'}
                          showIcon
                          message={item.message}
                          style={{ marginBottom: 8 }}
                        />
                        {(item.new_status || item.current_handler_name || item.last_opinion || (item.exception_count ?? 0) > 0) && (
                          <Descriptions column={2} size="small" style={{ marginTop: 8 }}>
                            <Descriptions.Item label="当前处理人">
                              {item.current_handler_name ? (
                                <>
                                  <UserOutlined /> {item.current_handler_name}
                                  <span style={{ color: '#8c8c8c', marginLeft: 6 }}>
                                    ({item.current_handler_role ? ROLE_LABEL[item.current_handler_role] : '-'})
                                  </span>
                                </>
                              ) : (
                                <span style={{ color: '#bfbfbf' }}>-</span>
                              )}
                            </Descriptions.Item>
                            <Descriptions.Item label="版本">
                              {item.new_version !== undefined ? (
                                <Tag color="blue" style={{ fontSize: 12 }}>v{item.new_version}</Tag>
                              ) : (
                                <span style={{ color: '#bfbfbf' }}>-</span>
                              )}
                            </Descriptions.Item>
                            {(item.exception_count ?? 0) > 0 && (
                              <Descriptions.Item label="异常原因" span={2}>
                                <Tag color="volcano" style={{ fontSize: 12 }}>异常{item.exception_count}条</Tag>
                                <span style={{ marginLeft: 8, fontSize: 12, color: '#1f1f1f' }}>
                                  {item.exception_latest}
                                </span>
                              </Descriptions.Item>
                            )}
                            {item.last_opinion && (
                              <Descriptions.Item label="上一处理意见" span={2}>
                                <div style={{ background: '#f5f5f5', padding: '6px 10px', borderRadius: 4, fontSize: 12 }}>
                                  {item.last_opinion}
                                </div>
                              </Descriptions.Item>
                            )}
                          </Descriptions>
                        )}
                        <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 6 }}>
                          单据ID: {item.order_id}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
        />
      </Card>
    </div>
  );
}
