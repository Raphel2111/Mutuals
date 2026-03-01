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
    # Relaciones de eventos: Clubes Privados
    club = models.ForeignKey('Club', on_delete=models.SET_NULL, null=True, blank=True, related_name='club_events', help_text='Club al que pertenece este evento (opcional)')
    admins = models.ManyToManyField(User, related_name='managed_events', blank=True)
    requires_approval = models.BooleanField(default=False, help_text='Si es True, las solicitudes de acceso requieren aprobación de un admin')
    is_public = models.BooleanField(default=True, help_text='Si es True, el evento es visible para todos. Si es False, solo visible para miembros del grupo.')
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='Precio de entrada al evento. 0 = gratis')
    registration_deadline = models.DateTimeField(null=True, blank=True, help_text='Fecha límite para inscribirse. Dejar en blanco para ilimitado.')
    stripe_account_id = models.CharField(max_length=100, blank=True, null=True, help_text='Stripe Account ID del organizador para Stripe Connect')
    platform_fee_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=5.00, help_text='Porcentaje de comisión que MUTUALS cobra por entrada vendida')

    def __str__(self):
        return self.name


class Club(models.Model):
    """
    Clubes Privados (Ej: Club de Lectura Casual, Cenas Tech).
    Fomentan la comunidad y recurrencia más allá de un evento puntual.
    """
    name        = models.CharField(max_length=200, unique=True)
    slug        = models.SlugField(max_length=100, unique=True, blank=True)
    description = models.TextField(blank=True)
    image       = models.ImageField(upload_to='clubs', null=True, blank=True)
    admins      = models.ManyToManyField(User, related_name='managed_clubs')
    created_at  = models.DateTimeField(auto_now_add=True)
    is_private  = models.BooleanField(default=True, help_text='Si es True, unirse requiere aprobación por un Admin.')
    tags        = models.ManyToManyField('users.InterestTag', blank=True, related_name='clubs',
                                         help_text='Intereses/temáticas del club para el Radar de descubrimiento')

    # ── Monetización ────────────────────────────────────────────────────────
    stripe_account_id  = models.CharField(max_length=100, blank=True, null=True,
                                          help_text='Stripe Connect Express Account ID del dueño del club')
    stripe_account_status = models.CharField(
        max_length=20,
        choices=[('pending','Pendiente'),('active','Activo'),('restricted','Restringido')],
        default='pending'
    )
    monthly_price  = models.DecimalField(max_digits=8, decimal_places=2, default=0,
                                         help_text='Cuota mensual en EUR (0 = gratis)')
    annual_price   = models.DecimalField(max_digits=8, decimal_places=2, default=0,
                                         help_text='Cuota anual en EUR (0 = gratis)')
    membership_benefits = models.TextField(blank=True,
                                           help_text='Beneficios de la membresía, uno por línea')
    stripe_monthly_price_id = models.CharField(max_length=100, blank=True, null=True,
                                               help_text='Stripe Price ID para el plan mensual')
    stripe_annual_price_id  = models.CharField(max_length=100, blank=True, null=True,
                                               help_text='Stripe Price ID para el plan anual')

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    @property
    def is_paid(self):
        return float(self.monthly_price or 0) > 0 or float(self.annual_price or 0) > 0

    def __str__(self):
        return self.name


class ClubPost(models.Model):
    """
    Publicación/anuncio del organizador dentro de un club.
    Solo los miembros aprobados pueden verlas; solo los admins pueden crearlas.
    """
    POST_TYPES = [
        ('announcement', '📢 Anuncio'),
        ('event_recap',  '📸 Recap de evento'),
        ('update',       '📝 Actualización'),
    ]

    club       = models.ForeignKey('Club', on_delete=models.CASCADE, related_name='posts')
    author     = models.ForeignKey(User, on_delete=models.CASCADE, related_name='club_posts')
    post_type  = models.CharField(max_length=20, choices=POST_TYPES, default='announcement')
    title      = models.CharField(max_length=200, blank=True)
    content    = models.TextField()
    image      = models.ImageField(upload_to='club_posts/', null=True, blank=True)
    is_pinned  = models.BooleanField(default=False)
    likes      = models.ManyToManyField(User, related_name='liked_club_posts', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_pinned', '-created_at']

    @property
    def like_count(self):
        return self.likes.count()

    def __str__(self):
        return f"[{self.club.name}] {self.author.username}: {self.content[:60]}"


class ClubWallPost(models.Model):
    """
    Community wall posts — written by ANY approved club member.
    Distinct from ClubPost which are official organizer announcements.
    """
    club       = models.ForeignKey('Club', on_delete=models.CASCADE, related_name='wall_posts')
    author     = models.ForeignKey(User, on_delete=models.CASCADE)
    content    = models.TextField(blank=True, null=True)
    image      = models.ImageField(upload_to='club_wall_images/', null=True, blank=True)
    reply_to   = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='replies')
    likes      = models.ManyToManyField(User, related_name='liked_wall_posts', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def like_count(self):
        return self.likes.count()

    def __str__(self):
        return f"WallPost {self.id} on {self.club.name} by {self.author.username}"


class ClubMembership(models.Model):
    """
    Sistema de Membresía con doble opt-in (Solicitud de Unión) y Gamificación (Badges).
    """
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('approved', 'Aprobada'),
        ('approved_pending_payment', 'Aprobada (Falta Pago)'),
        ('rejected', 'Rechazada'),
    ]

    BADGE_CHOICES = [
        ('member', 'Miembro Nuevo'),
        ('loyal', 'Asistente Fiel'),
        ('founder', 'Miembro Fundador'),
        ('vip', 'Socio VIP'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='club_memberships')
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='memberships')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending')
    badge = models.CharField(max_length=20, choices=BADGE_CHOICES, default='member')
    events_attended = models.PositiveIntegerField(default=0, help_text='Número de eventos del club a los que ha asistido para gamificación.')
    message = models.TextField(blank=True, help_text='Carta de presentación al solicitar unirse.')
    requested_at = models.DateTimeField(auto_now_add=True)
    joined_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['user', 'club']

    def __str__(self):
        return f"{self.user.username} - {self.club.name} ({self.get_badge_display()})"


class ClubSubscription(models.Model):
    """
    Tracks a paid Stripe subscription for a club membership.
    One-to-one with ClubMembership (only created when the club has a paid tier).
    """
    PLAN_CHOICES   = (('monthly', 'Mensual'), ('annual', 'Anual'), ('free', 'Gratuito'))
    STATUS_CHOICES = (('active','Activo'),('past_due','Pago atrasado'),('canceled','Cancelado'),('trialing','Prueba'))

    membership           = models.OneToOneField(ClubMembership, on_delete=models.CASCADE,
                                                related_name='subscription')
    plan                 = models.CharField(max_length=10, choices=PLAN_CHOICES, default='free')
    stripe_subscription_id  = models.CharField(max_length=100, blank=True, null=True)
    stripe_customer_id      = models.CharField(max_length=100, blank=True, null=True)
    status               = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    current_period_end   = models.DateTimeField(null=True, blank=True)
    created_at           = models.DateTimeField(auto_now_add=True)
    updated_at           = models.DateTimeField(auto_now=True)

class ClubAccessToken(models.Model):
    """
    Token de acceso recurrente para socios del club (ej. para entrar al local).
    """
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='access_tokens')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=100, unique=True, default=uuid.uuid4)
    usage_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    active = models.BooleanField(default=True)

    def __str__(self):
        return f"Token socio: {self.user.username} en {self.club.name}"

    @property
    def qr_url(self):
        return generate_qr_code(self.token)


    def __str__(self):
        return f"{self.membership} | {self.plan} | {self.status}"


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

class TicketTier(models.Model):
    """Tramos de precios dinámicos (Ej. Early Bird, 1er Tramo, VIP)"""
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='ticket_tiers')
    name = models.CharField(max_length=100) # Ej: Promo 50 primeras
    price = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='EUR')
    capacity = models.PositiveIntegerField(help_text='Máximo de entradas disponibles a este precio')
    sold = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_available(self):
        return self.is_active and self.sold < self.capacity

    def __str__(self):
        return f"{self.name} - {self.event.name} (€{self.price})"

class TicketPurchase(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('paid', 'Pagado'),
        ('refunded', 'Reembolsado'),
        ('failed', 'Fallido'),
    ]
    # Compras como "guest" para el flujo de baja fricción
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    guest_email = models.EmailField(blank=True, null=True)
    
    ticket_tier = models.ForeignKey(TicketTier, on_delete=models.PROTECT, null=True)
    amount_total = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    platform_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    stripe_payment_intent_id = models.CharField(max_length=200, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Purchase {self.id} - {self.status}"

class Registration(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    # entry_code is nullable - only generated for confirmed registrations
    entry_code = models.UUIDField(default=None, null=True, blank=True, unique=True)
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
        # Always ensure entry_code exists to satisfy NOT NULL DB constraint
        # REFINEMENT: Only generate entry_code for confirmed registrations
        if self.status == 'confirmed' and not self.entry_code:
            self.entry_code = uuid.uuid4()

        # Only generate QR code image if status is confirmed
        if self.status == 'confirmed' and not self.qr_code:
            filename, file_obj = generate_qr_code(self.entry_code)
            if filename and file_obj:
                self.qr_code.save(filename, file_obj, save=False)
        
        super().save(*args, **kwargs)

    class Meta:
        # Allow multiple registrations for the same user (e.g. for guests)
        unique_together = [] 


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


class ClubInvitation(models.Model):
    """Invitation link to join a club."""
    club = models.ForeignKey('Club', on_delete=models.CASCADE, related_name='invitations')
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
        return f"Invitation to {self.club.name} by {self.created_by.username}"


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


# ─── Networking CRM ─────────────────────────────────────────────────────────

class Connection(models.Model):
    """
    Conexión entre dos usuarios que se conocieron en un evento.
    Doble opt-in: solo es 'confirmed' cuando ambos la confirman.
    """
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('confirmed', 'Confirmada'),
        ('declined', 'Rechazada'),
    ]

    from_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='connections_sent')
    to_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='connections_received')
    event = models.ForeignKey(Event, on_delete=models.SET_NULL, null=True, blank=True, related_name='connections')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    confirmed_by_from = models.BooleanField(default=False)
    confirmed_by_to = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['from_user', 'to_user', 'event']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.from_user.username} → {self.to_user.username} [{self.status}]"

    def update_status(self):
        """Auto-confirm when both sides agree."""
        if self.confirmed_by_from and self.confirmed_by_to:
            self.status = 'confirmed'
        self.save()


# ─── Mutual Memories / Event Capsule ─────────────────────────────────────────

class EventPhoto(models.Model):
    """
    Foto subida por un asistente para el muro post-evento (Mutual Memories).
    Se desbloquea 2h después del inicio del evento.
    """
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='photos')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='event_photos')
    image = models.ImageField(upload_to='event_photos/%Y/%m/', help_text='Foto del evento')
    caption = models.CharField(max_length=200, blank=True)
    likes = models.ManyToManyField(User, related_name='liked_photos', blank=True)
    fire_likes = models.ManyToManyField(User, related_name='fire_liked_photos', blank=True)
    is_hidden = models.BooleanField(default=False, help_text='Ocultada por el organizador por incumplir normas.')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']  # Default; ViewSet can annotate + order by likes

    def __str__(self):
        return f"Photo by {self.user.username} at {self.event.name}"


# ─── Post-Event Survey / Rating ──────────────────────────────────────────────

class EventRating(models.Model):
    """
    Valoración rápida de un evento con 3 emojis: sad / neutral / love.
    Una valoración por usuario por evento.
    """
    RATING_CHOICES = [
        ('sad', '😞 Decepcionante'),
        ('neutral', '😐 Normal'),
        ('love', '😍 Increíble'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='event_ratings')
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='ratings')
    rating = models.CharField(max_length=10, choices=RATING_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'event']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} rated {self.event.name}: {self.rating}"
