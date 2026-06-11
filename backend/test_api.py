import sys
sys.path.insert(0, '.')

from app.main import create_app
from litestar.testing import TestClient

app = create_app()
client = TestClient(app)

# 登录
response = client.post('/api/auth/login', json={'username': 'clerk1', 'password': '123456'})
token = response.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

print('=== 测试获取列表 ===')
response = client.get('/api/enrollments', headers=headers)
print(f'Status: {response.status_code}')
data = response.json()
print(f'Total: {data["total"]}')
print(f'First item keys: {list(data["items"][0].keys())}')
print(f'evidence_summary: {data["items"][0].get("evidence_summary")}')
print(f'expiry_status: {data["items"][0].get("expiry_status")}')

print()
print('=== 测试获取详情 ===')
first_id = data['items'][0]['id']
response = client.get(f'/api/enrollments/{first_id}', headers=headers)
print(f'Status: {response.status_code}')
detail = response.json()
print(f'Exceptions count: {len(detail.get("exceptions", []))}')
print(f'Audit logs count: {len(detail.get("audit_logs", []))}')
print(f'Evidence summary: {detail.get("evidence_summary")}')

print()
print('=== 测试越权操作（登记员审核） ===')
response = client.post('/api/enrollments/audit', headers=headers, json={
    'enrollment_id': first_id,
    'passed': True,
    'version': data['items'][0]['version']
})
print(f'Status: {response.status_code}')
resp_json = response.json()
print(f'error_code: {resp_json.get("error_code")}')
print(f'detail: {resp_json.get("detail")}')

print()
print('=== 测试版本冲突 ===')
# 先以审核员身份登录
response = client.post('/api/auth/login', json={'username': 'auditor1', 'password': '123456'})
audit_token = response.json()['access_token']
audit_headers = {'Authorization': f'Bearer {audit_token}'}

# 获取一个待审核的单据
response = client.get('/api/enrollments?status=pending_audit', headers=audit_headers)
print(f'待审核数量: {response.json()["total"]}')
items = response.json()['items']
if items:
    item = items[0]
    print(f'选中单据: {item["id"]}, version={item["version"]}')
    
    # 用旧版本号提交
    response = client.post('/api/enrollments/audit', headers=audit_headers, json={
        'enrollment_id': item['id'],
        'passed': True,
        'version': item['version'] - 1
    })
    print(f'Status: {response.status_code}')
    resp_json = response.json()
    print(f'error_code: {resp_json.get("error_code")}')
    print(f'detail: {resp_json.get("detail")}')

print()
print('=== 测试批量处理 ===')
if items:
    batch_ids = [item['id'] for item in items[:2]]
    print(f'批量审核ID: {batch_ids}')
    
    response = client.post('/api/enrollments/batch/audit', headers=audit_headers, json={
        'enrollment_ids': batch_ids,
        'passed': True,
    })
    print(f'Status: {response.status_code}')
    resp_json = response.json()
    print(f'total: {resp_json.get("total")}')
    print(f'success_count: {resp_json.get("success_count")}')
    print(f'fail_count: {resp_json.get("fail_count")}')
    if resp_json.get('results'):
        for r in resp_json['results']:
            print(f'  - id={r["id"]}, success={r["success"]}, error_code={r.get("error_code")}, error_msg={r.get("error_msg")}')
