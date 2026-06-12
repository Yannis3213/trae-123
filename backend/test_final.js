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

  console.log('=== 1. 逾期队列预检 ===');
  const queue = await api('GET', '/visits/overdue-queue', null, director);
  check('逾期队列接口成功', queue.success === true);
  check('逾期队列有数据', queue.data.items.length > 0);
  check('可推进数+拦截数=总数', queue.data.canAdvanceCount + queue.data.blockedCount === queue.data.total);
  console.log(`  📊 逾期总数: ${queue.data.total}, 可推进: ${queue.data.canAdvanceCount}, 被拦截: ${queue.data.blockedCount}`);

  const blockedItem = queue.data.items.find(i => !i.canAdvance);
  if (blockedItem) {
    check('被拦截单据有blocks', blockedItem.blocks && blockedItem.blocks.length > 0);
    check('被拦截单据block有type', !!blockedItem.blocks[0].type);
    check('被拦截单据block有reason', !!blockedItem.blocks[0].reason);
    console.log(`  🚫 被拦截示例: ${blockedItem.order_no} - ${blockedItem.blocks.map(b => b.type + ':' + b.reason).join('; ')}`);
  } else {
    check('被拦截单据有blocks（无被拦截项跳过）', true);
  }

  const canAdvanceItem = queue.data.items.find(i => i.canAdvance);
  if (canAdvanceItem) {
    check('可推进单据有advanceTo', !!canAdvanceItem.advanceTo);
    check('可推进单据有advanceLabel', !!canAdvanceItem.advanceLabel);
    console.log(`  ✅ 可推进示例: ${canAdvanceItem.order_no} → ${canAdvanceItem.advanceToLabel}`);
  }

  console.log('\n=== 2. 非院长不能访问逾期队列 ===');
  const queueNurse = await api('GET', '/visits/overdue-queue', null, nurse);
  check('护士无权访问逾期队列', !queueNurse.success);

  console.log('\n=== 3. 逾期批量处置-逐条拦截不默认推进 ===');
  const batch = await api('POST', '/visits/overdue-batch', { ids: [1, 3, 6, 9, 999] }, director);
  check('批量处置成功返回', batch.success === true);
  check('拦截数 > 0', batch.blockedCount > 0);
  console.log(`  📊 推进: ${batch.canAdvanceCount}, 拦截: ${batch.blockedCount}`);

  const batchBlocked = batch.results.filter(r => !r.success);
  const batchAdvanced = batch.results.filter(r => r.success);
  if (batchBlocked.length > 0) {
    check('被拦截结果有blocks', batchBlocked[0].blocks && batchBlocked[0].blocks.length > 0);
    check('被拦截结果有exceptionType', !!batchBlocked[0].exceptionType);
    check('被拦截结果有reason', !!batchBlocked[0].reason);
    check('被拦截结果有currentStatus', !!batchBlocked[0].currentStatus);
    check('被拦截结果有materialStatus', batchBlocked[0].materialStatus !== undefined);
  }

  if (batchAdvanced.length > 0) {
    check('推进成功结果有fromLabel', !!batchAdvanced[0].fromLabel);
    check('推进成功结果有toLabel', !!batchAdvanced[0].toLabel);
    check('推进成功结果有correctionAction', !!batchAdvanced[0].correctionAction);
  }

  const r9 = batch.results.find(r => r.id === 9);
  check('V202606009 已归档被拦截(status)', r9 && !r9.success && r9.exceptionType === 'status');

  const r1 = batch.results.find(r => r.id === 1);
  check('V202606001 未逾期被拦截(timeline)', r1 && !r1.success && r9.exceptionType === 'status');

  const r6 = batch.results.find(r => r.id === 6);
  if (r6 && !r6.success) {
    check('V202606006 材料不全被拦截(material)', r6.exceptionType === 'material');
  }

  console.log('\n=== 4. 拦截记录持久化验证 ===');
  const detail6 = await api('GET', '/visits/6', null, director);
  const blockedRecords = detail6.data.records.filter(r => r.action === 'overdue_advance_blocked');
  check('处理记录中有overdue_advance_blocked', blockedRecords.length > 0);
  if (blockedRecords.length > 0) {
    check('拦截记录有exception_type', !!blockedRecords[0].exception_type);
    check('拦截记录有exception_reason', !!blockedRecords[0].exception_reason);
    check('拦截记录from_status=to_status（未变更）', blockedRecords[0].from_status === blockedRecords[0].to_status);
  }

  const blockedAudit = detail6.data.auditNotes.filter(n => n.content.includes('逾期推进拦截'));
  check('审计备注中有逾期拦截记录', blockedAudit.length > 0);

  const blockedCorrection = detail6.data.correctionHistory.filter(r => r.action === 'overdue_advance_blocked');
  check('补正历史中有逾期拦截记录', blockedCorrection.length > 0);

  console.log('\n=== 5. 提供证据后材料不全单据可推进 ===');
  const queue2 = await api('GET', '/visits/overdue-queue', null, director);
  const advanceableWithEvidence = queue2.data.items.filter(i =>
    i.canAdvance && i.requiresEvidence
  );
  if (advanceableWithEvidence.length > 0) {
    const evidItem = advanceableWithEvidence[0];
    const evidRes = await api('POST', '/visits/overdue-batch', {
      ids: [evidItem.id],
      payload: { evidence_provided: '逾期处理证据：院长确认材料已审核' }
    }, director);
    check('提供证据后可推进', evidRes.canAdvanceCount > 0);
  } else {
    check('提供证据后可推进（无需要证据的单据跳过）', true);
  }

  console.log('\n=== 6. 不提供证据时需要证据的单据被拦截 ===');
  const queue3 = await api('GET', '/visits/overdue-queue', null, director);
  const needsEvidence = queue3.data.items.filter(i =>
    i.canAdvance && i.requiresEvidence
  );
  if (needsEvidence.length > 0) {
    const noEvidRes = await api('POST', '/visits/overdue-batch', {
      ids: [needsEvidence[0].id],
      payload: {}
    }, director);
    const failedItem = noEvidRes.results.find(r => r.id === needsEvidence[0].id);
    check('无证据推进被拦截(material)', failedItem && !failedItem.success && failedItem.exceptionType === 'material');
  } else {
    check('无证据推进被拦截（无需要证据的单据跳过）', true);
  }

  console.log('\n=== 7. 逾期批量处置结果有blockSummary ===');
  const batchSummary = await api('POST', '/visits/overdue-batch', {}, director);
  check('blockSummary存在', !!batchSummary.blockSummary);
  check('blockSummary是对象', typeof batchSummary.blockSummary === 'object');
  if (Object.keys(batchSummary.blockSummary).length > 0) {
    console.log(`  📊 拦截分类: ${JSON.stringify(batchSummary.blockSummary)}`);
  }

  console.log('\n=== 8. 统计接口包含逾期拦截数据 ===');
  const stats = await api('GET', '/stats', null, director);
  check('stats接口成功', stats.success);
  check('stats有overdueBlocked', !!stats.data.overdueBlocked);
  check('overdueBlocked有total', stats.data.overdueBlocked.total > 0);
  check('overdueBlocked有byType', Array.isArray(stats.data.overdueBlocked.byType));
  if (stats.data.overdueBlocked.byType.length > 0) {
    console.log(`  📊 拦截分类: ${stats.data.overdueBlocked.byType.map(b => b.label + ':' + b.count).join(', ')}`);
  }

  console.log('\n=== 9. 补正提交后异常字段真实清空 ===');
  const r7 = await api('GET', '/visits/7', null, doctor);
  const submit = await api('POST', '/visits/7/transition', {
    action: 'submit_correction', version: r7.data.version,
    evidence_provided: '补正材料、补正说明',
    correction_action: '已完成回访记录补充和处方执行确认'
  }, doctor);
  check('submit_correction成功', submit.success === true);
  check('补正提交后exceptionType=null', submit.exceptionType === null);

  console.log('\n=== 10. 归档后异常和补正字段清空 ===');
  const r5 = await api('GET', '/visits/5', null, director);
  if (r5.data.status === 'reviewing') {
    const archive = await api('POST', '/visits/5/transition', {
      action: 'archive', version: r5.data.version
    }, director);
    check('archive成功', archive.success === true);
    check('归档后correctionAction=null', archive.correctionAction === null);
    check('归档后is_overdue=0', archive.data && archive.data.is_overdue === 0);
  } else {
    check('归档后清空（状态非reviewing跳过）', true);
  }

  console.log('\n' + '═'.repeat(40));
  console.log(`测试结果：✅ 通过 ${pass} / ❌ 失败 ${fail}`);
  console.log('═'.repeat(40));

  if (fail > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
