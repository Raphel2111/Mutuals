"""
Stripe monetization endpoints for MUTUALS.

/api/stripe/onboard/          POST  → Create/resume Stripe Connect Express onboarding
/api/stripe/onboard/status/   GET   → Check connected account status
/api/stripe/membership/checkout/  POST  → Create a Stripe Checkout Session for a club membership
/api/stripe/webhook/          POST  → Handle Stripe webhook events
"""

import os
import stripe
from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework import status as drf_status

from events.models import Club, ClubMembership, ClubSubscription

stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY', os.getenv('STRIPE_SECRET_KEY', ''))

# ── Subscription payment methods (explicit list required for mode='subscription')
# 'card' covers Visa, Mastercard, Amex, Apple Pay, Google Pay automatically.
# Add/remove methods here without touching session creation code.
SUBSCRIPTION_PAYMENT_METHODS = [
    'card',        # Visa / MC / Amex / Apple Pay / Google Pay
    'sepa_debit',  # Banco europeo — cargo directo SEPA
    'klarna',      # Paga en 3 cuotas sin interés
    'paypal',      # Ampliamente conocido
]

# ── One-time payment method configuration
# Using automatic_payment_methods lets Stripe choose the best available
# method per country/currency (includes Bizum via PayComet if configured).
ONETIME_PAYMENT_CONFIG = {'automatic_payment_methods': {'enabled': True}}


# ─── Helper ───────────────────────────────────────────────────────────────────

def _frontend_url(path=''):
    base = getattr(settings, 'FRONTEND_URL', os.getenv('FRONTEND_URL', 'http://localhost:5173'))
    return f"{base.rstrip('/')}{path}"


# ─── 1. Stripe Connect Onboarding ─────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stripe_connect_onboard(request):
    """
    Creates (or resumes) a Stripe Express account for the requesting user.
    Body: { "club_id": <int> }  — the club this account will be associated with.
    Returns: { "url": "<Stripe onboarding URL>" }
    """
    club_id = request.data.get('club_id')
    if not club_id:
        return Response({'error': 'club_id requerido'}, status=400)

    try:
        club = Club.objects.get(pk=club_id)
    except Club.DoesNotExist:
        return Response({'error': 'Club no encontrado'}, status=404)

    if not club.admins.filter(pk=request.user.pk).exists():
        return Response({'error': 'No eres admin de este club'}, status=403)

    if not stripe.api_key or 'REEMPLAZA' in stripe.api_key:
        return Response(
            {'error': 'STRIPE_SECRET_KEY no configurada. Añádela al .env del backend.'},
            status=503
        )

    # Create or reuse the Stripe account
    if not club.stripe_account_id:
        account = stripe.Account.create(
            type='express',
            country='ES',
            email=request.user.email,
            capabilities={'card_payments': {'requested': True}, 'transfers': {'requested': True}},
            business_profile={'mcc': '7999', 'name': club.name},
        )
        club.stripe_account_id = account.id
        club.stripe_account_status = 'pending'
        club.save(update_fields=['stripe_account_id', 'stripe_account_status'])

    # Generate onboarding link
    link = stripe.AccountLink.create(
        account=club.stripe_account_id,
        refresh_url=getattr(settings, 'STRIPE_CONNECT_REFRESH_URL',
                            os.getenv('STRIPE_CONNECT_REFRESH_URL', _frontend_url('/organizer/stripe-refresh'))),
        return_url=getattr(settings, 'STRIPE_CONNECT_RETURN_URL',
                           os.getenv('STRIPE_CONNECT_RETURN_URL', _frontend_url('/organizer/stripe-return'))),
        type='account_onboarding',
    )
    return Response({'url': link.url})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stripe_connect_status(request):
    """
    Returns the Stripe Connect account status for each club the user admin.
    """
    clubs = Club.objects.filter(admins=request.user).exclude(stripe_account_id=None)
    data = []
    for club in clubs:
        try:
            acct = stripe.Account.retrieve(club.stripe_account_id)
            charges_enabled = acct.charges_enabled
            payouts_enabled = acct.payouts_enabled
            new_status = 'active' if charges_enabled else 'pending'
            if new_status != club.stripe_account_status:
                club.stripe_account_status = new_status
                club.save(update_fields=['stripe_account_status'])
            data.append({
                'club_id': club.id,
                'club_name': club.name,
                'stripe_account_id': club.stripe_account_id,
                'charges_enabled': charges_enabled,
                'payouts_enabled': payouts_enabled,
                'status': new_status,
            })
        except stripe.error.StripeError as e:
            data.append({'club_id': club.id, 'club_name': club.name, 'error': str(e)})
    return Response(data)


# ─── 2. Club Membership Checkout ─────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def membership_checkout(request):
    """
    Creates a Stripe Checkout Session for a club membership plan.
    Body: { "club_id": <int>, "plan": "monthly" | "annual" }
    Returns: { "checkout_url": "<Stripe hosted page URL>" }
    """
    club_id = request.data.get('club_id')
    plan    = request.data.get('plan', 'monthly')

    try:
        club = Club.objects.get(pk=club_id)
    except Club.DoesNotExist:
        return Response({'error': 'Club no encontrado'}, status=404)

    if not club.is_paid:
        return Response({'error': 'Este club no tiene membresía de pago'}, status=400)

    if not stripe.api_key or 'REEMPLAZA' in stripe.api_key:
        return Response(
            {'error': 'STRIPE_SECRET_KEY no configurada en el servidor.'},
            status=503
        )

    # Pick the price
    if plan == 'annual' and club.stripe_annual_price_id:
        price_id = club.stripe_annual_price_id
    elif club.stripe_monthly_price_id:
        price_id = club.stripe_monthly_price_id
    else:
        # Auto-create Stripe prices from the club's decimal fields
        price_id = _get_or_create_price(club, plan)

    if not price_id:
        return Response({'error': 'No se pudo resolver el precio de Stripe'}, status=500)

    session = stripe.checkout.Session.create(
        payment_method_types=SUBSCRIPTION_PAYMENT_METHODS,
        mode='subscription',
        line_items=[{'price': price_id, 'quantity': 1}],
        customer_email=request.user.email,
        success_url=_frontend_url(f'/club/{club.id}?membership=success'),
        cancel_url=_frontend_url(f'/club/{club.id}?membership=cancel'),
        metadata={
            'club_id': club.id,
            'user_id': request.user.id,
            'plan': plan,
        },
        **(
            {'stripe_account': club.stripe_account_id,
             'payment_intent_data': {'application_fee_amount': _platform_fee_cents(club, plan)}}
            if club.stripe_account_id else {}
        ),
    )
    return Response({'checkout_url': session.url})


def _get_or_create_price(club, plan):
    """Auto-creates a Stripe recurring Price for a club if none exists yet."""
    amount_eur = club.monthly_price if plan == 'monthly' else club.annual_price
    if not amount_eur or float(amount_eur) <= 0:
        return None
    amount_cents = int(float(amount_eur) * 100)
    interval = 'month' if plan == 'monthly' else 'year'
    try:
        price = stripe.Price.create(
            currency='eur',
            unit_amount=amount_cents,
            recurring={'interval': interval},
            product_data={'name': f'{club.name} — {plan.capitalize()} Membership'},
        )
        if plan == 'monthly':
            club.stripe_monthly_price_id = price.id
        else:
            club.stripe_annual_price_id = price.id
        club.save(update_fields=[f'stripe_{plan}_price_id'])
        return price.id
    except stripe.error.StripeError:
        return None


def _platform_fee_cents(club, plan):
    """5% platform fee for MUTUALS on each paid membership."""
    amount = float(club.monthly_price if plan == 'monthly' else club.annual_price)
    return int(amount * 100 * 0.05)


# ─── 3. Stripe Webhook ────────────────────────────────────────────────────────

@api_view(['POST'])
def stripe_webhook(request):
    """
    Handles:
      - checkout.session.completed  → create/upgrade ClubMembership + ClubSubscription
      - customer.subscription.updated → update ClubSubscription status
      - customer.subscription.deleted → cancel ClubSubscription
    """
    payload    = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')
    webhook_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET',
                             os.getenv('STRIPE_WEBHOOK_SECRET', ''))

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        return HttpResponse(status=400)

    if event['type'] == 'checkout.session.completed':
        _handle_checkout_completed(event['data']['object'])

    elif event['type'] in ('customer.subscription.updated', 'customer.subscription.deleted'):
        _handle_subscription_update(event['data']['object'], deleted=event['type'].endswith('deleted'))

    return HttpResponse(status=200)


def _handle_checkout_completed(session):
    meta = session.get('metadata', {})
    
    # --- 1. Wallet Deposit ---
    wallet_id = meta.get('wallet_id')
    if wallet_id:
        from events.models import Wallet, Transaction
        from decimal import Decimal
        try:
            wallet = Wallet.objects.get(pk=wallet_id)
        except Wallet.DoesNotExist:
            return
            
        amount_cents = session.get('amount_total', 0)
        amount = Decimal(amount_cents) / Decimal('100')
        
        wallet.balance += amount
        wallet.save()
        
        Transaction.objects.create(
            wallet=wallet,
            amount=amount,
            transaction_type='deposit',
            description='Recarga de saldo via Stripe',
            balance_after=wallet.balance
        )
        return

    # --- 2. Club Membership ---
    club_id = meta.get('club_id')
    user_id = meta.get('user_id')
    plan    = meta.get('plan', 'monthly')
    if not (club_id and user_id):
        return

    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        club = Club.objects.get(pk=club_id)
        user = User.objects.get(pk=user_id)
    except (Club.DoesNotExist, User.DoesNotExist):
        return

    membership, _ = ClubMembership.objects.get_or_create(
        user=user, club=club,
        defaults={'status': 'approved', 'badge': 'vip', 'joined_at': timezone.now()}
    )
    membership.status = 'approved'
    membership.badge  = 'vip'
    if not membership.joined_at:
        membership.joined_at = timezone.now()
    membership.save()

    sub_id = session.get('subscription')
    ClubSubscription.objects.update_or_create(
        membership=membership,
        defaults={
            'plan': plan,
            'stripe_subscription_id': sub_id,
            'stripe_customer_id': session.get('customer'),
            'status': 'active',
        }
    )


def _handle_subscription_update(subscription, deleted=False):
    sub_id = subscription.get('id')
    try:
        cs = ClubSubscription.objects.get(stripe_subscription_id=sub_id)
        if deleted:
            cs.status = 'canceled'
        else:
            cs.status = subscription.get('status', 'active')
        period_end = subscription.get('current_period_end')
        if period_end:
            cs.current_period_end = timezone.datetime.fromtimestamp(period_end, tz=timezone.utc)
        cs.save()
    except ClubSubscription.DoesNotExist:
        pass
