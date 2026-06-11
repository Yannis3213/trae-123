import React from 'react';
import { Tag } from 'antd';
import { WARNING_MAP, WARNING_COLOR_MAP } from '../utils/constants';
import type { LegalCase } from '../../types';

interface WarningBadgeProps {
  status?: LegalCase['warning_status'];
  showLabel?: boolean;
}

export default function WarningBadge({ status = 'normal', showLabel = true }: WarningBadgeProps) {
  const label = WARNING_MAP[status] || WARNING_MAP.normal;
  const color = WARNING_COLOR_MAP[status] || WARNING_COLOR_MAP.normal;

  const iconMap: Record<string, React.ReactNode> = {
    normal: <span style={{ color: '#52c41a' }}>●</span>,
    approaching: <span style={{ color: '#faad14' }}>●</span>,
    overdue: <span style={{ color: '#ff4d4f' }}>●</span>,
  };

  return (
    <Tag 
      color={color as any}
      icon={iconMap[status]}
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center',
        margin: 0,
        borderRadius: 4,
        padding: '0 8px',
        height: 24,
        lineHeight: '22px'
      }}
    >
      {showLabel && label}
    </Tag>
  );
}
