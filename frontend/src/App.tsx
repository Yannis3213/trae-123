import '@solidjs/start/reset';
import './app.css';
import { Router } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { Suspense } from 'solid-js';
import { AuthProvider } from './components/AuthProvider';

export default function App() {
  return (
    <AuthProvider>
      <Router root={(props) => (
        <Suspense fallback={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <div style={{ color: '#999' }}>加载中...</div>
          </div>
        }>
          {props.children}
        </Suspense>
      )}>
        <FileRoutes />
      </Router>
    </AuthProvider>
  );
}
