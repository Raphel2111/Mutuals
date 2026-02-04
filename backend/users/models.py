from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from datetime import timedelta
import random
import string

class User(AbstractUser):
    ROLES = (('admin','Administrador'),('attendee','Asistente'))
    role = models.CharField(max_length=10, choices=ROLES, default='attendee')
    phone = models.CharField(max_length=20, blank=True, null=True, verbose_name='Teléfono')
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True, verbose_name='Foto de perfil')
    bio = models.TextField(blank=True, null=True, verbose_name='Biografía')
    email_verified = models.BooleanField(default=False, verbose_name='Email verificado')
    phone_verified = models.BooleanField(default=False, verbose_name='Teléfono verificado')
    
    def __str__(self):
        return self.username


class VerificationCode(models.Model):
    """Códigos de verificación para email y teléfono"""
    VERIFICATION_TYPES = (
        ('email', 'Email'),
        ('phone', 'Teléfono'),
        ('password_reset', 'Restablecer Contraseña'),
    )
    
    code = models.CharField(max_length=6)
    verification_type = models.CharField(max_length=20, choices=VERIFICATION_TYPES)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-created_at']
    
    def save(self, *args, **kwargs):
        if not self.code:
            self.code = ''.join(random.choices(string.digits, k=6))
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=15)
        super().save(*args, **kwargs)
    
    def is_valid(self):
        """Verifica si el código sigue siendo válido"""
        return not self.used and timezone.now() < self.expires_at
    
    def __str__(self):
        return f"{self.verification_type} code for {self.user.username}"
