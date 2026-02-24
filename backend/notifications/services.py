import json
import channels.layers
from asgiref.sync import async_to_sync
from .models import Notification


def send_notification(user, title, body='', type='system', data=None):
    """
    Create a persisted Notification and push it to the user's personal
    WebSocket group so it arrives in real time.
    """
    notif = Notification.objects.create(
        user=user,
        title=title,
        body=body,
        type=type,
        data_json=data or {},
    )

    # Push via WebSocket to the personal group
    channel_layer = channels.layers.get_channel_layer()
    if channel_layer:
        try:
            async_to_sync(channel_layer.group_send)(
                f'user_{user.id}',
                {
                    'type': 'notification.message',
                    'id': notif.id,
                    'title': title,
                    'body': body,
                    'notif_type': type,
                    'data': data or {},
                }
            )
        except Exception:
            pass  # WebSocket not available — notification is still persisted

    return notif
