// @refresh reload
import { Router } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { Suspense } from 'solid-js';
import './app.css';

export default function App() {
  return (
    <Router root={(props) => (
      <Suspense fallback={<div class="flex items-center justify-center h-screen text-gray-500">加载中...</div>}>
        {props.children}
      </Suspense>
    )}>
      <FileRoutes />
    </Router>
  );
}
