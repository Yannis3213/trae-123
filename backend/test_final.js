const http = require('http');

function api(method, path, data, user) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const req = http.request({
      hostname: 'localhost', port: 8109,
      path: '/api' + path, method,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': String(user.id),
        'X-Role': user.role
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch(e) { resolve({raw:d}) } });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const doctor = { id: 2, role: 'doctor' };
const director = { id: 3, role: 'director' };
const nurse = { id: 1, role: 'nurse' };

async function run() {
  let pass = 0, fail = 0;
  function check(name, cond, detail) {
    if (cond) { pass++; console.log('  ✅ ' + name); }
    else { fail++; console.log('  ❌ ' + name + (detail ? ' (' + detail + ')' : '')); }
  }

  console.log('=== 1. 初始化数据一致性 ===');
  const r6 = await api('GET', '/visits/6', null, director);
  check('V202606006 status=returned_for_correction', r6.data.status === 'returned_for_correction');
  check('V202606006 exception_type=material', r6.data.exception_type === 'material');
  check('V202606006 correction_action=null', r6.data.correction_action === null);
  check('V202606006 is_overdue=1', r6.data.is_overdue === 1);
  check('V202606006 审计备注>0', r6.data.auditNotes.length > 0);
  check('V202606006 补正历史>0', r6.data.correctionHistory.length > 0);

  const r7 = await api('GET', '/visits/7', null, doctor);
  check('V202606007 status=reprocessing', r7.data.status === 'reprocessing');
  check('V202606007 exception_type=material', r7.data.exception_type === 'material');
  check('V202606007 correction_action有值', !!r7.data.correction_action);

  const r2 = await api('GET', '/visits/2', null, doctor);
  check('V202606002 status=transferred', r2.data.status === 'transferred');
  check('V202606002 exception_type=material', r2.data.exception_type === 'material');
  check('V202606002 material_status=incomplete', r2.data.material_status === 'incomplete');

  console.log('\n=== 2. 补正提交后异常字段应真实清空 ===');
  const submit = await api('POST', '/visits/7/transition', {
    action: 'submit_correction', version: 8,
    evidence_provided: '补正材料、补正说明',
    correction_action: '已完成回访记录补充和处方执行确认'
  }, doctor);
  check('submit_correction成功', submit.success === true);
  check('补正提交后exceptionType=null', submit.exceptionType === null);
  check('补正提交后exceptionReason=null', submit.exceptionReason === null);
  check('补正提交后correctionAction有值', !!submit.correctionAction);

  const r7after = await api('GET', '/visits/7', null, director);
  check('DB中exception_type=null', r7after.data.exception_type === null);
  check('DB中exception_reason=null', r7after.data.exception_reason === null);
  check('DB中material_status=complete', r7after.data.material_status === 'complete');

  console.log('\n=== 3. 补材料恢复后异常字段应清空 ===');
  const resume = await api('POST', '/visits/2/transition', {
    action: 'resume_process', version: 4,
    evidence_provided: '补充材料：X光影像、血常规报告',
    correction_action: '补充X光片和血常规报告'
  }, doctor);
  check('resume_process成功', resume.success === true);
  check('补材料后exceptionType=null', resume.exceptionType === null);

  const r2after = await api('GET', '/visits/2', null, doctor);
  check('DB中exception_type=null', r2after.data.exception_type === null);
  check('DB中material_status=complete', r2after.data.material_status === 'complete');

  console.log('\n=== 4. 归档后所有异常和补正字段应清空 ===');
  const archive = await api('POST', '/visits/5/transition', { action: 'archive', version: 6 }, director);
  check('archive成功', archive.success === true);
  check('归档后exceptionType=null', archive.exceptionType === null);
  check('归档后correctionAction=null', archive.correctionAction === null);

  const r5after = await api('GET', '/visits/5', null, director);
  check('DB中exception_type=null', r5after.data.exception_type === null);
  check('DB中exception_reason=null', r5after.data.exception_reason === null);
  check('DB中correction_action=null', r5after.data.correction_action === null);
  check('DB中is_overdue=0', r5after.data.is_overdue === 0);

  console.log('\n=== 5. 逾期批量推进-逐条拦截 ===');
  const batch = await api('POST', '/visits/overdue-batch', { ids: [1, 3, 9, 999] }, director);
  check('批量总条数=4', batch.total === 4);
  check('成功1条', batch.successCount === 1);
  check('失败3条', batch.failCount === 3);

  const results = batch.results;
  const r1 = results.find(r => r.id === 1);
  check('V202606001 未逾期被拦截(timeline)', r1 && !r1.success && r1.exceptionType === 'timeline');

  const r3 = results.find(r => r.id === 3);
  check('V202606003 逾期推进成功', r3 && r3.success && r3.to === 'processing');

  const r9 = results.find(r => r.id === 9);
  check('V202606009 已归档被拦截(status)', r9 && !r9.success && r9.exceptionType === 'status');

  const r999 = results.find(r => r.id === 999);
  check('ID999 不存在被拦截(material)', r999 && !r999.success && r999.exceptionType === 'material');

  console.log('\n=== 6. 证据不足被拦截 ===');
  const r6init = await api('GET', '/visits/6', null, director);
  const firstAdvance = await api('POST', '/visits/6/transition', {
    action: 'overdue_advance', version: r6init.data.version
  }, director);
  check('returned_for_correction逾期推进无证据成功', firstAdvance.success === true);

  const r6mid = await api('GET', '/visits/6', null, director);
  check('推进后状态=reprocessing', r6mid.data.status === 'reprocessing');

  const noEvidence2 = await api('POST', '/visits/6/transition', {
    action: 'overdue_advance', version: r6mid.data.version
  }, director);
  check('reprocessing逾期推进无证据被拦截(material)', !noEvidence2.success && noEvidence2.exceptionType === 'material');

  console.log('\n=== 7. 版本冲突被拦截 ===');
  const verConflict = await api('POST', '/visits/4/transition', {
    action: 'overdue_advance', version: 1
  }, director);
  check('版本冲突被拦截(status)', !verConflict.success && verConflict.exceptionType === 'status');

  console.log('\n=== 8. 权限不足被拦截 ===');
  const permFail = await api('POST', '/visits/3/transition', {
    action: 'overdue_advance', version: 2
  }, doctor);
  check('医生逾期推进被拒(permission)', !permFail.success && permFail.exceptionType === 'permission');

  const batchAsNurse = await api('POST', '/visits/overdue-batch', {}, nurse);
  check('护士逾期批量被拒', !batchAsNurse.success && batchAsNurse.message.includes('权限'));

  console.log('\n=== 9. 处理记录持久化校验 ===');
  const detail = await api('GET', '/visits/6', null, director);
  const records = detail.data.records;
  check('处理记录包含correction_action', records.some(r => r.correction_action !== null));
  check('处理记录包含exception_type', records.some(r => r.exception_type !== null));

  console.log('\n=== 10. 列表排序和逾期优先 ===');
  const list = await api('GET', '/visits?page_size=20', null, director);
  const firstItem = list.data[0];
  check('列表第一条是逾期状态', firstItem.is_overdue === 1);
  check('列表包含逾期单据', list.data.some(o => o.is_overdue === 1));
  check('列表包含正常单据', list.data.some(o => o.is_overdue === 0));

  console.log('\n' + '═'.repeat(40));
  console.log(`测试结果：✅ 通过 ${pass} / ❌ 失败 ${fail}`);
  console.log('═'.repeat(40));

  if (fail > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
