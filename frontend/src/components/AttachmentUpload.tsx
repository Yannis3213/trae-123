'use client';

import { useRef } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import type { Attachment } from '@/types';
import { useStore } from '@/store';

interface Props {
  repairId: string;
  attachments: Attachment[];
}

export default function AttachmentUpload({ repairId, attachments }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploadAttachment, currentUser, loading } = useStore();

  const handleFile = async (file: File) => {
    if (!currentUser) return;
    await uploadAttachment(repairId, file, currentUser.id);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
      >
        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-500">点击或拖拽文件到此区域上传</p>
        <input ref={fileRef} type="file" className="hidden" onChange={handleChange} />
      </div>
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md">
              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 flex-1 truncate">{a.file_name}</span>
              <span className="text-xs text-gray-400">{formatSize(a.file_size)}</span>
              <a href={a.file_path} target="_blank" rel="noopener noreferrer" className="text-primary text-xs hover:underline">下载</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
