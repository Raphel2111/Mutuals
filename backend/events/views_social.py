from django.http import HttpResponse, JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from .models import Registration
from .utils_social import generate_social_card
import base64

@api_view(['GET'])
@permission_classes([IsAuthenticated])  # Or AllowAny if public based on alias/id
def get_social_card(request, registration_id):
    try:
        registration = Registration.objects.get(id=registration_id, user=request.user)
        user_name = registration.get_attendee_name()
        event_name = registration.event.name
        
        # Try to get poster path
        poster_path = None
        # if registration.event.poster:
        #     poster_path = registration.event.poster.path

        card_file = generate_social_card(user_name, event_name, poster_path)
        
        # We can return the image directly or base64 
        # Returning directly as image/jpeg:
        response = HttpResponse(card_file.read(), content_type='image/jpeg')
        response['Content-Disposition'] = f'inline; filename="social_card_{registration_id}.jpg"'
        return response
        
        # Alternatively, returning base64 if needed by frontend
        # b64_encoded = base64.b64encode(card_file.read()).decode('utf-8')
        # return JsonResponse({'image_base64': f"data:image/jpeg;base64,{b64_encoded}"})
        
    except Registration.DoesNotExist:
        return JsonResponse({'error': 'Registration not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
