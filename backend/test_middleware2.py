import sys
sys.path.insert(0, '.')

from litestar import Litestar, get
from litestar.testing import TestClient
from litestar.types import ASGIApp, Receive, Scope, Send

def simple_middleware(app: ASGIApp) -> ASGIApp:
    async def middleware(scope: Scope, receive: Receive, send: Send) -> None:
        if scope['type'] != 'http':
            await app(scope, receive, send)
            return
        
        path = scope.get('path', '')
        print(f'Path: {path}')
        
        if path == '/api/health':
            print('Skipping auth for health')
            await app(scope, receive, send)
            return
        
        print('Would check auth here')
        await app(scope, receive, send)
    
    return middleware

@get('/health')
async def health_check() -> dict:
    return {'status': 'ok'}

app = Litestar(
    route_handlers=[health_check],
    path='/api',
    middleware=[simple_middleware],
)

client = TestClient(app, raise_server_exceptions=True)
try:
    response = client.get('/api/health')
    print(f'Status: {response.status_code}')
    print(f'Body: {response.text}')
except Exception as e:
    import traceback
    print(f'Error type: {type(e).__name__}')
    print(f'Error: {e}')
    traceback.print_exc()
