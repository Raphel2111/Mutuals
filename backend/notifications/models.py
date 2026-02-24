from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from users.models import User


class Notification(models.Model):
    """
    Persisted notification record — powers the badge count across page loads.
    Real-time delivery via WebSocket (Django Channels).
    """
    TYPE_CHOICES = [
        ('match', '🌐 Match de Networking'),
        ('connection_request', '🤝 Solicitud de Conexión'),
        ('wave', '👋 Saludo recibido'),
        ('memories_unlocked', '📸 Muro desbloqueado'),
        ('event_reminder', '📅 Recordatorio de evento'),
        ('system', '⚙️ Sistema'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=100)
    body = models.TextField(blank=True)
    type = models.CharField(max_length=30, choices=TYPE_CHOICES, default='system')
    is_read = models.BooleanField(default=False)
    data_json = models.JSONField(default=dict, blank=True, help_text='Extra payload for routing on frontend')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.type}] {self.user.username}: {self.title}"


# ─── Report Model ─────────────────────────────────────────────────────────────

class Report(models.Model):
    """
    Universal report table via GenericForeignKey.
    A single table handles reports on User profiles, EventPhoto, Club, etc.
    """
    REASON_CHOICES = [
        ('spam',          '📢 Spam o contenido repetitivo'),
        ('inappropriate', '🔞 Contenido inapropiado'),
        ('harassment',    '😡 Acoso o comportamiento abusivo'),
        ('fake',          '🎭 Perfil falso o suplantación'),
        ('other',         '⚠️ Otro motivo'),
    ]
    STATUS_CHOICES = [
        ('pending',  'Pendiente revisión'),
        ('reviewed', 'Revisado — sin acción'),
        ('actioned', 'Revisado — acción tomada'),
    ]

    reporter     = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reports_sent')
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id    = models.PositiveIntegerField()
    reported_obj = GenericForeignKey('content_type', 'object_id')

    reason      = models.CharField(max_length=20, choices=REASON_CHOICES)
    description = models.TextField(blank=True)
    status      = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at  = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reports_reviewed'
    )

    class Meta:
        ordering = ['-created_at']
        unique_together = ['reporter', 'content_type', 'object_id', 'reason']

    def __str__(self):
        return f"[{self.get_reason_display()}] {self.reporter.username} → {self.content_type} #{self.object_id}"


class Notification(models.Model):
    """
    Persisted notification record — powers the badge count across page loads.
    Real-time delivery via WebSocket (Django Channels).
    """
    TYPE_CHOICES = [
        ('match', '🌐 Match de Networking'),
        ('connection_request', '🤝 Solicitud de Conexión'),
        ('wave', '👋 Saludo recibido'),
        ('memories_unlocked', '📸 Muro desbloqueado'),
        ('event_reminder', '📅 Recordatorio de evento'),
        ('system', '⚙️ Sistema'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=100)
    body = models.TextField(blank=True)
    type = models.CharField(max_length=30, choices=TYPE_CHOICES, default='system')
    is_read = models.BooleanField(default=False)
    data_json = models.JSONField(default=dict, blank=True, help_text='Extra payload for routing on frontend')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.type}] {self.user.username}: {self.title}"
