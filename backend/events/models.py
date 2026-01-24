from django.db import models
from users.models import User
from django.utils import timezone
import uuid
from evento_app.utils import generate_qr_code

class Event(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    date = models.DateTimeField()
    location = models.CharField(max_length=200)
    capacity = models.IntegerField()
    max_qr_codes = models.IntegerField(null=True, blank=True, help_text='Límite de códigos QR/registros para este evento. Dejar en blanco para ilimitado.')
    # Optional relation: an Event can belong to a DistributionGroup
    group = models.ForeignKey('DistributionGroup', on_delete=models.SET_NULL, null=True, blank=True, related_name='group_events')
    admins = models.ManyToManyField(User, related_name='managed_events', blank=True)
    requires_approval = models.BooleanField(default=False, help_text='Si es True, las solicitudes de acceso requieren aprobación de un admin')
    is_public = models.BooleanField(default=True, help_text='Si es True, el evento es visible para todos. Si es False, solo visible para miembros del grupo.')
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='Precio de entrada al evento. 0 = gratis')
    registration_deadline = models.DateTimeField(null=True, blank=True, help_text='Fecha límite para inscribirse. Dejar en blanco para ilimitado.')
    
    def __str__(self):
        return self.name


class AccessRequest(models.Model):
    """Solicitud de acceso a un evento que requiere aprobación."""
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('approved', 'Aprobada'),
        ('rejected', 'Rechazada'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='access_requests')
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='access_requests')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    message = models.TextField(blank=True, help_text='Mensaje opcional del solicitante')
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_requests')
    admin_notes = models.TextField(blank=True, help_text='Notas del administrador')
    
    class Meta:
        unique_together = ['user', 'event']
        ordering = ['-requested_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.event.name} ({self.status})"

class Registration(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    entry_code = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    qr_code = models.ImageField(upload_to='qrcodes', blank=True)
    used = models.BooleanField(default=False)
    
    # Guest/Multi-registration fields
    attendee_first_name = models.CharField(max_length=100, blank=True)
    attendee_last_name = models.CharField(max_length=100, blank=True)
    attendee_type = models.CharField(max_length=20, choices=[('member', 'Fallero'), ('guest', 'Invitado'), ('child', 'Niño')], default='member')
    
    # New fields for Enhanced QR Management
    alias = models.CharField(max_length=100, blank=True, help_text='Nombre identificativo del QR (ej: Entrada VIP)')
    created_at = models.DateTimeField(auto_now_add=True)
    attended_at = models.DateTimeField(null=True, blank=True)
    
    STATUS_CHOICES = [
        ('confirmed', 'Confirmado'),
        ('declined', 'Rechazado (No asistirá)'),
        ('pending', 'Pendiente'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='confirmed')

    def get_attendee_name(self):
        if self.attendee_first_name and self.attendee_last_name:
            return f"{self.attendee_first_name} {self.attendee_last_name}"
        # Fallback to user's name
        if hasattr(self.user, 'get_full_name') and self.user.get_full_name():
            return self.user.get_full_name()
        return self.user.username

    def save(self, *args, **kwargs):
        # Only generate and save a QR code if one isn't already present AND status is confirmed
        if not self.qr_code and self.status == 'confirmed':
            filename, file_obj = generate_qr_code(self.entry_code)
            if filename and file_obj:
                self.qr_code.save(filename, file_obj, save=False)
        super().save(*args, **kwargs)


class EmailLog(models.Model):
    registration = models.ForeignKey(Registration, on_delete=models.SET_NULL, null=True, blank=True, related_name='email_logs')
    recipient = models.EmailField()
    subject = models.CharField(max_length=300)
    body = models.TextField(blank=True)
    sent_at = models.DateTimeField(auto_now_add=True)
    success = models.BooleanField(default=False)
    error_text = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Email to {self.recipient} ({'OK' if self.success else 'ERROR'})"


class DistributionGroup(models.Model):
    """Groups to distribute tickets/users to specific events.

    - `name`: group name
    - `members`: users that belong to this distribution group
    - `events`: events associated to this group (tickets distributed to these events)
    - `admins`: users who can manage the group
    - `is_public`: if True, anyone can join; if False, requires approval
    """
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, help_text='Descripción del grupo')
    logo = models.ImageField(upload_to='group_logos/', blank=True, null=True, help_text='Logo o imagen del grupo')
    is_public = models.BooleanField(default=False, help_text='Si es público, cualquiera puede unirse. Si es privado, requiere aprobación.')
    members = models.ManyToManyField(User, related_name='distribution_groups', blank=True)
    events = models.ManyToManyField(Event, related_name='distribution_groups', blank=True)
    admins = models.ManyToManyField(User, related_name='managed_distribution_groups', blank=True)
    # Users allowed to create events within this group (in addition to admins)
    creators = models.ManyToManyField(User, related_name='group_creations_allowed', blank=True)

    def __str__(self):
        return self.name


class GroupAccessToken(models.Model):
    """A per-user access token/QR code for a DistributionGroup.

    Intended use: each user in a group may have one or more tokens that encode access
    to group-related resources (QR, codes). Tokens can be created by group admins
    or by designated creators.
    """
    group = models.ForeignKey(DistributionGroup, on_delete=models.CASCADE, related_name='access_tokens')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='group_access_tokens')
    token = models.CharField(max_length=64, unique=True)
    qr_code = models.ImageField(upload_to='group_tokens', blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    usage_count = models.IntegerField(default=0)

    def save(self, *args, **kwargs):
        # Generate a random token and QR code if missing
        if not self.token:
            import uuid
            self.token = uuid.uuid4().hex
        if not self.qr_code:
            filename, file_obj = generate_qr_code(self.token)
            if filename and file_obj:
                self.qr_code.save(filename, file_obj, save=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Token for {self.user.username} in {self.group.name}"


class GroupInvitation(models.Model):
    """Invitation link to join a group."""
    group = models.ForeignKey(DistributionGroup, on_delete=models.CASCADE, related_name='invitations')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_invitations')
    token = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    max_uses = models.IntegerField(null=True, blank=True, help_text='Máximo número de usos. Null = ilimitado')
    use_count = models.IntegerField(default=0)
    active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if not self.token:
            import secrets
            self.token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)

    def is_valid(self):
        """Check if invitation is still valid."""
        if not self.active:
            return False
        if self.expires_at and self.expires_at < timezone.now():
            return False
        if self.max_uses and self.use_count >= self.max_uses:
            return False
        return True

    def __str__(self):
        return f"Invitation to {self.group.name} by {self.created_by.username}"


class GroupAccessRequest(models.Model):
    """Solicitud de acceso a un grupo que requiere aprobación."""
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('approved', 'Aprobada'),
        ('rejected', 'Rechazada'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='group_access_requests')
    group = models.ForeignKey(DistributionGroup, on_delete=models.CASCADE, related_name='access_requests')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    message = models.TextField(blank=True, help_text='Mensaje opcional del solicitante')
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_group_requests')
    admin_notes = models.TextField(blank=True, help_text='Notas del administrador')
    
    class Meta:
        unique_together = ['user', 'group']
        ordering = ['-requested_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.group.name} ({self.status})"


class Wallet(models.Model):
    """Billetera virtual del usuario para pagos de eventos."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='wallet')
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    currency = models.CharField(max_length=3, default='USD')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Wallet {self.user.username}: {self.balance} {self.currency}"


class Transaction(models.Model):
    """Registro de transacciones de la billetera."""
    TRANSACTION_TYPES = [
        ('deposit', 'Depósito'),
        ('payment', 'Pago'),
        ('refund', 'Reembolso'),
        ('withdrawal', 'Retiro'),
    ]
    
    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name='transactions')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    description = models.TextField(blank=True)
    event = models.ForeignKey(Event, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    created_at = models.DateTimeField(auto_now_add=True)
    balance_after = models.DecimalField(max_digits=10, decimal_places=2)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.wallet.user.username} - {self.transaction_type}: {self.amount}"


