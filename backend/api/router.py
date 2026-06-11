from ninja import NinjaAPI

from .auth import auth_router
from .listings_api import listings_router
from .batch_api import batch_router
from .export_api import export_router
from .audit_api import audit_router

api = NinjaAPI(
    title='二手车交易平台 - 月底集中处理车源上架单系统',
    version='1.0.0',
    docs_url='/docs',
)

api.add_router('auth/', auth_router, tags=['认证'])
api.add_router('listings/', listings_router, tags=['车源上架单'])
api.add_router('batch/', batch_router, tags=['批量处理'])
api.add_router('export/', export_router, tags=['数据导出'])
api.add_router('audit/', audit_router, tags=['审计追踪'])
