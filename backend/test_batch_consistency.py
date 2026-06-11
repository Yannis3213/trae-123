"""
端到端测试：批量办理一致性业务闭环
1. 后端 batch/process 事务正确性：取锁、状态比对、写入在同一事务
2. 旧版本或状态变化逐条失败
3. advance-overdue 只写失败结果，不推进状态
4. SQLite 处理记录与审计备注保存完整信息
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.test import Client
from django.contrib.sessions.backends.db import SessionStore
from listings.models import (
    VehicleListingApplication, ProcessingRecord, AuditNote,
    Operator, ApplicationStatus
)
from django.utils import timezone

client = Client()

def login(role='EVALUATOR'):
    op = Operator.objects.filter(role=role).first()
    session = SessionStore()
    session['operator_id'] = op.id
    session.create()
    client.cookies['sessionid'] = session.session_key
    return op

def reset_db():
    # 重新初始化（按外键依赖顺序删除）
    from init_db import run
    from listings.models import Attachment
    AuditNote.objects.all().delete()
    ProcessingRecord.objects.all().delete()
    Attachment.objects.all().delete()
    VehicleListingApplication.objects.all().delete()
    Operator.objects.all().delete()
    run()

print("=" * 60)
print("【测试 0】重新初始化数据库")
print("=" * 60)
reset_db()
print(f"✅ 单据总数: {VehicleListingApplication.objects.count()}")
print(f"✅ 操作人总数: {Operator.objects.count()}")

# ============================================================
print("\n" + "=" * 60)
print("【测试 1】缺少页面状态 -> 逐条失败")
print("=" * 60)
op = login('EVALUATOR')
apps = list(VehicleListingApplication.objects.filter(
    status__in=[ApplicationStatus.PENDING_PROCESS, ApplicationStatus.PROCESSING]
)[:1])
assert len(apps) >= 1, "需要至少1条可处理的单据"
app1 = apps[0]
original_status = app1.status
original_version = app1.version
original_records = ProcessingRecord.objects.filter(application=app1).count()
original_notes = AuditNote.objects.filter(application=app1).count()

resp = client.post('/api/batch/process', [{
    'application_id': app1.id,
    'action': 'process',
    'remark': 'test missing status',
    'status': '',  # 缺少状态
    'version': original_version,
}], content_type='application/json')
data = resp.json()
print(f"响应: {data}")
assert len(data) == 1
assert data[0]['success'] == False
assert '缺少页面状态参数' in data[0]['reason']

# 验证状态未变更
app1.refresh_from_db()
assert app1.status == original_status, f"状态不应变更: {app1.status} vs {original_status}"
assert app1.version == original_version, f"版本不应变更"

# 验证 DB 记录（增量）
new_records = ProcessingRecord.objects.filter(application=app1).count() - original_records
new_notes = AuditNote.objects.filter(application=app1).count() - original_notes
assert new_records == 1, f"应新增1条处理记录，实际{new_records}"
assert new_notes == 1, f"应新增1条审计备注，实际{new_notes}"
pr = ProcessingRecord.objects.filter(application=app1).latest('created_at')
assert pr.from_status == pr.to_status == original_status, f"失败场景前后状态应相同"
assert '缺少页面状态参数' in pr.failure_reason
print("✅ Test 1 PASS: 缺状态逐条失败，状态未变，DB记录完整")

# ============================================================
print("\n" + "=" * 60)
print("【测试 2】缺少页面版本 -> 逐条失败")
print("=" * 60)
app2 = VehicleListingApplication.objects.filter(
    status__in=[ApplicationStatus.PENDING_PROCESS, ApplicationStatus.PROCESSING]
).exclude(id=app1.id).first()
assert app2, "需要另一条可处理的单据"
original_status2 = app2.status
original_version2 = app2.version

resp = client.post('/api/batch/process', [{
    'application_id': app2.id,
    'action': 'process',
    'remark': 'test missing version',
    'status': app2.status,
    'version': 0,  # 缺少版本
}], content_type='application/json')
data = resp.json()
print(f"响应: {data}")
assert len(data) == 1
assert data[0]['success'] == False
assert '缺少页面版本参数' in data[0]['reason']

app2.refresh_from_db()
assert app2.status == original_status2
assert app2.version == original_version2
pr = ProcessingRecord.objects.filter(application=app2).latest('created_at')
assert pr.from_status == pr.to_status == original_status2
assert '缺少页面版本参数' in pr.failure_reason
print("✅ Test 2 PASS: 缺版本逐条失败，状态未变，DB记录完整")

# ============================================================
print("\n" + "=" * 60)
print("【测试 3】版本冲突（并发冲突）-> 逐条失败")
print("=" * 60)
app3 = VehicleListingApplication.objects.filter(
    status__in=[ApplicationStatus.PENDING_PROCESS, ApplicationStatus.PROCESSING]
).exclude(id__in=[app1.id, app2.id]).first()
assert app3, "需要另一条可处理的单据"
original_status3 = app3.status
original_version3 = app3.version

resp = client.post('/api/batch/process', [{
    'application_id': app3.id,
    'action': 'process',
    'remark': 'test version conflict',
    'status': app3.status,
    'version': 999,  # 错误版本
}], content_type='application/json')
data = resp.json()
print(f"响应: {data}")
assert len(data) == 1
assert data[0]['success'] == False
assert '并发冲突' in data[0]['reason'] or '版本冲突' in data[0]['reason']

app3.refresh_from_db()
assert app3.status == original_status3
assert app3.version == original_version3
pr = ProcessingRecord.objects.filter(application=app3).latest('created_at')
assert pr.from_status == pr.to_status == original_status3
assert '并发冲突' in pr.failure_reason or '版本冲突' in pr.failure_reason
print("✅ Test 3 PASS: 版本冲突逐条失败，状态未变，DB记录完整")

# ============================================================
print("\n" + "=" * 60)
print("【测试 4】状态与版本正确匹配 -> 成功推进")
print("=" * 60)
app4 = VehicleListingApplication.objects.filter(
    status__in=[ApplicationStatus.PENDING_PROCESS, ApplicationStatus.PROCESSING]
).exclude(id__in=[app1.id, app2.id, app3.id]).first()
assert app4, "需要另一条可处理的单据"
original_status4 = app4.status
original_version4 = app4.version

resp = client.post('/api/batch/process', [{
    'application_id': app4.id,
    'action': 'process',
    'remark': 'test correct match',
    'status': app4.status,
    'version': app4.version,
}], content_type='application/json')
data = resp.json()
print(f"响应: {data}")
assert len(data) == 1
assert data[0]['success'] == True
assert '成功' in data[0]['reason']

app4.refresh_from_db()
assert app4.status == ApplicationStatus.UNDER_REVIEW, f"状态应推进到复核中，实际{app4.status}"
assert app4.version == original_version4 + 1, f"版本应+1"
assert app4.evaluator_id == op.id

pr = ProcessingRecord.objects.filter(application=app4).latest('created_at')
assert pr.from_status == original_status4
assert pr.to_status == ApplicationStatus.UNDER_REVIEW
assert pr.from_status != pr.to_status, "成功场景前后状态应不同"
assert pr.operator_id == op.id
print("✅ Test 4 PASS: 匹配正确，成功推进，版本+1，DB记录完整")

# ============================================================
print("\n" + "=" * 60)
print("【测试 5】混合批量：1条正确 + 1条冲突 -> 部分成功")
print("=" * 60)
app5_correct = VehicleListingApplication.objects.filter(
    status__in=[ApplicationStatus.PENDING_PROCESS, ApplicationStatus.PROCESSING]
).exclude(id__in=[app1.id, app2.id, app3.id, app4.id]).first()
assert app5_correct, "需要另一条可处理的单据"
app5_conflict = app4  # 刚被修改过，使用旧版本会冲突

original_status5 = app5_correct.status
original_version5 = app5_correct.version
conflict_old_version = app4.version  # 当前版本

resp = client.post('/api/batch/process', [
    {
        'application_id': app5_correct.id,
        'action': 'process',
        'remark': 'mixed: correct',
        'status': app5_correct.status,
        'version': app5_correct.version,
    },
    {
        'application_id': app5_conflict.id,
        'action': 'process',
        'remark': 'mixed: conflict',
        'status': app5_conflict.status,
        'version': conflict_old_version - 1,  # 旧版本，应冲突
    },
], content_type='application/json')
data = resp.json()
print(f"响应: {data}")
assert len(data) == 2

correct_result = [r for r in data if r['application_id'] == app5_correct.id][0]
conflict_result = [r for r in data if r['application_id'] == app5_conflict.id][0]

assert correct_result['success'] == True, f"正确条目应成功: {correct_result}"
assert conflict_result['success'] == False, f"冲突条目应失败: {conflict_result}"

# 验证DB
app5_correct.refresh_from_db()
assert app5_correct.status == ApplicationStatus.UNDER_REVIEW
assert app5_correct.version == original_version5 + 1

app5_conflict.refresh_from_db()
assert app5_conflict.version == conflict_old_version, f"冲突条目版本不应变"

print("✅ Test 5 PASS: 混合批量部分成功，正确条目推进，冲突条目拦截")

# ============================================================
print("\n" + "=" * 60)
print("【测试 6】advance-overdue：全部失败、无状态变更、记录责任人")
print("=" * 60)
# 先将某条单据设为逾期
from datetime import timedelta
app6 = VehicleListingApplication.objects.filter(
    status__in=[ApplicationStatus.PENDING_PROCESS, ApplicationStatus.PROCESSING]
).exclude(id__in=[app1.id, app2.id, app3.id, app4.id, app5_correct.id]).first()
if not app6:
    app6 = VehicleListingApplication.objects.exclude(status=ApplicationStatus.COMPLETED).first()
assert app6, "需要至少1条未办结单据"

original_status6 = app6.status
original_version6 = app6.version

# 设为逾期
app6.deadline = timezone.now() - timedelta(days=1)
app6.save()

before_records = ProcessingRecord.objects.count()
before_notes = AuditNote.objects.count()

resp = client.post('/api/batch/advance-overdue')
data = resp.json()
print(f"响应条目数: {len(data)}")
print(f"全失败: {all(not r['success'] for r in data)}")

# 检查所有条目均失败且状态未变
all_failed = all(not r['success'] for r in data)
assert all_failed, "所有逾期条目均应返回失败"

for r in data:
    # 检查失败原因含责任人信息
    print(f"  - {r['application_no']}: {r['reason'][:80]}...")
    assert '逾期拦截' in r['reason'] or '负责人' in r['reason'], f"失败原因应含逾期责任人: {r['reason']}"

# 验证状态未变更
app6.refresh_from_db()
assert app6.status == original_status6, f"逾期推进不应改变状态: {app6.status}"
assert app6.version == original_version6, f"逾期推进不应改变版本"

# 验证DB记录
after_records = ProcessingRecord.objects.count()
after_notes = AuditNote.objects.count()
print(f"处理记录: {before_records} -> {after_records}")
print(f"审计备注: {before_notes} -> {after_notes}")
assert after_records > before_records, "逾期处理应写入处理记录"
assert after_notes > before_notes, "逾期处理应写入审计备注"

# 检查逾期记录的DB字段
overdue_records = ProcessingRecord.objects.filter(action='batch_advance_overdue')
assert overdue_records.exists()
for pr in overdue_records:
    assert pr.from_status == pr.to_status, "逾期推进失败前后状态应相同"
    assert pr.failure_reason, "逾期推进应有失败原因"
    assert '逾期' in pr.failure_reason or '负责人' in pr.failure_reason
    an = AuditNote.objects.filter(application=pr.application, failure_reason__isnull=False).latest('created_at')
    assert an.failure_reason == pr.failure_reason, "审计备注与处理记录失败原因应一致"

print("✅ Test 6 PASS: advance-overdue 全部失败，无状态变更，DB记录含责任人")

# ============================================================
print("\n" + "=" * 60)
print("【测试 7】DB 记录完整性检查")
print("=" * 60)
total_pr = ProcessingRecord.objects.count()
total_an = AuditNote.objects.count()
print(f"总处理记录数: {total_pr}")
print(f"总审计备注数: {total_an}")

failure_prs = ProcessingRecord.objects.filter(failure_reason__isnull=False).exclude(failure_reason='')
print(f"含失败原因的处理记录: {failure_prs.count()}")

reasons_by_category = {}
for pr in failure_prs:
    reason = pr.failure_reason
    if '并发冲突' in reason or '版本冲突' in reason:
        cat = '并发/版本冲突'
    elif '缺少页面状态' in reason:
        cat = '页面缺状态'
    elif '缺少页面版本' in reason:
        cat = '页面缺版本'
    elif '逾期' in reason or '负责人' in reason:
        cat = '逾期责任人'
    elif '越权' in reason:
        cat = '越权'
    elif '缺挂牌' in reason or '证据' in reason:
        cat = '证据不足'
    else:
        cat = '其他'
    reasons_by_category[cat] = reasons_by_category.get(cat, 0) + 1

print("失败原因分类统计:")
for cat, count in sorted(reasons_by_category.items()):
    print(f"  - {cat}: {count} 条")

expected_categories = {'并发/版本冲突', '页面缺状态', '页面缺版本', '逾期责任人'}
actual_categories = set(reasons_by_category.keys())
print(f"\n期望分类: {expected_categories}")
print(f"实际分类: {actual_categories}")
assert expected_categories.issubset(actual_categories), f"缺少分类: {expected_categories - actual_categories}"

print("✅ Test 7 PASS: DB记录分类完整（并发冲突/页面缺字段/逾期责任人）")

# ============================================================
print("\n" + "=" * 60)
print("【测试 8】前后状态字段检查")
print("=" * 60)
for pr in ProcessingRecord.objects.all():
    action_display = f"{pr.action}(成功)" if not pr.failure_reason else f"{pr.action}(失败)"
    if pr.failure_reason:
        assert pr.from_status == pr.to_status, f"{action_display}失败: 前后状态应相同 {pr.from_status}->{pr.to_status}"
    else:
        assert pr.from_status != pr.to_status, f"{action_display}成功: 前后状态应不同 {pr.from_status}->{pr.to_status}"
    assert pr.from_status is not None
    assert pr.to_status is not None

print(f"✅ Test 8 PASS: 所有{ProcessingRecord.objects.count()}条处理记录的前后状态正确")

# ============================================================
print("\n" + "=" * 60)
print("🎉 所有测试通过！")
print("=" * 60)
