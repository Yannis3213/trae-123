import dayjs from 'dayjs';
import {
  STATUS_MAP,
  PRIORITY_MAP,
  ROLE_MAP,
  WARNING_MAP,
  QUEUE_MAP,
  ACTION_MAP,
} from './constants';

export const formatDate = (
  date: string | null | undefined,
  format: string = 'YYYY-MM-DD HH:mm:ss'
): string => {
  if (!date) return '-';
  return dayjs(date).format(format);
};

export const formatDateOnly = (
  date: string | null | undefined
): string => {
  if (!date) return '-';
  return dayjs(date).format('YYYY-MM-DD');
};

export const formatStatus = (status: string): string => {
  return STATUS_MAP[status as keyof typeof STATUS_MAP] || status;
};

export const formatPriority = (priority: string): string => {
  return PRIORITY_MAP[priority as keyof typeof PRIORITY_MAP] || priority;
};

export const formatRole = (role: string): string => {
  return ROLE_MAP[role as keyof typeof ROLE_MAP] || role;
};

export const formatWarning = (warning: string | null | undefined): string => {
  if (!warning) return '-';
  return WARNING_MAP[warning] || warning;
};

export const formatQueue = (queue: string): string => {
  return QUEUE_MAP[queue] || queue;
};

export const formatAction = (action: string): string => {
  return ACTION_MAP[action] || action;
};

export const formatBoolean = (value: number | boolean | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  return value ? '是' : '否';
};

export const formatFileSize = (bytes: number | null | undefined): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return '-';
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};

export const formatIdCard = (idCard: string | null | undefined): string => {
  if (!idCard) return '-';
  if (idCard.length < 8) return idCard;
  return `${idCard.slice(0, 6)}********${idCard.slice(-4)}`;
};

export const fromNow = (date: string | null | undefined): string => {
  if (!date) return '-';
  return dayjs(date).fromNow();
};
