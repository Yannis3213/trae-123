import { Component, For } from 'solid-js';
import type { Attachment } from '../types';
import dayjs from 'dayjs';

interface AttachmentsListProps {
  attachments: Attachment[];
}

const getFileIcon = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return '📄';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return '🖼️';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx'].includes(ext)) return '📊';
  if (['zip', 'rar', '7z'].includes(ext)) return '🗜️';
  return '📎';
};

const AttachmentsList: Component<AttachmentsListProps> = (props) => {
  return (
    <div>
      {props.attachments.length === 0 ? (
        <div style={{ color: '#999', 'font-size': '14px', padding: '16px 0' }}>
          暂无附件
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            'grid-template-columns': 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '12px',
          }}
        >
          <For each={props.attachments}>
            {(attachment) => (
              <a
                href={attachment.file_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  gap: '12px',
                  padding: '12px',
                  border: '1px solid #f0f0f0',
                  'border-radius': '4px',
                  transition: 'all 0.2s',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#1890ff';
                  e.currentTarget.style.background = '#f0f8ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#f0f0f0';
                  e.currentTarget.style.background = '#fff';
                }}
              >
                <span style={{ 'font-size': '28px' }}>
                  {getFileIcon(attachment.file_name)}
                </span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div
                    style={{
                      'font-size': '14px',
                      color: '#333',
                      overflow: 'hidden',
                      'text-overflow': 'ellipsis',
                      'white-space': 'nowrap',
                      marginBottom: '4px',
                    }}
                    title={attachment.file_name}
                  >
                    {attachment.file_name}
                  </div>
                  <div style={{ 'font-size': '12px', color: '#999' }}>
                    {attachment.file_type || '文件'}
                    {attachment.evidence_type && ` · ${attachment.evidence_type}`}
                    {' · '}
                    {dayjs(attachment.uploaded_at).format('YYYY-MM-DD')}
                  </div>
                </div>
              </a>
            )}
          </For>
        </div>
      )}
    </div>
  );
};

export default AttachmentsList;
