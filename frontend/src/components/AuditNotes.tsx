interface AuditNote {
  id: string;
  noteType: string;
  content: string;
  createdBy: string;
  createdAt: string;
  [key: string]: any;
}

interface AuditNotesProps {
  notes: AuditNote[];
}

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending_sign: { label: '待签收', bg: 'bg-blue-100', text: 'text-blue-700' },
  exception_return: { label: '异常回传', bg: 'bg-amber-100', text: 'text-amber-700' },
  sign_complete: { label: '签收完成', bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

export default function AuditNotes({ notes }: AuditNotesProps) {
  if (!notes || notes.length === 0) {
    return <div className="text-center text-slate-400 py-8">暂无审计备注</div>;
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => {
        const cfg = TYPE_CONFIG[note.noteType] || { label: note.noteType, bg: 'bg-slate-100', text: 'text-slate-700' };
        return (
          <div key={note.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                {cfg.label}
              </span>
              <span className="text-xs text-slate-400">{note.createdAt}</span>
            </div>
            <div className="text-sm text-slate-700">{note.content}</div>
          </div>
        );
      })}
    </div>
  );
}
