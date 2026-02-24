from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from users.models import User


class Report(models.Model):
    """
    Universal report table — can target any model via GenericForeignKey.
    Covers User profiles, EventPhoto, Club, etc. with a single table.
    """
    REASON_CHOICES = [
        ('spam',         '📢 Spam o contenido repetitivo'),
        ('inappropriate','🔞 Contenido inapropiado'),
        ('harassment',   '😡 Acoso o comportamiento abusivo'),
        ('fake',         '🎭 Perfil falso o suplantación de identidad'),
        ('other',        '⚠️ Otro motivo'),
    ]
    STATUS_CHOICES = [
        ('pending',  'Pendiente revisión'),
        ('reviewed', 'Revisado — sin acción'),
        ('actioned', 'Revisado — acción tomada'),
    ]

    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reports_sent')

    # GenericForeignKey — can point to any model
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id    = models.PositiveIntegerField()
    reported_obj = GenericForeignKey('content_type', 'object_id')

    reason      = models.CharField(max_length=20, choices=REASON_CHOICES)
    description = models.TextField(blank=True, help_text='Descripción opcional del problema.')
    status      = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')

    created_at  = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reports_reviewed'
    )

    class Meta:
        ordering = ['-created_at']
        # Prevent duplicate reports from the same user on the same object
        unique_together = ['reporter', 'content_type', 'object_id', 'reason']

    def __str__(self):
        return f"[{self.get_reason_display()}] por {self.reporter.username} → {self.content_type} #{self.object_id}"
