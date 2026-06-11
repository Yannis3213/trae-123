import { Component } from 'solid-js';
import type { WarningLevel } from '../types';
import classnames from 'classnames';
import dayjs from 'dayjs';

interface WarningTagProps {
  dueDate: string;
  isOverdue: boolean;
}

const WARNING_LABELS: Record<WarningLevel, string> = {
  normal: '正常',
  near: '临期',
  overdue: '逾期',
};

function calcWarningLevel(dueDate: string, isOverdue: boolean): { level: WarningLevel; days: number } {
  if (isOverdue) {
    const days = dayjs().diff(dayjs(dueDate), 'day');
    return { level: 'overdue', days: Math.max(1, days) };
  }
  const days = dayjs(dueDate).diff(dayjs(), 'day');
  if (days <= 3) {
    return { level: 'near', days: Math.max(0, days) };
  }
  return { level: 'normal', days };
}

const WarningTag: Component<WarningTagProps> = (props) => {
  const result = () => calcWarningLevel(props.dueDate, props.isOverdue);
  const tagClass = () => classnames('tag', `warning-${result().level}`);

  const label = () => {
    const { level, days } = result();
    if (level === 'overdue') {
      return `已逾期${days}天`;
    } else if (level === 'near') {
      return days === 0 ? '今日到期' : `剩余${days}天`;
    }
    return WARNING_LABELS[level];
  };

  return <span class={tagClass()}>{label()}</span>;
};

export default WarningTag;
