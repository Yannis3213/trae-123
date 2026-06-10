import { createSignal, For, Show } from 'solid-js';

export default function PatchModal(props) {
  const [form, setForm] = createSignal({ ...(props.record || {}) });
  const [err, setErr] = createSignal('');

  function updateField(k, v) {
    setForm({ ...form(), [k]: v });
  }

  function confirm() {
    const patch = {};
    const original = props.record || {};
    for (const f of props.fields) {
      const v = form()[f.k];
      if (String(v || '') !== String(original[f.k] || '')) {
        patch[f.k] = v;
      }
    }
    if (Object.keys(patch).length === 0) {
      setErr('未修改任何字段');
      return;
    }
    props.onDone && props.onDone(patch);
  }

  return (
    <div class="modal-mask" onClick={e => e.target === e.currentTarget && props.onClose()}>
      <div class="modal">
        <div class="modal-header">
          <h3>✏️ {props.title}</h3>
          <span class="close-btn" onClick={props.onClose}>×</span>
        </div>
        <div class="modal-body">
          <div class="alert alert-info mb-3"><span class="alert-icon">💡</span>修改后的字段将在办理提交时同步保存到原始记录中（并写入处理记录）。</div>
          <div class="grid-2">
            {props.fields.map(f => (
              <div class="field-row">
                <label>{f.label}</label>
                <input value={form()[f.k] ?? ''} onInput={e => updateField(f.k, e.target.value)} />
              </div>
            ))}
          </div>
          {err() && <div class="alert alert-danger mt-3"><span class="alert-icon">⚠️</span>{err()}</div>}
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" onClick={props.onClose}>取消</button>
          <button class="btn btn-primary" onClick={confirm}>保存修改</button>
        </div>
      </div>
    </div>
  );
}
