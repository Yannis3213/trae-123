import { useState } from 'react';
import { STATUS_NAMES } from '../constants';

export default function ListFilter({ filters, setFilters, statusOptions, onSearch, showClue = true }) {
  const [local, setLocal] = useState({
    recordNo: filters.recordNo || '',
    projectName: filters.projectName || '',
    sideRecordClue: filters.sideRecordClue || '',
    status: filters.status || ''
  });

  const handleChange = (k, v) => {
    setLocal({ ...local, [k]: v });
  };

  const handleSearch = () => {
    const newFilters = { ...filters };
    Object.keys(local).forEach(k => {
      if (local[k]) newFilters[k] = local[k];
      else delete newFilters[k];
    });
    setFilters(newFilters);
    onSearch && onSearch(newFilters);
  };

  const handleReset = () => {
    setLocal({ recordNo: '', projectName: '', sideRecordClue: '', status: '' });
    setFilters({});
    onSearch && onSearch({});
  };

  return (
    <div className="card mb-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="form-label">记录单号</label>
          <input
            type="text"
            className="form-input"
            value={local.recordNo}
            onChange={e => handleChange('recordNo', e.target.value)}
            placeholder="请输入"
          />
        </div>
        <div>
          <label className="form-label">项目名称</label>
          <input
            type="text"
            className="form-input"
            value={local.projectName}
            onChange={e => handleChange('projectName', e.target.value)}
            placeholder="请输入"
          />
        </div>
        {showClue && (
          <div>
            <label className="form-label">旁站记录线索</label>
            <input
              type="text"
              className="form-input"
              value={local.sideRecordClue}
              onChange={e => handleChange('sideRecordClue', e.target.value)}
              placeholder="按线索筛选"
            />
          </div>
        )}
        <div>
          <label className="form-label">状态</label>
          <select
            className="form-select"
            value={local.status}
            onChange={e => handleChange('status', e.target.value)}
          >
            <option value="">全部状态</option>
            {statusOptions && statusOptions.map(s => (
              <option key={s} value={s}>{STATUS_NAMES[s]}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button className="btn btn-primary" onClick={handleSearch}>查询</button>
          <button className="btn btn-default" onClick={handleReset}>重置</button>
        </div>
      </div>
    </div>
  );
}
