import React, { useState, useCallback } from 'react';
import { Layout, Menu, Button } from 'antd';
import {
  FileTextOutlined,
  WarningOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import RoleSwitcher from './components/RoleSwitcher';
import ApplicationList from './components/ApplicationList';
import ApplicationDetail from './components/ApplicationDetail';
import ExpiryWarning from './components/ExpiryWarning';
import StatisticsPanel from './components/StatisticsPanel';
import BatchProcess from './components/BatchProcess';

const { Header, Sider, Content } = Layout;

type PageKey = 'applications' | 'expiry' | 'statistics';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageKey>('applications');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [, setRoleVersion] = useState(0);

  const handleRoleChange = () => {
    setRoleVersion((v) => v + 1);
  };

  const handleViewDetail = (id: string) => {
    setDetailId(id);
  };

  const handleBack = () => {
    setDetailId(null);
  };

  const handleBatchSelect = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);

  const renderContent = () => {
    if (currentPage === 'applications') {
      if (detailId) {
        return <ApplicationDetail id={detailId} onBack={handleBack} />;
      }
      return (
        <div>
          {selectedIds.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Button type="primary" onClick={() => setBatchOpen(true)}>
                批量处理（已选 {selectedIds.length} 条）
              </Button>
            </div>
          )}
          <ApplicationList onViewDetail={handleViewDetail} onBatchSelect={handleBatchSelect} />
          <BatchProcess
            selectedIds={selectedIds}
            open={batchOpen}
            onClose={() => setBatchOpen(false)}
            onSuccess={() => setSelectedIds([])}
          />
        </div>
      );
    }

    if (currentPage === 'expiry') {
      return <ExpiryWarning />;
    }

    if (currentPage === 'statistics') {
      return <StatisticsPanel />;
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
        <RoleSwitcher onRoleChange={handleRoleChange} />
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
