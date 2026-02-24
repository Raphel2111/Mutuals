import jwt
from datetime import timedelta
from django.utils import timezone
from django.conf import settings

def generate_magic_link(purchase):
    """Generates a magic link with an embedded JWT for passwordless login."""
    
    # Expiration: let's give them until 2 days after the event
    if purchase.ticket_type.event.date:
        exp_date = purchase.ticket_type.event.date + timedelta(days=2)
    else:
        exp_date = timezone.now() + timedelta(days=30)
        
    payload = {
        'purchase_id': purchase.id,
        'email': purchase.guest_email or (purchase.user.email if purchase.user else ''),
        'exp': exp_date
    }
    
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    
    return f"{frontend_url}/verify-magic/{token}"
