import json
from django.utils import timezone
from channels.generic.websocket import AsyncWebsocketConsumer


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    Personal WebSocket channel for each authenticated user.
    Group name: user_{user_id}

    The frontend connects to: ws://<host>/ws/notifications/
    JWT token is passed as ?token=<access_token> query param
    (validated by JWTAuthMiddleware in routing.py).
    """

    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return

        self.group_name = f'user_{user.id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Send a welcome ping so the frontend knows the connection is live
        await self.send(text_data=json.dumps({
            'type': 'connected',
            'message': f'Conectado. Grupo: {self.group_name}',
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        """Client can send pings to keep the connection alive."""
        try:
            data = json.loads(text_data)
            if data.get('type') == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
        except json.JSONDecodeError:
            pass

    # ─── Group message handlers (called by channel_layer.group_send) ─────────

    async def notification_message(self, event):
        """Relay a new notification to the connected client."""
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'id': event.get('id'),
            'title': event.get('title'),
            'body': event.get('body', ''),
            'notif_type': event.get('notif_type', 'system'),
            'data': event.get('data', {}),
        }))


class LobbyConsumer(AsyncWebsocketConsumer):
    """
    WebSocket channel for an event's Social Lobby.
    Group name: lobby_{event_id}
    """

    async def connect(self):
        self.event_id = self.scope['url_route']['kwargs']['event_id']
        self.user = self.scope.get('user')
        
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4401)
            return

        self.group_name = f'lobby_{self.event_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Broadcast joining (unless ghost mode - handled by client sending a 'join' type)

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            # Broadcast leave
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'lobby.presence',
                    'action': 'leave',
                    'user_id': self.user.id
                }
            )
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get('type')

        if msg_type == 'join':
            # Broadcast join with user info
            ghost = data.get('ghost', False)
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'lobby.presence',
                    'action': 'join',
                    'user_id': self.user.id,
                    'username': self.user.username,
                    'avatar_url': getattr(self.user, 'avatar_url', ''), # Helper for frontend
                    'ghost': ghost
                }
            )

        elif msg_type == 'chat':
            # Broadcast chat message
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'lobby.chat',
                    'user_id': self.user.id,
                    'username': self.user.username,
                    'message': data.get('message'),
                    'timestamp': timezone.now().isoformat() if 'django.utils.timezone' in globals() else None
                }
            )

        elif msg_type == 'wave':
            # Send salute to target user
            target_id = data.get('target_id')
            await self.channel_layer.group_send(
                f'user_{target_id}',
                {
                    'type': 'notification.message',
                    'title': '¡Saludo en el Lobby! 👋',
                    'body': f'{self.user.username} te ha saludado.',
                    'notif_type': 'social',
                    'data': {'event_id': self.event_id, 'from_user_id': self.user.id}
                }
            )

    # ─── Group Handlers ───────────────────────────────────────────────────────

    async def lobby_presence(self, event):
        await self.send(text_data=json.dumps(event))

    async def lobby_chat(self, event):
        await self.send(text_data=json.dumps(event))
