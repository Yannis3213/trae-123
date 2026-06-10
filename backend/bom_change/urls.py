from django.contrib import admin
from django.urls import path
from ninja import NinjaAPI
from material_change.api import router as material_router
from material_change.auth_api import router as auth_router

api = NinjaAPI(
    title='物料变更单系统 API',
    version='1.0.0',
    description='电子元器件工厂月底集中处理物料变更单系统',
    csrf=False,
)

api.add_router('/auth', auth_router)
api.add_router('/material', material_router)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', api.urls),
]
