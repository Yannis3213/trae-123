import urllib.request
import json

def req(method, path, data=None, token=None):
    url = 'http://127.0.0.1:8105' + path
    headers = {'Content-Type': 'application/json'}
    if token: headers['X-Auth-Token'] = token
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        resp = urllib.request.urlopen(r)
        return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

print('=== 1. 登录 nurse01 (护登记员) ===')
st, d = req('POST', '/api/auth/login', {'username':'nurse01','password':'123456'})
print(f'  {st} user={d["user"]["username"]} role={d["user"]["role"]} token={d["token"][:20]}...')
t1 = d['token']

print('=== 2. 登录 shenzhang (护士长/AUDITOR) ===')
st, d = req('POST', '/api/auth/login', {'username':'shenzhang','password':'123456'})
print(f'  {st} user={d["user"]["username"]} role={d["user"]["role"]}')
t2 = d['token']

print('=== 3. 登录 yuanzhu (院区主任/REVIEWER) ===')
st, d = req('POST', '/api/auth/login', {'username':'yuanzhu','password':'123456'})
print(f'  {st} user={d["user"]["username"]} role={d["user"]["role"]}')
t3 = d['token']

print('=== 4. 统计接口 ===')
st, d = req('GET', '/api/stats', token=t1)
print(f'  {st} total={d["total"]} pending_audit={d["pending_audit"]} pending_review={d["pending_review"]} returned={d["returned"]} overdue={d["overdue"]}')

print('=== 5. 护士长查看审核列表(module=verify) ===')
st, d = req('GET', '/api/care-records?module=verify&page_size=5', token=t2)
print(f'  {st} total={d["total"]}')
for i in d['items']:
    print(f'    {i["record_no"]} {i["elder_name"]} {i["status"]} v{i["version"]} missing={len(i["missing_evidence"] or [])}')

print('=== 6. 院区主任查看复核列表(module=review) ===')
st, d = req('GET', '/api/care-records?module=review&page_size=5', token=t3)
print(f'  {st} total={d["total"]}')
for i in d['items']:
    print(f'    {i["record_no"]} {i["elder_name"]} {i["status"]} auditor={i["auditor_name"]}')

print('=== 7. 尝试越权：护理员调审核接口（应该403）===')
st, msg = req('POST', '/api/care-records/2/audit', {'version':2,'passed':True,'remark':'越权测试'}, token=t1)
print(f'  {st} {msg[:100]}')

print('=== 8. 版本冲突测试：用错误版本号提交（应该409）===')
st, d = req('POST', '/api/care-records/9/submit', {'version':999, 'evidence_provided':[]}, token=t1)
print(f'  {st} {str(d)[:150]}')

print('=== 9. 查看单条详情 CR202606080005(逾期异常) ===')
st, d = req('GET', '/api/care-records/5', token=t2)
print(f'  {st} no={d["record_no"]} status={d["status"]} overdue={d["overdue"]} abnormal={d["abnormal_reported"]}')
print(f'    abnormal_reason={d["abnormal_reason"][:40]}')
print(f'    process_records={len(d["process_records"])} audit_notes={len(d["audit_notes"])}')

print('=== 10. 预警接口 ===')
st, d = req('GET', '/api/warnings?warning_type=overdue', token=t3)
print(f'  {st} 逾期条数={len(d)}')
for i in d: print(f'    {i["record_no"]} {i["elder_name"]} overdue={i["overdue"]}')

print('\n✅ 全部接口测试完成')
