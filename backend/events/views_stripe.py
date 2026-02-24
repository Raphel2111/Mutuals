import stripe
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from .models import TicketTier, TicketPurchase, Registration, Event
from users.models import User
import uuid

stripe.api_key = settings.STRIPE_SECRET_KEY

@api_view(['POST'])
@permission_classes([AllowAny])
def create_payment_intent(request):
    try:
        data = request.data
        ticket_tier_id = data.get('ticket_tier_id')
        guest_email = data.get('email')
        
        ticket_tier = TicketTier.objects.get(id=ticket_tier_id)
        
        if ticket_tier.sold >= ticket_tier.capacity:
            return JsonResponse({'error': 'Sold out'}, status=400)
            
        # Create PaymentIntent with Stripe Connect support if available
        base_amount = ticket_tier.price
        
        # Calculate platform fee based on Event properties
        platform_fee_percent = ticket_tier.event.platform_fee_percentage or 5.00
        platform_fee = (base_amount * platform_fee_percent) / 100
        total_amount = base_amount # Let's assume price includes the fee, or we could add it. Assuming inclusive.
        
        intent_kwargs = {
            'amount': int(total_amount * 100), # Amount in cents
            'currency': ticket_tier.currency.lower(),
            'metadata': {
                'ticket_tier_id': ticket_tier.id,
                'guest_email': guest_email,
                'user_id': request.user.id if request.user.is_authenticated else None
            }
        }
        
        # If the event organizer has a connected stripe account, we route the payment to them
        if ticket_tier.event.stripe_account_id:
            intent_kwargs['transfer_data'] = {
                'destination': ticket_tier.event.stripe_account_id,
            }
            intent_kwargs['application_fee_amount'] = int(platform_fee * 100)
            
        intent = stripe.PaymentIntent.create(**intent_kwargs)
        
        # Register pending purchase
        TicketPurchase.objects.create(
            user=request.user if request.user.is_authenticated else None,
            guest_email=guest_email,
            ticket_tier=ticket_tier,
            amount_total=total_amount,
            platform_fee=platform_fee,
            stripe_payment_intent_id=intent.id,
            status='pending'
        )
        
        return JsonResponse({
            'clientSecret': intent.client_secret
        })
    except TicketTier.DoesNotExist:
        return JsonResponse({'error': 'Ticket tier not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=403)

@csrf_exempt
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError as e:
        return HttpResponse(status=400)

    if event['type'] == 'payment_intent.succeeded':
        payment_intent = event['data']['object']
        handle_successful_payment(payment_intent)
        
    elif event['type'] == 'charge.refunded':
        payment_intent_id = event['data']['object'].get('payment_intent')
        if payment_intent_id:
            handle_refund(payment_intent_id)
            
    return HttpResponse(status=200)

def handle_successful_payment(payment_intent):
    try:
        purchase = TicketPurchase.objects.get(stripe_payment_intent_id=payment_intent['id'])
        if purchase.status == 'paid':
            return # Already processed
            
        purchase.status = 'paid'
        
        # Decrease stock
        ticket_tier = purchase.ticket_tier
        ticket_tier.sold += 1
        ticket_tier.save()
        purchase.save()
        
        # Generate Registration depending on whether user is registered or guest
        # We need to find or create a user if we want them in Registration (this will be handled by magic link auth if needed)
        # For now we create the registration if we have the user
        if purchase.user:
            Registration.objects.create(
                user=purchase.user,
                event=ticket_tier.event,
                status='confirmed',
                alias=ticket_tier.name
            )
        else:
            # Need a stub user for guests, or refactor Registration to support guest emails directly.
            # Using the email to find or create User
            guest_user, created = User.objects.get_or_create(
                email=purchase.guest_email,
                defaults={'username': purchase.guest_email.split('@')[0]}
            )
            Registration.objects.create(
                user=guest_user,
                event=ticket_tier.event,
                status='confirmed',
                alias=ticket_tier.name
            )
            
        # Generate Magic Link
        from .magic_links import generate_magic_link
        magic_link = generate_magic_link(purchase)
        
        # Opcional: Enviar email con el magic_link a purchase.guest_email o user.email
        # send_mail(...)
        
    except TicketPurchase.DoesNotExist:
        pass

def handle_refund(payment_intent_id):
    try:
        purchase = TicketPurchase.objects.get(stripe_payment_intent_id=payment_intent_id)
        purchase.status = 'refunded'
        purchase.save()
        
        # Optional: decrease stock_sold if refunded
        # Disable the Registration QR...
    except TicketPurchase.DoesNotExist:
        pass
