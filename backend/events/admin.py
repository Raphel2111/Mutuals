from django.contrib import admin
from .models import Event, Registration, EmailLog, DistributionGroup, Club, ClubMembership
from .models import GroupAccessToken, GroupInvitation, Wallet, Transaction, TicketTier, TicketPurchase


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'date', 'location', 'max_qr_codes', 'registration_deadline', 'platform_fee_percentage')
    search_fields = ('name', 'description')
    list_filter = ('date',)

@admin.register(TicketTier)
class TicketTierAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'event', 'price', 'capacity', 'sold', 'is_active')
    list_filter = ('event', 'is_active')
    search_fields = ('name', 'event__name')

@admin.register(TicketPurchase)
class TicketPurchaseAdmin(admin.ModelAdmin):
    list_display = ('id', 'ticket_tier', 'user', 'guest_email', 'amount_total', 'platform_fee', 'status', 'created_at')
    list_filter = ('status', 'created_at', 'ticket_tier__event')
    search_fields = ('stripe_payment_intent_id', 'user__username', 'guest_email')


@admin.register(Registration)
class RegistrationAdmin(admin.ModelAdmin):
    list_display = ('id', 'event', 'user', 'entry_code', 'used')
    list_filter = ('event', 'used')
    search_fields = ('entry_code', 'user__username', 'user__email')


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'recipient', 'subject', 'success', 'sent_at')
    list_filter = ('success', 'sent_at')
    search_fields = ('recipient', 'subject', 'error_text')


@admin.register(DistributionGroup)
class DistributionGroupAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')
    filter_horizontal = ('members', 'events', 'admins', 'creators')
    search_fields = ('name',)


@admin.register(GroupAccessToken)
class GroupAccessTokenAdmin(admin.ModelAdmin):
    list_display = ('id', 'group', 'token', 'created_at', 'active')
    list_filter = ('active', 'created_at')
    search_fields = ('token', 'group__name')
    readonly_fields = ('token', 'created_at')


@admin.register(GroupInvitation)
class GroupInvitationAdmin(admin.ModelAdmin):
    list_display = ('id', 'group', 'created_by', 'created_at', 'expires_at', 'max_uses', 'use_count', 'active', 'is_valid')
    list_filter = ('active', 'created_at', 'expires_at')
    search_fields = ('token', 'group__name', 'created_by__username')
    readonly_fields = ('token', 'created_at')
    
    def is_valid(self, obj):
        return obj.is_valid()
    is_valid.boolean = True
    is_valid.short_description = 'Válida'


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'balance', 'currency', 'created_at', 'updated_at')
    list_filter = ('currency', 'created_at')
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'wallet', 'amount', 'transaction_type', 'created_at')
    list_filter = ('transaction_type', 'created_at')
    search_fields = ('wallet__user__username', 'description')

@admin.register(Club)
class ClubAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'is_private', 'created_at')
    filter_horizontal = ('admins',)
    search_fields = ('name', 'description')

@admin.register(ClubMembership)
class ClubMembershipAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'club', 'status', 'badge', 'requested_at')
    list_filter = ('status', 'badge', 'club')
    search_fields = ('user__username', 'club__name')
    readonly_fields = ('requested_at',)
    actions = ['send_payment_reminders']

    @admin.action(description="Enviar recordatorio de pago a pendientes")
    def send_payment_reminders(self, request, queryset):
        from notifications.models import Notification
        from django.contrib import messages
        pending = queryset.filter(status='approved_pending_payment')
        count = 0
        for membership in pending:
            Notification.objects.create(
                user=membership.user,
                type='system',
                title=f'Recordatorio: {membership.club.name}',
                body=f'Tu solicitud de acceso ha sido aprobada. Completa el pago para unirte.',
                data_json={'club_id': membership.club.id},
            )
            count += 1
        
        self.message_user(request, f"Notificaciones enviadas a {count} usuarios.", messages.SUCCESS)
