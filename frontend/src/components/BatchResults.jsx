function BatchResults({ results, onClose }) {
  if (!results) return null

  const successCount = results.results?.filter(r => r.success).length || 0
  const failedCount = results.results?.filter(r => !r.success).length || 0

  return (
    <div className="batch-results">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>批量处理结果</h3>
        <button className="btn btn-default btn-sm" onClick={onClose}>关闭</button>
      </div>
      <div className="batch-summary">
        <div className="item">
          处理总数：<span className="value">{results.results?.length || 0}</span>
        </div>
        <div className="item success">
          成功：<span className="value">{successCount}</span>
        </div>
        <div className="item failed">
          失败：<span className="value">{failedCount}</span>
        </div>
      </div>
      <div className="result-list">
        {results.results?.map((result, index) => (
          <div key={index} className={`result-item ${result.success ? 'success' : 'failed'}`}>
            <span className="app-id">{result.application_no}</span>
            <span className="message">{result.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default BatchResults
