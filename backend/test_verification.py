import requests
import json

BASE_URL = "http://localhost:8108"

def login(username, password):
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"username": username, "password": password})
    data = resp.json()
    return data["access_token"], resp.status_code

def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def print_result(name, resp):
    print(f"\n{'='*60}")
    print(f"【{name}】")
    print(f"HTTP Status: {resp.status_code}")
    try:
        data = resp.json()
        print(f"Response JSON:\n{json.dumps(data, ensure_ascii=False, indent=2)}")
        return data
    except:
        print(f"Response Text: {resp.text}")
        return None

results = {}

# ============================================================
print("\n" + "#"*60)
print("【验证A - 非登记员禁止创建】")
print("#"*60)

token_s1, _ = login("supervisor1", "123456")
resp_a = requests.post(f"{BASE_URL}/api/applications", headers=headers(token_s1), json={
    "company_name": "测试公司",
    "contact_person": "测试",
    "contact_phone": "13800000001",
    "exhibition_type": "标准展位",
    "booth_area": 9.0
})
data_a = print_result("验证A: supervisor1 创建申请", resp_a)
results["A"] = {
    "http_status": resp_a.status_code,
    "error_code": data_a.get("error_code") if data_a else None,
    "pass": resp_a.status_code == 403 and data_a and data_a.get("error_code") == "ROLE_NOT_ALLOWED"
}

# ============================================================
print("\n" + "#"*60)
print("【验证B - 跨账号访问详情被拒绝】")
print("#"*60)

token_r1, _ = login("registrar1", "123456")
token_r2, _ = login("registrar2", "123456")

resp_b1 = requests.get(f"{BASE_URL}/api/applications/2", headers=headers(token_r1))
data_b1 = print_result("验证B-1: registrar1 访问 EX0002 (id=2, registrar2持有)", resp_b1)
results["B1"] = {
    "http_status": resp_b1.status_code,
    "error_code": data_b1.get("error_code") if data_b1 else None,
    "pass": resp_b1.status_code == 403 and data_b1 and data_b1.get("error_code") == "ACCESS_DENIED"
}

resp_b2 = requests.get(f"{BASE_URL}/api/applications/1", headers=headers(token_r1))
data_b2 = print_result("验证B-2: registrar1 访问 EX0001 (id=1, 自己持有)", resp_b2)
results["B2"] = {
    "http_status": resp_b2.status_code,
    "pass": resp_b2.status_code == 200
}

# ============================================================
print("\n" + "#"*60)
print("【验证C - 跨账号备注被拒】")
print("#"*60)

resp_c1 = requests.post(f"{BASE_URL}/api/applications/2/notes", headers=headers(token_r1), json={"note": "越权测试备注"})
data_c1 = print_result("验证C-1: registrar1 对 EX0002(id=2, 他人持有) 加备注", resp_c1)
results["C1"] = {
    "http_status": resp_c1.status_code,
    "error_code": data_c1.get("error_code") if data_c1 else None,
    "pass": resp_c1.status_code == 403 and data_c1 and data_c1.get("error_code") == "ACCESS_DENIED"
}

resp_c2 = requests.post(f"{BASE_URL}/api/applications/1/notes", headers=headers(token_r1), json={"note": "正常备注测试"})
data_c2 = print_result("验证C-2: registrar1 对 EX0001(id=1, 自己持有) 加备注", resp_c2)
results["C2"] = {
    "http_status": resp_c2.status_code,
    "pass": resp_c2.status_code == 200
}

# ============================================================
print("\n" + "#"*60)
print("【验证D - 批量包含非本账号】")
print("#"*60)

token_l1, _ = login("leader1", "123456")
resp_d = requests.post(f"{BASE_URL}/api/batch/action", headers=headers(token_l1), json={
    "action": "confirm_booth",
    "application_ids": [3, 4]
})
data_d = print_result("验证D: leader1 批量操作 [id=3(leader1持有), id=4(leader2持有)]", resp_d)

if data_d:
    results["D"] = {
        "http_status": resp_d.status_code,
        "success_count": data_d.get("success_count"),
        "fail_count": data_d.get("fail_count"),
        "details": [],
        "pass": False
    }
    for item in data_d.get("results", []):
        app_id = item.get("application_id") or item.get("id")
        ec = item.get("error_code")
        results["D"]["details"].append({"id": app_id, "error_code": ec, "success": item.get("success")})
    
    details = results["D"]["details"]
    id3_result = next((d for d in details if d["id"] == 3), None)
    id4_result = next((d for d in details if d["id"] == 4), None)
    results["D"]["pass"] = (
        data_d.get("fail_count") == 2 and 
        data_d.get("success_count") == 0 and
        id3_result and id3_result.get("error_code") == "OVERDUE_BLOCKED" and
        id4_result and id4_result.get("error_code") == "ACCESS_DENIED"
    )
else:
    results["D"] = {"pass": False}

# ============================================================
print("\n" + "#"*60)
print("【验证E - responsible_person同步为具体账号】")
print("#"*60)

resp_e1 = requests.get(f"{BASE_URL}/api/applications", headers=headers(token_r1))
data_e1_raw = resp_e1.json() if resp_e1.status_code == 200 else None

e1_pass = False
e1_rp_name = None
if data_e1_raw:
    items = data_e1_raw.get("items") or data_e1_raw.get("data") or data_e1_raw
    if isinstance(items, dict):
        items = items.get("items") or items
    if isinstance(items, list):
        for item in items:
            if item.get("id") == 1 or (item.get("application_no") and "0001" in item.get("application_no", "")):
                e1_rp_name = item.get("responsible_person_name")
                e1_pass = e1_rp_name == "李登记员"
                break
    print(f"验证E-1: registrar1 列表中 EX0001 responsible_person_name = '{e1_rp_name}' (期望: '李登记员')")

results["E1"] = {"responsible_person_name": e1_rp_name, "pass": e1_pass}

resp_e2 = requests.get(f"{BASE_URL}/api/applications/2", headers=headers(token_r2))
data_e2 = resp_e2.json() if resp_e2.status_code == 200 else None
e2_rp_name = None
if data_e2 and isinstance(data_e2.get("application"), dict):
    e2_rp_name = data_e2["application"].get("responsible_person_name")
e2_pass = e2_rp_name == "赵登记员"
print(f"验证E-2: registrar2 详情 EX0002 responsible_person_name = '{e2_rp_name}' (期望: '赵登记员')")
if data_e2:
    print_result("验证E-2 详情", resp_e2)
results["E2"] = {"responsible_person_name": e2_rp_name, "pass": e2_pass}

token_l2, _ = login("leader2", "123456")
resp_e3 = requests.get(f"{BASE_URL}/api/applications/4", headers=headers(token_l2))
data_e3 = resp_e3.json() if resp_e3.status_code == 200 else None
e3_rp_name = None
if data_e3 and isinstance(data_e3.get("application"), dict):
    e3_rp_name = data_e3["application"].get("responsible_person_name")
e3_pass = e3_rp_name == "周复核负责人"
print(f"验证E-3: leader2 详情 EX0004 responsible_person_name = '{e3_rp_name}' (期望: '周复核负责人')")
if data_e3:
    print_result("验证E-3 详情", resp_e3)
results["E3"] = {"responsible_person_name": e3_rp_name, "pass": e3_pass}

# ============================================================
print("\n" + "#"*60)
print("【验证F - 异常写入audit_notes】")
print("#"*60)

# 先获取 EX0003 (id=3) 的 version，用 leader1 token
resp_f_pre = requests.get(f"{BASE_URL}/api/applications/3", headers=headers(token_l1))
data_f_pre = resp_f_pre.json() if resp_f_pre.status_code == 200 else None
version_3 = None
if data_f_pre and isinstance(data_f_pre.get("application"), dict):
    version_3 = data_f_pre["application"].get("version")
print(f"EX0003(id=3) 当前 version = {version_3}")

# leader2 操作 EX0003 (current_handler=leader1) 执行 approve_review，触发 HANDLER_CONFLICT
resp_f = requests.post(f"{BASE_URL}/api/applications/3/action", headers=headers(token_l2), json={
    "application_id": 3,
    "action": "approve_review",
    "version": version_3 if version_3 else 4
})
data_f = print_result("验证F-1: leader2 审批 EX0003(id=3, leader1持有) - approve_review", resp_f)

# 检查 audit_notes（用leader1查看）
resp_f2 = requests.get(f"{BASE_URL}/api/applications/3", headers=headers(token_l1))
data_f2 = print_result("验证F-2: 查看 EX0003 详情 audit_notes", resp_f2)

audit_notes = data_f2.get("audit_notes", []) if data_f2 else []
print(f"\naudit_notes 条目数: {len(audit_notes)}")
for i, note in enumerate(audit_notes):
    note_text = note.get("note") or note.get("content") or str(note)
    print(f"  [{i}] {note_text[:300]}")

f_pass = False
for note in audit_notes:
    note_text = str(note.get("note") or note.get("content") or note)
    if "【异常拦截】" in note_text and "HANDLER_CONFLICT" in note_text:
        f_pass = True
        break

results["F"] = {
    "trigger_http_status": resp_f.status_code,
    "trigger_error_code": data_f.get("error_code") if data_f else None,
    "audit_notes_count": len(audit_notes),
    "pass": f_pass
}

# ============================================================
print("\n" + "="*60)
print("【最终结果汇总】")
print("="*60)
all_pass = True
for key, val in results.items():
    p = val.get("pass", False)
    status = "✅ 通过" if p else "❌ 失败"
    all_pass = all_pass and p
    print(f"{key}: {status}  |  细节: {json.dumps(val, ensure_ascii=False)}")

print("\n" + "="*60)
if all_pass:
    print("🎉🎉🎉 所有验证全部通过！")
else:
    print("⚠️  存在未通过的验证项，请查看上方细节。")
print("="*60)
