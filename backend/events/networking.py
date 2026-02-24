from django.utils import timezone
from datetime import timedelta
from events.models import Registration
from users.models import UserProfile
import logging

logger = logging.getLogger(__name__)

def dispatch_networking_match(user, event):
    """
    IA-Lite: Busca otros asistentes que hayan entrado recientemente y tengan intereses en común.
    Se debería ejecutar en Celery en producción.
    """
    try:
        user_interests = set(user.interests.values_list('name', flat=True))
        if not user_interests:
            return  # No hay intereses para hacer match
    except Exception as e:
        logger.error(f"Error fetching user interests: {e}")
        return

    # 1. Recuperamos a usuarios validados que acaban de pasar en las últimas 2 horas
    two_hours_ago = timezone.now() - timedelta(hours=2)
    recent_checkins = Registration.objects.filter(
        event=event, 
        used=True, 
        attended_at__gte=two_hours_ago
    ).exclude(user=user)
    
    for checkin in recent_checkins:
        try:
            other_user = checkin.user
            other_interests = set(other_user.interests.values_list('name', flat=True))
            
            # 2. IA-Lite: Vectorización Jaccard (intersección simple)
            common = user_interests.intersection(other_interests)
            
            if len(common) >= 2: 
                send_push_notification(
                    user=user,
                    title="⚡ Match de Networking",
                    message=f"¡Ojo! {checkin.user.username} acaba de entrar. Tenéis en común: {', '.join(common)}. ¡Conecta ahora!"
                )
                
                # Opcional: Notificar a la otra persona también
                send_push_notification(
                    user=checkin.user,
                    title="⚡ Match de Networking",
                    message=f"¡Ojo! {user.username} acaba de entrar. Tenéis en común: {', '.join(common)}. ¡Búscalo/a!"
                )
        except Exception:
            continue

def send_push_notification(user, title, message):
    # Dummy function para simular el envío de notificaciones push (ej: Expo Push, Firebase)
    logger.info(f"PUSH to {user.username}: {title} - {message}")
    pass
