import { useRef } from "react";
import { ATTACHMENT_CATEGORY_LABELS, ATTACHMENT_CATEGORY_COLORS } from "~/utils/status";
import type { Attachment } from "~/utils/api";
import { uploadAttachment, deleteAttachment } from "~/utils/api";

interface AttachmentListProps {
  requestId: number;
  attachments: Attachment[];
  onRefresh: () => void;
  readOnly?: boolean;
}

export default function AttachmentList({ requestId, attachments, onRefresh, readOnly = false }: AttachmentListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    const category = categoryRef.current?.value || "other";
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await uploadAttachment(requestId, {
          file_name: file.name,
          file_data: base64,
          file_type: file.type || "application/octet-stream",
          category,
        });
        onRefresh();
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert("上传失败: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDelete = async (attachmentId: number) => {
    if (!confirm("确定要删除此附件吗？")) return;
    try {
      await deleteAttachment(attachmentId);
      onRefresh();
    } catch (err) {
      alert("删除失败: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const grouped = attachments.reduce<Record<string, Attachment[]>>((acc, att) => {
    const cat = att.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(att);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex items-end gap-3 bg-gray-50 rounded-lg p-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">选择文件</label>
            <input
              ref={fileInputRef}
              type="file"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">类别</label>
            <select
              ref={categoryRef}
              defaultValue="other"
              className="block rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="brief">Brief</option>
              <option value="schedule">排期</option>
              <option value="creative_material">创意素材</option>
              <option value="other">其他</option>
            </select>
          </div>
          <button
            onClick={handleUpload}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            上传
          </button>
        </div>
      )}

      {attachments.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm">暂无附件</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ATTACHMENT_CATEGORY_COLORS[category] || "bg-gray-100 text-gray-700"}`}>
                  {ATTACHMENT_CATEGORY_LABELS[category] || category}
                </span>
                <span className="text-xs text-gray-400">({items.length})</span>
              </div>
              <div className="space-y-1">
                {items.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span className="text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">
                        {att.file_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        用户{att.uploaded_by} · {new Date(att.uploaded_at).toLocaleString("zh-CN")}
                      </span>
                      {!readOnly && (
                        <button
                          onClick={() => handleDelete(att.id)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
