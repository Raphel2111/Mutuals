# Version: 1.0.1+ (Force redeploy)
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from datetime import timedelta
import random
import string
from PIL import Image # Added PIL import

class InterestTag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    category = models.CharField(max_length=50, blank=True)
    
    def __str__(self):
        return f"#{self.name}"

class User(AbstractUser):
    ROLES = (('admin','Administrador'),('attendee','Asistente'))
    role = models.CharField(max_length=10, choices=ROLES, default='attendee')
    phone = models.CharField(max_length=20, blank=True, null=True, verbose_name='Teléfono')
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True, verbose_name='Foto de perfil')
    bio = models.TextField(blank=True, null=True, verbose_name='Biografía')
    email_verified = models.BooleanField(default=False, verbose_name='Email verificado')
    phone_verified = models.BooleanField(default=False, verbose_name='Teléfono verificado')
    
    # Added groups and user_permissions for AbstractUser compatibility
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='custom_user_set',
        blank=True,
        verbose_name='groups',
        help_text='The groups this user belongs to.',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='custom_user_set',
        blank=True,
        verbose_name='user permissions',
        help_text='Specific permissions for this user.',
    )
    
    # Networking
    interests = models.ManyToManyField(InterestTag, blank=True, related_name='users')

    # Public profile URL slug (auto-generated from username)
    slug = models.SlugField(max_length=80, unique=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            base = slugify(self.username)
            slug = base
            counter = 1
            while User.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f'{base}-{counter}'
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.username

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    linkedin_url = models.URLField(blank=True, null=True)
    availability_status = models.BooleanField(
        default=True,
        verbose_name='Disponible para charlar',
        help_text='Si es True, aparece en el Radar Social (Verde Neón). Si es False, oculta el perfil (Gris).'
    )
    show_event_history = models.BooleanField(
        default=True,
        verbose_name='Mostrar eventos en perfil público',
        help_text='Si es False, los eventos asistidos no aparecen en el perfil público.'
    )

    def __str__(self):
        return f"Perfil de {self.user.username}"


class VerificationCode(models.Model):
    """Códigos de verificación para email y teléfono"""
    VERIFICATION_TYPES = (
        ('email', 'Email'),
        ('phone', 'Teléfono'),
        ('reset', 'Restablecer Contraseña'),
    )
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='verification_codes')
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
