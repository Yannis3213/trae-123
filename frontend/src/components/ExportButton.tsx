import React from 'react';
import { Button, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { exportApplications } from '../api/application';
import type { ApplicationStatus, ExpiryStatus } from '../types';

interface ExportButtonProps {
  status?: ApplicationStatus;
  expiryStatus?: ExpiryStatus;
  keyword?: string;
}

const ExportButton: React.FC<ExportButtonProps> = ({ status, expiryStatus, keyword }) => {
  const [loading, setLoading] = React.useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      await exportApplications({
        status,
        expiry_status: expiryStatus,
        keyword,
      });
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button icon={<DownloadOutlined />} loading={loading} onClick={handleExport}>
      导出当前筛选结果
    </Button>
  );
};

export default ExportButton;
