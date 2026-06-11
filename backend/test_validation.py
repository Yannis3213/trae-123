#!/usr/bin/env python3
import json
import urllib.request
import urllib.error

BASE = "http://localhost:8107"

def req(method, path, body=None, token=None):
    url = BASE + path
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode()
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def login(u, p):
    s, d = req("POST", "/api/auth/login", {"username": u, "password": p})
    return d.get("token")

print("=" * 60)
tok_dispatcher = login("dispatcher", "123456")
tok_officer = login("officer", "123456")
tok_reviewer = login("reviewer", "123456")
print("三角色登录成功")

print()
print("=" * 60)
print("测试1: officer 角色尝试越权新建案件（应该被拦截）")
from datetime import datetime, timedelta, timezone
deadline = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
s, d = req("POST", "/api/cases", {
    "title": "越权测试-不该创建成功",
    "description": "测试越权", "case_type": "求助", "location": "测试",
    "reporter_name": "测试", "reporter_phone": "138", "deadline": deadline,
}, token=tok_officer)
print(f"   状态: {s}, error: {d.get('error')}, message: {d.get('message')}")
assert s == 403, f"预期403，实际{s}"
print("   ✅ officer 越权新建被拦截")

print()
print("=" * 60)
print("测试2: dispatcher 尝试直接办结案件（应该被拦截-状态冲突）")
s, d = req("GET", "/api/cases?page=1&page_size=1&status=under_review", token=tok_dispatcher)
c = d["items"][0]
print(f"   选择案件: {c['case_number']}, 版本: {c['version']}")
s, d = req("PUT", "/api/cases/status", {
    "case_id": c["id"], "to_status": "completed",
    "remarks": "越权办结", "version": c["version"],
}, token=tok_dispatcher)
print(f"   状态: {s}, error: {d.get('error')}, message: {d.get('message')}")
assert s == 403, f"预期403，实际{s}"
print("   ✅ dispatcher 越权办结被拦截")

print()
print("=" * 60)
print("测试3: 使用错误的版本号提交（旧版本冲突）")
s, d = req("GET", "/api/cases?page=1&page_size=1&status=under_review&stage=dispatch", token=tok_officer)
c = d["items"][0]
print(f"   选择案件: {c['case_number']}, 当前版本: {c['version']}, 提交版本: 1")
s, d = req("PUT", "/api/cases/status", {
    "case_id": c["id"], "to_status": "under_review",
    "remarks": "旧版本测试", "version": 1,
    "registration_materials_complete": True,
    "dispatch_timeline_met": True,
    "followup_evidence_complete": True,
}, token=tok_officer)
print(f"   状态: {s}, error: {d.get('error')}, message: {d.get('message')}")
assert s == 409, f"预期409，实际{s}"
print("   ✅ 旧版本提交被拦截")

print()
print("=" * 60)
print("测试4: 未携带 token 访问列表（401）")
s, d = req("GET", "/api/cases?page=1&page_size=1")
print(f"   状态: {s}, error: {d.get('error')}, message: {d.get('message')}")
assert s == 401, f"预期401，实际{s}"
print("   ✅ 未授权访问被拦截")

print()
print("=" * 60)
print("测试5: 办结时校验证据完整性（缺证据被拦截）")
s, d = req("GET", "/api/cases?page=1&page_size=20&status=under_review&stage=review", token=tok_reviewer)
target = None
for item in d["items"]:
    if not item["registration_materials_complete"] or not item["dispatch_timeline_met"] or not item["followup_evidence_complete"]:
        target = item
        break
if target:
    print(f"   选择缺证据案件: {target['case_number']}, 材料:{target['registration_materials_complete']} 派警:{target['dispatch_timeline_met']} 回访:{target['followup_evidence_complete']}")
    s, d = req("PUT", "/api/cases/status", {
        "case_id": target["id"], "to_status": "completed",
        "remarks": "办结测试", "version": target["version"],
    }, token=tok_reviewer)
    print(f"   状态: {s}, error: {d.get('error')}, message: {d.get('message')}")
    if d.get("details"):
        for e in d["details"]["errors"]:
            print(f"     - {e['field']}: {e['message']}")
    assert s == 400, f"预期400，实际{s}"
    print("   ✅ 缺证据办结被拦截")
else:
    print("   没有找到缺证据的复核中案件（跳过）")

print()
print("=" * 60)
print("测试6: dispatcher 提交补正（从待补正→复核中）")
s, d = req("GET", "/api/cases?page=1&page_size=20&status=pending_correction", token=tok_dispatcher)
if d["items"]:
    c = d["items"][0]
    print(f"   选择待补正案件: {c['case_number']}, 版本: {c['version']}")
    s, d = req("PUT", "/api/cases/status", {
        "case_id": c["id"], "to_status": "under_review",
        "remarks": "已补正材料，重新提交",
        "version": c["version"],
        "registration_materials_complete": True,
        "followup_evidence_complete": True,
    }, token=tok_dispatcher)
    print(f"   状态: {s}, 新状态: {d.get('status') if s == 200 else d.get('error')}")
    assert s == 200, f"预期200，实际{s}: {d}"
    print("   ✅ 补正提交成功")
else:
    print("   没有待补正案件（跳过）")

print()
print("=" * 60)
print("测试7: reviewer 退回补正（复核中→待补正）")
s, d = req("GET", "/api/cases?page=1&page_size=20&status=under_review", token=tok_reviewer)
c = None
for item in d["items"]:
    if item["current_stage"] in ("dispatch", "review"):
        c = item
        break
if c:
    print(f"   选择复核中案件: {c['case_number']}, 阶段: {c['current_stage']}, 版本: {c['version']}")
    s, d = req("PUT", "/api/cases/status", {
        "case_id": c["id"], "to_status": "pending_correction",
        "remarks": "材料不完整，退回补正",
        "version": c["version"],
    }, token=tok_reviewer)
    print(f"   状态: {s}, 新状态: {d.get('status') if s == 200 else d.get('error')}, message: {d.get('message')}")
    assert s == 200, f"预期200，实际{s}: {d}"
    print("   ✅ 退回补正成功")
else:
    print("   没有复核中案件（跳过）")

print()
print("=" * 60)
print("✅ 全部服务端校验测试通过！")
