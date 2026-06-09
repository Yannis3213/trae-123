from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from lab_appointment.api import api

urlpatterns = [
    path('api/', api.urls),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
