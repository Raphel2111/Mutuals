"""
Django signals that fire notifications when key social events occur.
Connect these in notifications/apps.py → ready()
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from events.models import Connection, EventPhoto
from .services import send_notification


@receiver(post_save, sender=Connection)
def on_connection_created(sender, instance, created, **kwargs):
    """Notify the recipient when someone sends a connection request."""
    if created and instance.status == 'pending':
        send_notification(
            user=instance.to_user,
            title=f'🤝 {instance.from_user.first_name or instance.from_user.username} quiere conectar contigo',
            body=f'Os conocisteis en "{instance.event.name if instance.event else "un evento"}".',
            type='connection_request',
            data={
                'connection_id': instance.id,
                'from_user_id': instance.from_user.id,
                'event_id': instance.event.id if instance.event else None,
            }
        )

    # Notify on confirmation
    if not created and instance.status == 'confirmed':
        # Notify both parties
        for target_user in [instance.from_user, instance.to_user]:
            other = instance.to_user if target_user == instance.from_user else instance.from_user
            send_notification(
                user=target_user,
                title=f'🎉 ¡Nueva conexión confirmada con {other.first_name or other.username}!',
                body='Revisa tu Red para verla.',
                type='match',
                data={'connection_id': instance.id}
            )


@receiver(post_save, sender=EventPhoto)
def on_photo_uploaded(sender, instance, created, **kwargs):
    """
    When the first photo is uploaded to an event, notify all other attendees
    that the Mutual Memories wall is live.
    """
    if not created:
        return

    from events.models import Registration
    # Only fire for the first photo
    photo_count = EventPhoto.objects.filter(event=instance.event).count()
    if photo_count != 1:
        return

    attendees = Registration.objects.filter(
        event=instance.event, status='valid'
    ).exclude(user=instance.user).select_related('user', 'event__clubs')

    # Resolve club name for richer copy
    from events.models import Club
    club = Club.objects.filter(events=instance.event).first()
    club_name = club.name if club else instance.event.name

    for reg in attendees:
        if reg.user:
            send_notification(
                user=reg.user,
                title='📸 ¡Memorias desbloqueadas!',
                body=(
                    f'El evento en {club_name} ha terminado, pero la historia sigue. '
                    'Ya puedes ver y subir tus mejores momentos al muro. '
                    '¡No olvides saludar a tus nuevos Mutuals! ✨'
                ),
                type='memories_unlocked',
                data={'event_id': instance.event.id}
            )
