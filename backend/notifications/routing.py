from django.urls import re_path
from .consumers import NotificationConsumer, LobbyConsumer

websocket_urlpatterns = [
    re_path(r'ws/notifications/$', NotificationConsumer.as_asgi()),
    re_path(r'ws/lobby/(?P<event_id>\w+)/$', LobbyConsumer.as_asgi()),
]
