import sys
sys.path.insert(0, '.')

from app.main import create_app
from litestar.testing import TestClient
import traceback

app = create_app()
client = TestClient(app, raise_server_exceptions=True)

# 登录
response = client.post('/api/auth/login', json={'username': 'clerk1', 'password': '123456'})
token = response.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

print('=== 测试获取列表 ===')
try:
    response = client.get('/api/enrollments', headers=headers)
    print(f'Status: {response.status_code}')
    print(f'Body: {response.text}')
except Exception as e:
    print(f'Exception: {type(e).__name__}: {e}')
    traceback.print_exc()
