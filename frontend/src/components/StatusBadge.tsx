'use client';

import { STATUS_LABELS, STATUS_COLORS, type Status } from '@/types';

interface Props {
  status: Status;
}

export default function StatusBadge({ status }: Props) {
  const label = STATUS_LABELS[status] ?? status;
  const color = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
