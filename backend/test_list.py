import sys
sys.path.insert(0, '.')

from app.main import create_app
from litestar.testing import TestClient

app = create_app()
client = TestClient(app, raise_server_exceptions=False)

# 登录
response = client.post('/api/auth/login', json={'username': 'clerk1', 'password': '123456'})
print(f'登录状态: {response.status_code}')
token = response.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

print()
print('=== 测试获取列表 ===')
response = client.get('/api/enrollments', headers=headers)
print(f'Status: {response.status_code}')
print(f'Body: {response.text}')
