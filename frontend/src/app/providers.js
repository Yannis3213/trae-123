'use client';

import { ConfigProvider, App as AntdApp } from 'antd';
import { AuthProvider } from '../context/AuthContext';

export default function Providers({ children }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
        },
      }}
    >
      <AntdApp>
        <AuthProvider>
          {children}
        </AuthProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
