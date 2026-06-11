import { Component } from 'solid-js';
import type { ApplicationStatus } from '../types';
import { STATUS_LABELS, getStatusClass } from '../utils/status';
import classnames from 'classnames';

interface StatusBadgeProps {
  status: ApplicationStatus;
}

const StatusBadge: Component<StatusBadgeProps> = (props) => {
  const badgeClass = classnames('tag', getStatusClass(props.status));

  return <span class={badgeClass}>{STATUS_LABELS[props.status]}</span>;
};

export default StatusBadge;
