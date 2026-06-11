#!/usr/bin/env python3
import json
import urllib.request
import urllib.error
import os

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

print("=" * 60)
print("1. 登录 (dispatcher)")
s, d = req("POST", "/api/auth/login", {"username": "dispatcher", "password": "123456"})
print(f"   状态: {s}, token: {'OK' if d.get('token') else 'FAIL'}, 用户名: {d.get('user',{}).get('username')}, error: {d.get('error')}")
if s != 200 or not d.get("token"):
    print("   登录失败，退出")
    print(json.dumps(d, ensure_ascii=False, indent=2))
    exit(1)
tok_dispatcher = d["token"]

print()
print("=" * 60)
print("2. 统计接口")
s, d = req("GET", "/api/statistics", token=tok_dispatcher)
print(f"   状态: {s}, 总数: {d.get('total_cases')}, 待补正: {d.get('pending_correction')}, 复核中: {d.get('under_review')}, 办结: {d.get('completed')}")
print(f"   到期: 正常={d.get('normal')}, 临期={d.get('nearing_expiry')}, 逾期={d.get('overdue')}")

print()
print("=" * 60)
print("3. 列表接口（第一页，5条）")
s, d = req("GET", "/api/cases?page=1&page_size=5", token=tok_dispatcher)
print(f"   状态: {s}, total: {d.get('total')}, 返回条数: {len(d.get('items', []))}")
case_ids = []
for item in d.get("items", []):
    case_ids.append(item["id"])
    print(f"   - {item['case_number']} | {item['title'][:20]} | 状态:{item['status']} | 阶段:{item['current_stage']} | 到期:{item['expiry_status']}")
    print(f"     材料:{item['registration_materials_complete']} 派警:{item['dispatch_timeline_met']} 回访:{item['followup_evidence_complete']} | 版本:{item['version']}")
    print(f"     附件数:{len(item.get('attachments', []))} 记录数:{len(item.get('processing_records', []))} 备注数:{len(item.get('audit_notes', []))}")
    if item.get("audit_notes"):
        for n in item["audit_notes"]:
            print(f"       备注[{n['noted_by_name']}]: {n['note'][:40]} 异常原因: {n.get('anomaly_reason')}")

print()
print("=" * 60)
print("4. 详情接口（第一个案件）")
case_id = case_ids[0]
s, d = req("GET", f"/api/cases/{case_id}", token=tok_dispatcher)
print(f"   状态: {s}, 案件: {d.get('case', {}).get('case_number')} | 当前处理人: {d.get('case', {}).get('current_handler_name')}")
print(f"   处理记录: {len(d.get('processing_records', []))}条")
for r in d.get("processing_records", []):
    print(f"     [{r['stage']}] {r['handler_name']}({r['handler_role']}) - {r['action']}")
    print(f"       备注: {r['remarks'][:40]}")

print()
print("=" * 60)
print("5. 测试新建警情登记（dispatcher 角色）")
from datetime import datetime, timedelta, timezone
deadline = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
s, d = req("POST", "/api/cases", {
    "title": "测试新建案件-商铺盗窃案",
    "description": "朝阳路88号便利店内发生盗窃案件，监控拍到嫌疑人",
    "case_type": "刑事案件",
    "location": "朝阳路88号便利店",
    "reporter_name": "刘老板",
    "reporter_phone": "13900139001",
    "deadline": deadline,
}, token=tok_dispatcher)
print(f"   状态: {s}, 案号: {d.get('case_number')}, 标题: {d.get('title')}")
print(f"   状态: {d.get('status')}, 阶段: {d.get('current_stage')}, 创建人: {d.get('created_by_name')}")
if s != 200:
    print(f"   错误: {json.dumps(d, ensure_ascii=False)}")

print()
print("=" * 60)
print("6. 登录 officer 角色，准备办理案件")
s, d = req("POST", "/api/auth/login", {"username": "officer", "password": "123456"})
print(f"   状态: {s}, 姓名: {d.get('user',{}).get('real_name')}, 角色: {d.get('user',{}).get('role')}")
tok_officer = d.get("token")

print()
print("=" * 60)
print("7. officer 获取列表中需要他处理的复核中案件")
s, d = req("GET", "/api/cases?status=under_review&stage=dispatch&page=1&page_size=20", token=tok_officer)
print(f"   状态: {s}, 待处理条数: {len(d.get('items', []))}")
target_case = None
for item in d.get("items", []):
    if item.get("registration_materials_complete") and item.get("dispatch_timeline_met") and item.get("followup_evidence_complete"):
        target_case = item
        break
if target_case:
    print(f"   选择办理: {target_case['case_number']} | 版本: {target_case['version']}")
    print()
    print("8. officer 提交状态变更（移交复核）")
    s, d = req("PUT", "/api/cases/status", {
        "case_id": target_case["id"],
        "to_status": "under_review",
        "remarks": "民警处置完成，派警及时，回访到位，移交所领导复核",
        "version": target_case["version"],
        "registration_materials_complete": True,
        "dispatch_timeline_met": True,
        "followup_evidence_complete": True,
    }, token=tok_officer)
    print(f"   状态: {s}")
    if s == 200:
        print(f"   新状态: {d.get('case',{}).get('status')}, 新阶段: {d.get('case',{}).get('current_stage')}")
        print(f"   新处理人: {d.get('case',{}).get('current_handler_name')}")
    else:
        print(f"   错误: {d.get('error')} - {d.get('message')}")
        if d.get("details"):
            for e in d["details"]["errors"]:
                print(f"     - {e['field']}: {e['message']}")

print()
print("=" * 60)
print("9. 登录 reviewer 角色，批量处理测试")
s, d = req("POST", "/api/auth/login", {"username": "reviewer", "password": "123456"})
print(f"   状态: {s}, 姓名: {d.get('user',{}).get('real_name')}, 角色: {d.get('user',{}).get('role')}")
tok_reviewer = d.get("token")

print()
print("=" * 60)
print("10. reviewer 获取复核阶段案件")
s, d = req("GET", "/api/cases?status=under_review&stage=review&page=1&page_size=20", token=tok_reviewer)
print(f"   状态: {s}, 复核阶段案件: {len(d.get('items', []))}")
batch_cases = []
version_map = {}
for item in d.get("items", []):
    batch_cases.append(item["id"])
    version_map[item["id"]] = item["version"]
    print(f"   - {item['case_number']} | {item['title'][:20]} | 材料:{item['registration_materials_complete']} 派警:{item['dispatch_timeline_met']} 回访:{item['followup_evidence_complete']} 版本:{item['version']}")

if batch_cases:
    print()
    print("11. reviewer 批量办结测试")
    s, d = req("POST", "/api/cases/batch", {
        "case_ids": batch_cases,
        "to_status": "completed",
        "remarks": "月底集中审核，材料齐全，予以办结",
        "version_map": version_map,
    }, token=tok_reviewer)
    print(f"   状态: {s}, 批量处理结果: {len(d)}条")
    for r in d:
        print(f"   - {r['case_number']} | {'成功' if r['success'] else '失败'} | {r['message']}")
        if r.get("error_details"):
            for e in r["error_details"]:
                print(f"     原因: {e}")

print()
print("=" * 60)
print("✅ 主链路测试完成！")
