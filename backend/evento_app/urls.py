from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import routers
from events.views import EventViewSet, RegistrationViewSet, WalletViewSet, TransactionViewSet
from events.views import ClubViewSet, ClubMembershipViewSet, ClubAccessTokenViewSet
from events.views import ConnectionViewSet, EventPhotoViewSet, EventRatingViewSet
from events.views_clubs import ClubPostViewSet, ClubWallPostViewSet
from notifications.views import NotificationViewSet, ReportViewSet
from users.views import UserViewSet, OAuthCallbackView, InterestTagViewSet
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from events.views_stripe import create_payment_intent, stripe_webhook
from events.stripe_views import (
    stripe_connect_onboard, stripe_connect_status, membership_checkout,
    stripe_webhook as monetization_webhook,
)
from events.views_social import get_social_card


router = routers.DefaultRouter()
router.register(r'events', EventViewSet, basename='event')
router.register(r'registrations', RegistrationViewSet, basename='registration')

router.register(r'users', UserViewSet, basename='user')
router.register(r'interest-tags', InterestTagViewSet, basename='interesttag')
router.register(r'wallets', WalletViewSet, basename='wallet')
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'clubs', ClubViewSet, basename='club')
router.register(r'club-memberships', ClubMembershipViewSet, basename='clubmembership')
router.register(r'connections', ConnectionViewSet, basename='connection')
router.register(r'event-photos', EventPhotoViewSet, basename='eventphoto')
router.register(r'event-ratings', EventRatingViewSet, basename='eventrating')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'reports',       ReportViewSet,       basename='report')
router.register(r'club-posts',    ClubPostViewSet,     basename='clubpost')
router.register(r'club-wall-posts', ClubWallPostViewSet, basename='clubwallpost')
router.register(r'club-tokens', ClubAccessTokenViewSet, basename='clubaccesstoken')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', lambda request: redirect('tickets/')),
    path('api/', include(router.urls)),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/', include('social_django.urls', namespace='social')),
    path('auth/callback/', OAuthCallbackView.as_view(), name='oauth_callback'),
    path('tickets/', include('events.urls')),
    path('api/stripe/create-payment-intent/', create_payment_intent, name='create_payment_intent'),
    path('api/stripe/webhook/', stripe_webhook, name='stripe_webhook'),
    # Monetization — Stripe Connect + Memberships
    path('api/stripe/connect/onboard/',   stripe_connect_onboard,  name='stripe_connect_onboard'),
    path('api/stripe/connect/status/',    stripe_connect_status,   name='stripe_connect_status'),
    path('api/stripe/membership/checkout/', membership_checkout,   name='membership_checkout'),
    path('api/stripe/membership/webhook/', monetization_webhook,   name='monetization_webhook'),
    path('api/social-card/<int:registration_id>/', get_social_card, name='get_social_card'),
]

from django.urls import re_path
from django.views.static import serve

# Serve media files globally (required for production without S3/Cloudinary)
urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

@api_view(['GET'])
@permission_classes([AllowAny])
def debug_db(request):
    return Response({
        'db_engine': settings.DATABASES['default']['ENGINE'],
        'db_name': settings.DATABASES['default']['NAME'],
        'has_database_url': bool(settings.DATABASES['default'].get('HOST'))
    })

urlpatterns += [path('api/debug-db/', debug_db)]
