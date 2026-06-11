interface EvidenceData {
  suitability_check?: boolean;
  risk_assessment?: boolean;
  business_opening?: boolean;
}

export default function EvidenceSummary({
  evidence,
  showWarning = false,
  onDetail,
}: {
  evidence: EvidenceData;
  showWarning?: boolean;
  onDetail?: () => void;
}) {
  const items = [
    { label: "客户适当性检查", present: evidence.suitability_check },
    { label: "风险测评状态", present: evidence.risk_assessment },
    { label: "业务开通状态", present: evidence.business_opening },
  ];

  const hasMismatch =
    evidence.suitability_check && evidence.risk_assessment && evidence.business_opening
      ? false
      : !(!evidence.suitability_check && !evidence.risk_assessment && !evidence.business_opening);

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              borderRadius: "var(--radius)",
              background: item.present ? "var(--success-light)" : "var(--danger-light)",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>
            <span style={{ fontSize: 16 }}>{item.present ? "✅" : "❌"}</span>
          </div>
        ))}
      </div>

      {showWarning && hasMismatch && (
        <div
          className="alert alert-warning"
          style={{ marginTop: 12, fontSize: 13 }}
        >
          ⚠️ 客户适当性、风险测评、业务开通不匹配，适当性记录无法推进
        </div>
      )}

      {onDetail && (
        <button
          className="btn btn-primary btn-sm"
          style={{ marginTop: 12, width: "100%" }}
          onClick={onDetail}
        >
          查看详情
        </button>
      )}
    </div>
  );
}
