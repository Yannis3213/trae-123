import { Suspense } from 'react';
import RecordDetailClient from '@/components/RecordDetailClient';

export default function RecordDetailPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-center">加载中...</div>}>
      <RecordDetailClient />
    </Suspense>
  );
}
