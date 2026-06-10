import React, { useState, useCallback } from 'react';
import { Layout, Menu, Button, Tag, Space } from 'antd';
import {
  FileTextOutlined,
  WarningOutlined,
  BarChartOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import RoleSwitcher from './components/RoleSwitcher';
import ApplicationList from './components/ApplicationList';
import ApplicationDetail from './components/ApplicationDetail';
import ExpiryWarning from './components/ExpiryWarning';
import StatisticsPanel from './components/StatisticsPanel';
import BatchProcess from './components/BatchProcess';
import type { Application } from './types';
import { ROLE_LABELS, getUserInfo } from './constants';

const { Header, Sider, Content } = Layout;

type PageKey = 'applications' | 'expiry' | 'statistics';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageKey>('applications');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<Application[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [globalRefreshKey, setGlobalRefreshKey] = useState(0);
  const [roleKey, setRoleKey] = useState(0);
  const [userSnap, setUserSnap] = useState(getUserInfo());

  const bumpRefresh = useCallback(() => {
    setGlobalRefreshKey((v) => v + 1);
  }, []);

  const handleRoleChange = () => {
    setRoleKey((v) => v + 1);
    setDetailId(null);
    setSelectedIds([]);
    setSelectedRecords([]);
    setUserSnap(getUserInfo());
    bumpRefresh();
  };

  const handleViewDetail = (id: string) => {
    setDetailId(id);
  };

  const handleBack = () => {
    setDetailId(null);
  };

  const handleBatchSelect = useCallback((ids: string[], records: Application[]) => {
    setSelectedIds(ids);
    setSelectedRecords(records);
  }, []);

  const renderContent = () => {
    if (currentPage === 'applications') {
      if (detailId) {
        return (
          <ApplicationDetail
            key={`${detailId}-${globalRefreshKey}`}
            id={detailId}
            onBack={handleBack}
            onRefresh={bumpRefresh}
          />
        );
      }
      return (
        <div>
          {selectedIds.length > 0 && (
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Button type="primary" onClick={() => setBatchOpen(true)}>
                批量处理（已选 {selectedIds.length} 条）
              </Button>
              <Space size={8}>
                <Tag color="blue">{ROLE_LABELS[userSnap.role] || userSnap.role}</Tag>
                <Tag>{userSnap.userName}</Tag>
                <Tag icon={<SyncOutlined />} onClick={bumpRefresh} style={{ cursor: 'pointer' }}>
                  全局刷新 #{globalRefreshKey}
                </Tag>
              </Space>
            </div>
          )}
          <ApplicationList
            key={`${roleKey}-${globalRefreshKey}`}
            onViewDetail={handleViewDetail}
            onBatchSelect={handleBatchSelect}
            refreshKey={globalRefreshKey}
          />
          <BatchProcess
            selectedIds={selectedIds}
            selectedRecords={selectedRecords}
            open={batchOpen}
            onClose={() => setBatchOpen(false)}
            onSuccess={() => {
              setSelectedIds([]);
              setSelectedRecords([]);
              bumpRefresh();
            }}
          />
        </div>
      );
    }

    if (currentPage === 'expiry') {
      return <ExpiryWarning key={`expiry-${roleKey}-${globalRefreshKey}`} onRefresh={bumpRefresh} />;
    }

    if (currentPage === 'statistics') {
      return <StatisticsPanel key={`stats-${roleKey}-${globalRefreshKey}`} onRefresh={bumpRefresh} />;
    }

    return null;
  };

  const menuItems = [
    { key: 'applications', icon: <FileTextOutlined />, label: '租约申请列表' },
    { key: 'expiry', icon: <WarningOutlined />, label: '到期预警' },
    { key: 'statistics', icon: <BarChartOutlined />, label: '统计概览' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 600, whiteSpace: 'nowrap' }}>
          长租公寓-租约申请处理系统
        </div>
        <Space>
          <Tag color="blue">{ROLE_LABELS[userSnap.role] || userSnap.role}</Tag>
          <Tag color="geekblue">{userSnap.userName}</Tag>
          <Tag icon={<SyncOutlined spin={false} />}>全局数据版本 #{globalRefreshKey}</Tag>
          <RoleSwitcher onRoleChange={handleRoleChange} />
        </Space>
      </Header>
      <Layout>
        <Sider width={200} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
          <Menu
            mode="inline"
            selectedKeys={[currentPage]}
            items={menuItems}
            onClick={({ key }) => {
              setCurrentPage(key as PageKey);
              setDetailId(null);
            }}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Content style={{ padding: 24, background: '#fff', minHeight: 280, overflow: 'auto' }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
