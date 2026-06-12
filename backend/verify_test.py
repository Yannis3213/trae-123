import urllib.request
import urllib.error
import json
import os

os.environ['NO_PROXY'] = 'localhost,127.0.0.1'
os.environ['no_proxy'] = 'localhost,127.0.0.1'

BASE_URL = "http://localhost:8108"

def http_request(method, url, headers=None, data=None, timeout=60):
    if headers is None:
        headers = {}
    req_data = None
    if data is not None:
        req_data = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    
    proxy_handler = urllib.request.ProxyHandler({})
    opener = urllib.request.build_opener(proxy_handler)
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with opener.open(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return json.loads(body)
        except:
            return {"error": body, "http_status": e.code}

def login(username, password="123456"):
    r = http_request("POST", f"{BASE_URL}/api/auth/login", data={"username": username, "password": password})
    return r["access_token"], r["user"]

def get_applications(token):
    return http_request("GET", f"{BASE_URL}/api/applications", headers={"Authorization": f"Bearer {token}"})

def get_application_detail(token, app_id):
    r = http_request("GET", f"{BASE_URL}/api/applications/{app_id}", headers={"Authorization": f"Bearer {token}"})
    return r.get("application", r)

def do_action(token, app_id, action, version, **kwargs):
    body = {
        "application_id": app_id,
        "action": action,
        "version": version
    }
    for k, v in kwargs.items():
        if v is not None:
            body[k] = v
    r = http_request("POST", f"{BASE_URL}/api/applications/{app_id}/action", 
                     headers={"Authorization": f"Bearer {token}"},
                     data=body)
    if "application" in r:
        return r["application"]
    return r

def create_application(token, data):
    return http_request("POST", f"{BASE_URL}/api/applications", 
                        headers={"Authorization": f"Bearer {token}"},
                        data=data)

def print_section(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

print_section("验证 B - 按账号过滤列表")

tokens = {}
for user in ["registrar1", "registrar2", "leader1", "leader2", "supervisor1", "supervisor2"]:
    token, user_info = login(user)
    tokens[user] = token
    print(f"  {user} 登录成功: {user_info['name']} ({user_info['role_name']})")

results = {}
for title, user, expected_count, expected_no in [
    ("B-1. registrar1 查看申请列表", "registrar1", 1, "EX202406120001"),
    ("B-2. registrar2 查看申请列表", "registrar2", 1, "EX202406120002"),
    ("B-3. leader1 查看申请列表", "leader1", 1, "EX202406120003"),
    ("B-4. leader2 查看申请列表", "leader2", 1, "EX202406120004"),
]:
    print(f"\n  --- {title} ---")
    data = get_applications(tokens[user])
    items = data.get("items", []) if isinstance(data, dict) else []
    print(f"  实际返回条数: {len(items)}")
    actual_nos = []
    for item in items:
        app_no = item.get("application_no")
        actual_nos.append(app_no)
        print(f"    - {app_no}: status={item.get('status')}, current_handler={item.get('current_handler')}, created_by={item.get('created_by')}")
    
    ok = (len(items) == expected_count) and (expected_no in actual_nos)
    status = "✅ PASS" if ok else "❌ FAIL"
    print(f"  {status}: 期望 {expected_count} 条包含 {expected_no}, 实际 {len(items)} 条 {actual_nos}")
    results[title] = ok

print_section("验证 C - 同角色账号间越权")

EX0003_ID = None
EX0003_VERSION = None
data = get_applications(tokens["leader1"])
for item in data.get("items", []):
    if item.get("application_no") == "EX202406120003":
        EX0003_ID = item.get("id")
        EX0003_VERSION = item.get("version")
        break

print(f"  EX202406120003 ID={EX0003_ID}, version={EX0003_VERSION}")

result = do_action(tokens["leader2"], EX0003_ID, "approve_review", EX0003_VERSION)
print(f"  leader2 越权操作 EX202406120003 返回:")
print(json.dumps(result, indent=2, ensure_ascii=False))

error_code = result.get("error_code") if isinstance(result, dict) else None
ok = (error_code == "HANDLER_CONFLICT")
status = "✅ PASS" if ok else "❌ FAIL"
print(f"  {status}: 期望 error_code=HANDLER_CONFLICT, 实际 error_code={error_code}")
results["C-1. leader2 越权操作 EX202406120003"] = ok

print_section("验证 D - 动态分派轮询")

EX0001_ID = None
EX0001_VERSION = None
data = get_applications(tokens["registrar1"])
for item in data.get("items", []):
    if item.get("application_no") == "EX202406120001":
        EX0001_ID = item.get("id")
        EX0001_VERSION = item.get("version")
        break

print(f"  D-1: EX202406120001 ID={EX0001_ID}, version={EX0001_VERSION}")
result = do_action(tokens["registrar1"], EX0001_ID, "submit", EX0001_VERSION)
print(f"  registrar1 submit EX202406120001 返回:")
print(f"    status={result.get('status')}, current_handler={result.get('current_handler')}, version={result.get('version')}")
first_handler = result.get("current_handler")
first_ok = first_handler in ["supervisor1", "supervisor2"]
status = "✅ PASS" if first_ok else "❌ FAIL"
print(f"  {status}: 第一次分派期望 supervisor1 或 supervisor2, 实际 {first_handler}")
results["D-1. EX0001 submit 第一次分派"] = first_ok

new_app = create_application(tokens["registrar2"], {
    "company_name": "测试动态分派公司",
    "contact_person": "测试",
    "contact_phone": "13800000001",
    "exhibition_type": "标准展位",
    "booth_area": 9.0
})
print(f"\n  D-2: registrar2 创建新申请: {new_app.get('application_no')}, ID={new_app.get('id')}, version={new_app.get('version')}")

new_app_id = new_app.get("id")
new_app_version = new_app.get("version")
result2 = do_action(tokens["registrar2"], new_app_id, "submit", new_app_version)
second_handler = result2.get("current_handler")
print(f"  registrar2 submit 新申请返回:")
print(f"    status={result2.get('status')}, current_handler={second_handler}, version={result2.get('version')}")

second_ok = (second_handler in ["supervisor1", "supervisor2"]) and (second_handler != first_handler)
status = "✅ PASS" if second_ok else "❌ FAIL"
print(f"  {status}: 期望轮询到另一位 supervisor, 第一次={first_handler}, 第二次={second_handler}")
results["D-2. 新申请 submit 轮询分派"] = second_ok

print_section("验证 E - 上一处理人保持")

assigned_supervisor = first_handler
print(f"  E-1: EX0001 被分派给 {assigned_supervisor}")
detail = get_application_detail(tokens[assigned_supervisor], EX0001_ID)
current_version = detail.get("version")
print(f"  EX202406120001 当前 version={current_version}, status={detail.get('status')}")

result_e = do_action(tokens[assigned_supervisor], EX0001_ID, "approve_audit", current_version)
print(f"  {assigned_supervisor} approve_audit 返回:")
print(f"    status={result_e.get('status')}, current_handler={result_e.get('current_handler')}, version={result_e.get('version')}")

e_handler = result_e.get("current_handler")
e_ok = e_handler in ["leader1", "leader2"]
status = "✅ PASS" if e_ok else "❌ FAIL"
print(f"  {status}: 期望分派给 leader1 或 leader2, 实际 {e_handler}")
results["E. approve_audit 后分派 leader"] = e_ok

print_section("验证 F - 归档同步字段保留")

EX0004_ID = None
EX0004_VERSION = None
data = get_applications(tokens["leader2"])
for item in data.get("items", []):
    if item.get("application_no") == "EX202406120004":
        EX0004_ID = item.get("id")
        EX0004_VERSION = item.get("version")
        break

print(f"  EX202406120004 ID={EX0004_ID}, version={EX0004_VERSION}")

detail = get_application_detail(tokens["leader2"], EX0004_ID)
v = detail.get("version")
print(f"  F-a: confirm_booth (version={v})")
r1 = do_action(tokens["leader2"], EX0004_ID, "confirm_booth", v, booth_confirmation_evidence="展位确认函BTH-0004")
print(f"    status={r1.get('status')}, current_handler={r1.get('current_handler')}, version={r1.get('version')}")
v = r1.get("version")

print(f"  F-b: archive (version={v})")
r2 = do_action(tokens["leader2"], EX0004_ID, "archive", v)
print(f"    status={r2.get('status')}, current_handler={r2.get('current_handler')}, version={r2.get('version')}, queue={r2.get('queue')}")
v = r2.get("version")

print(f"  F-c: sync (version={v})")
r3 = do_action(tokens["leader2"], EX0004_ID, "sync", v)
print(f"    status={r3.get('status')}, current_handler={r3.get('current_handler')}, version={r3.get('version')}, queue={r3.get('queue')}, sync_status={r3.get('sync_status')}")

f_ok = (r3.get("queue") == "project_closure" and 
        r3.get("current_handler") == "leader2" and 
        r3.get("sync_status") == "synced" and 
        r3.get("status") == "synced")
status = "✅ PASS" if f_ok else "❌ FAIL"
print(f"  {status}: queue={r3.get('queue')}, current_handler={r3.get('current_handler')}, sync_status={r3.get('sync_status')}, status={r3.get('status')}")
results["F. 归档同步字段保留"] = f_ok

print_section("汇总结果")
all_pass = True
for title, ok in results.items():
    s = "✅" if ok else "❌"
    if not ok:
        all_pass = False
    print(f"  {s} {title}")

print("\n" + "=" * 70)
final = "✅ 所有验证全部通过!" if all_pass else "❌ 存在验证失败, 请检查!"
print(f"  {final}")
print("=" * 70)
