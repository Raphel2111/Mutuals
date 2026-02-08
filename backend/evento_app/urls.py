from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import routers
from events.views import EventViewSet, RegistrationViewSet, WalletViewSet, TransactionViewSet
from events.views import DistributionGroupViewSet
from events.views import GroupAccessTokenViewSet
from users.views import UserViewSet, OAuthCallbackView
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

router = routers.DefaultRouter()
router.register(r'events', EventViewSet, basename='event')
router.register(r'registrations', RegistrationViewSet, basename='registration')
router.register(r'groups', DistributionGroupViewSet, basename='group')
router.register(r'group-tokens', GroupAccessTokenViewSet, basename='groupaccesstoken')
router.register(r'users', UserViewSet, basename='user')
router.register(r'wallets', WalletViewSet, basename='wallet')
router.register(r'transactions', TransactionViewSet, basename='transaction')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', lambda request: redirect('tickets/')),
    path('api/', include(router.urls)),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/', include('social_django.urls', namespace='social')),
    path('auth/callback/', OAuthCallbackView.as_view(), name='oauth_callback'),
    path('tickets/', include('events.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
