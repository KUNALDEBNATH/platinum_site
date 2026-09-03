from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView as _TokenRefreshView

from sales.serializers import MyTokenRefreshSerializer
from sales.views import CustomTokenObtainPairView, home


class MyTokenRefreshView(_TokenRefreshView):
    serializer_class = MyTokenRefreshSerializer


urlpatterns = [
    path('', home),
    path('admin/', admin.site.urls),
    path('api/', include('sales.urls')),
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', MyTokenRefreshView.as_view(), name='token_refresh'),
]
