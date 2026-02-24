"""
JWT-authenticated WebSocket middleware for Django Channels.
Reads ?token=<jwt> from the WebSocket URL query string and
sets scope['user'] so the consumer can access the authenticated user.
"""
from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from users.models import User


@database_sync_to_async
def get_user_from_token(token_key):
    try:
        token = AccessToken(token_key)
        return User.objects.get(id=token['user_id'])
    except Exception:
        return AnonymousUser()


class JWTAuthMiddleware:
    """Middleware that authenticates WebSocket connections via JWT query param."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode()
        params = parse_qs(query_string)
        token_list = params.get('token', [])
        token_key = token_list[0] if token_list else None

        scope['user'] = await get_user_from_token(token_key) if token_key else AnonymousUser()
        return await self.app(scope, receive, send)
