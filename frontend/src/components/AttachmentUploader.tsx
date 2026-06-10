import { useState } from 'react';
import { applicationApi } from '../api/client';

interface AttachmentUploaderProps {
  applicationId: string;
  applicationStatus: string;
  currentHandler: string;
  currentUserId: string | null;
  onUploaded: () => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AttachmentUploader({
  applicationId,
  applicationStatus,
  currentHandler,
  currentUserId,
  onUploaded,
}: AttachmentUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canUpload =
    currentUserId &&
    currentHandler === currentUserId &&
    applicationStatus !== 'archived';

  const isCompulsory =
    applicationStatus === 'exception_returned' ||
    applicationStatus === 'correction_pending';

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError('');
    setSuccess('');
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        let base64: string | undefined;
        if (isCompulsory) {
          base64 = await fileToBase64(file);
        }
        await applicationApi.uploadAttachment(applicationId, {
          application_id: applicationId,
          file_name: file.name,
          file_type: file.type || 'application/octet-stream',
          file_content_base64: base64,
        });
      }
      setSuccess(`成功上传 ${files.length} 个附件${isCompulsory ? '（已作为补正证据记录入轨迹）' : ''}`);
      onUploaded();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || '上传失败');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div style={{ marginTop: '8px' }}>
      {isCompulsory && (
        <div
          style={{
            padding: '8px 12px',
            background: '#fef3c7',
            color: '#92400e',
            borderRadius: '6px',
            fontSize: '13px',
            marginBottom: '10px',
          }}
        >
          ⚠️ 当前状态为「{applicationStatus === 'exception_returned' ? '异常回传' : '待补正'}」，
          上传的附件将作为<strong>补正证据</strong>同时写入处理记录和异常轨迹，禁止绕过详情直接提交。
        </div>
      )}
      {!canUpload ? (
        <div style={{ color: '#9ca3af', fontSize: '13px' }}>
          {applicationStatus === 'archived'
            ? '已归档单据禁止上传附件'
            : '只有当前处理人可以上传附件'}
        </div>
      ) : (
        <>
          <label className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            📎 {uploading ? '上传中...' : '上传附件'}
            <input
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={handleFile}
              disabled={uploading}
            />
          </label>
          <span style={{ marginLeft: '10px', fontSize: '12px', color: '#6b7280' }}>
            {isCompulsory ? '必须上传（补正证据）' : '可选，支持多选'}
          </span>
        </>
      )}
      {error && <div className="error-text" style={{ marginTop: '8px' }}>{error}</div>}
      {success && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            background: '#dcfce7',
            color: '#166534',
            borderRadius: '6px',
            fontSize: '13px',
          }}
        >
          ✅ {success}
        </div>
      )}
    </div>
  );
}
