from rest_framework import viewsets, permissions, status, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from django.http import HttpResponse
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.core.mail import EmailMessage, send_mail
from django.conf import settings
from django.utils import timezone
from io import BytesIO
from django.db import models as dj_models
import logging

from .models import Event, Registration, EmailLog, Club, ClubMembership, ClubInvitation, AccessRequest, ClubAccessToken
from .serializers import EventSerializer, RegistrationSerializer, AccessRequestSerializer, ClubSerializer, ClubMembershipSerializer, ClubAccessTokenSerializer
from .permissions import IsEventAdminOrReadOnly, IsClubOrEventAdmin, IsClubAdminOrEventAdmin
from .utils import generate_ticket_pdf_bytes

logger = logging.getLogger('events.email')


class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_classes = [IsEventAdminOrReadOnly]

    def get_queryset(self):
        """
        Filter events based on visibility:
        - Public events (is_public=True): visible to everyone
        - Private events (is_public=False): only visible to group members or event admins
        """
        queryset = Event.objects.all()
        user = self.request.user
        
        # Apply search filter if provided
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                dj_models.Q(name__icontains=search) |
                dj_models.Q(description__icontains=search) |
                dj_models.Q(location__icontains=search)
            )
        
        # Filter by visibility (public/private)
        visibility = self.request.query_params.get('visibility', None)
        if visibility == 'public':
            queryset = queryset.filter(is_public=True)
        elif visibility == 'private':
            queryset = queryset.filter(is_public=False)
        
        # Filter by club
        club_id = self.request.query_params.get('club', None)
        if club_id:
            queryset = queryset.filter(club_id=club_id)
        
        # Filter by date range
        date_from = self.request.query_params.get('date_from', None)
        date_to = self.request.query_params.get('date_to', None)
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)
        
        # Filter by price
        is_free = self.request.query_params.get('is_free', None)
        if is_free == 'true':
            queryset = queryset.filter(price=0)
        
        # Apply visibility rules for private events
        if not user.is_authenticated:
            # Anonymous users only see public events
            queryset = queryset.filter(is_public=True)
        elif not user.is_staff:
            # Non-staff users see:
            # 1. All public events
            # 2. Private events where they are club members or event admins
            public_events = dj_models.Q(is_public=True)
            is_event_admin = dj_models.Q(admins=user)
            is_club_member = dj_models.Q(club__memberships__user=user, club__memberships__status='approved')
            queryset = queryset.filter(public_events | is_event_admin | is_club_member).distinct()
        
        # Ordering
        order_by = self.request.query_params.get('order_by', '-date')
        queryset = queryset.order_by(order_by)
        
        return queryset

    def perform_create(self, serializer):
        # If the event belongs to a club, check permissions: only club admins/creators or staff can create.
        user = getattr(self.request, 'user', None)
        club = serializer.validated_data.get('club') if hasattr(serializer, 'validated_data') else None
        event = serializer.save()
        if user and user.is_authenticated:
            # Make the creator an admin of the event by default
            event.admins.add(user)
            # If a club is present, ensure the creator is allowed (club admin/creator)
            if club is not None:
                if not (user.is_staff or club.admins.filter(pk=user.pk).exists()):
                    # rollback: remove event and raise permission denied
                    event.delete()
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied('Not allowed to create events for this club')

    @action(detail=True, methods=['post'], url_path='add_admin')
    def add_admin(self, request, pk=None):
        event = self.get_object()
        
        # Permission check: Only current admins can add others
        if not (request.user.is_staff or event.admins.filter(pk=request.user.pk).exists()):
             return Response({'detail': 'No tienes permiso'}, status=status.HTTP_403_FORBIDDEN)

        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        from users.models import User as UserModel
        from .serializers import UserSerializer
        try:
            u = UserModel.objects.get(pk=user_id)
        except UserModel.DoesNotExist:
            return Response({'detail': 'user not found'}, status=status.HTTP_404_NOT_FOUND)
            
        event.admins.add(u)
        
        # Return updated admins list to frontend
        return Response({
            'detail': 'admin added',
            'admins': UserSerializer(event.admins.all(), many=True).data
        })

    @action(detail=True, methods=['post'], url_path='remove_admin')
    def remove_admin(self, request, pk=None):
        event = self.get_object()

        # Permission check
        if not (request.user.is_staff or event.admins.filter(pk=request.user.pk).exists()):
             return Response({'detail': 'No tienes permiso'}, status=status.HTTP_403_FORBIDDEN)

        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        from users.models import User as UserModel
        from .serializers import UserSerializer
        try:
            u = UserModel.objects.get(pk=user_id)
        except UserModel.DoesNotExist:
             # Even if not found, we consider it removed/success to avoid stuck state
            return Response({'detail': 'user not found (ignored)'}, status=status.HTTP_200_OK)
            
        event.admins.remove(u)
        
        return Response({
            'detail': 'admin removed',
            'admins': UserSerializer(event.admins.all(), many=True).data
        })

    @action(detail=True, methods=['get'], url_path='export_csv')
    def export_csv(self, request, pk=None):
        """Export registrations to CSV (Admin Only)"""
        import csv
        from django.http import HttpResponse

        event = self.get_object()
        
        # Permission check
        user = request.user
        is_admin = (
            user.is_staff or 
            event.admins.filter(pk=user.pk).exists() or 
            (event.group and (event.group.admins.filter(pk=user.pk).exists() or event.group.creators.filter(pk=user.pk).exists()))
        )
        if not is_admin:
            return Response({'detail': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        # Create response
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{event.name}_attendees.csv"'
        
        # Fix for Excel (BOM)
        response.write(u'\ufeff'.encode('utf8'))

        writer = csv.writer(response, delimiter=';')
        writer.writerow(['Nombre', 'Apellido', 'Usuario (App)', 'Email', 'Rol', 'Estado', 'Entrada Usada', 'Hora Escaneo', 'Código Entrada', 'Alias'])

        registrations = Registration.objects.filter(event=event).select_related('user')
        
        for reg in registrations:
            attended_at = reg.attended_at.strftime('%Y-%m-%d %H:%M:%S') if reg.attended_at else 'No escaneado'
            
            # Name resolution: Registration fields first, then User profile
            first_name = reg.attendee_first_name or reg.user.first_name
            last_name = reg.attendee_last_name or reg.user.last_name
            username_app = reg.user.username
            
            # Type label
            type_map = {'member': 'Fallero', 'guest': 'Invitado', 'child': 'Niño'}
            role = type_map.get(reg.attendee_type, reg.attendee_type)
            
            writer.writerow([
                first_name,
                last_name,
                username_app,
                reg.user.email,
                role,
                reg.get_status_display(),
                'SI' if reg.used else 'NO',
                attended_at,
                reg.entry_code,
                reg.alias
            ])

        return response

    @action(detail=True, methods=['get'], url_path='participants')
    def participants(self, request, pk=None):
        """Get all participants (users with registrations) for this event"""
        event = self.get_object()
        
        # ACCESS CONTROL: Only admins/staff can see participant list
        user = request.user
        is_admin = (
            user.is_staff or 
            event.admins.filter(pk=user.pk).exists() or 
            (event.group and (event.group.admins.filter(pk=user.pk).exists() or event.group.creators.filter(pk=user.pk).exists()))
        )
        if not is_admin:
            return Response({'detail': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        registrations = Registration.objects.filter(event=event).select_related('user')
        from users.serializers import UserSerializer
        # Get unique users
        users = {}
        for reg in registrations:
            if reg.user and reg.user.id not in users:
                users[reg.user.id] = reg.user
        serializer = UserSerializer(list(users.values()), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='remove_participant')
    def remove_participant(self, request, pk=None):
        """Remove all registrations of a user from this event"""
        event = self.get_object()
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        from users.models import User as UserModel
        try:
            u = UserModel.objects.get(pk=user_id)
        except UserModel.DoesNotExist:
            return Response({'detail': 'user not found'}, status=status.HTTP_404_NOT_FOUND)
        # Delete all registrations for this user and event
        deleted_count, _ = Registration.objects.filter(event=event, user=u).delete()
        return Response({'detail': f'{deleted_count} registration(s) removed'})

    @action(detail=True, methods=['get'], url_path='generate_story')
    def generate_story(self, request, pk=None):
        """Generates a 9:16 social card using Pillow and returns the image bytes"""
        event = self.get_object()
        user = request.user
        
        # User name fallback for guest checkouts
        user_name = "Guest"
        if user.is_authenticated:
             user_name = user.get_full_name() or user.username
        
        from .utils_social import generate_social_card
        
        # In a real app we would pass event poster, here we pass None to use the dark theme fallback
        image_content_file = generate_social_card(user_name=user_name, event_name=event.name, poster_path=None)
        
        response = HttpResponse(image_content_file.read(), content_type='image/jpeg')
        response['Content-Disposition'] = f'inline; filename="story_event_{event.id}.jpg"'
        return response

    @action(detail=True, methods=['get'], url_path='export_registrations')
    def export_registrations(self, request, pk=None):
        """Export registrations to CSV"""
        event = self.get_object()
        
        # Check permissions
        user = request.user
        if not user.is_authenticated:
            return Response({'detail': 'Debes iniciar sesión.'}, status=status.HTTP_401_UNAUTHORIZED)
            
        is_event_admin = event.admins.filter(pk=user.pk).exists()
        
        is_group_admin = False
        if event.group:
            is_group_admin = (
                event.group.admins.filter(pk=user.pk).exists() or 
                event.group.creators.filter(pk=user.pk).exists()
            )
        
        if not (user.is_staff or is_event_admin or is_group_admin):
             print(f"DEBUG EXPORT DENIED: User {user.id} Event {event.id} Group {event.group_id if event.group else 'None'} | Staff:{user.is_staff} EvAdmin:{is_event_admin} GrpAdmin:{is_group_admin}")
             return Response({'detail': 'No tienes permisos para exportar.'}, status=status.HTTP_403_FORBIDDEN)
             
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="participantes_{event.id}.csv"'
        response.write(u'\ufeff'.encode('utf8')) # BOM for Excel to open UTF-8 correctly
        
        # Use semicolon for Excel in Spanish/European locales
        writer = csv.writer(response, delimiter=';')
        writer.writerow(['ID', 'Usuario (Cuenta)', 'Email', 'Teléfono', 'Asistente (Nombre)', 'Tipo', 'Usado', 'Código'])
        
        registrations = Registration.objects.filter(event=event).select_related('user')
        
        for reg in registrations:
            # Determine attendee name
            attendee_name = reg.get_attendee_name()
            
            # Determine attendee type label
            type_map = {'member': 'Fallero', 'guest': 'Invitado', 'child': 'Niño'}
            type_label = type_map.get(reg.attendee_type, reg.attendee_type)
            
            # User info
            user_full_name = reg.user.get_full_name() or reg.user.username
            user_email = reg.user.email
            user_phone = getattr(reg.user, 'phone', '')
            
            writer.writerow([
                reg.id,
                user_full_name,
                user_email,
                user_phone,
                attendee_name,
                type_label,
                'Sí' if reg.used else 'No',
                str(reg.entry_code)
            ])
            
        return response
        
    @action(detail=True, methods=['post'], url_path='create_manual_ticket')
    def create_manual_ticket(self, request, pk=None):
        """Allow admins to manually create a ticket/QR for a user."""
        event = self.get_object()
        user_id = request.data.get('user_id')
        alias = request.data.get('alias', '')
        
        if not user_id:
            return Response({'detail': 'user_id required'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Check permissions (Event admin or Group admin)
        user = request.user
        is_event_admin = event.admins.filter(pk=user.pk).exists()
        is_group_admin = False
        if event.group:
            is_group_admin = (
                event.group.admins.filter(pk=user.pk).exists() or 
                event.group.creators.filter(pk=user.pk).exists()
            )
        
        if not (user.is_staff or is_event_admin or is_group_admin):
            return Response({'detail': 'No tienes permisos para crear tickets manuales.'}, status=status.HTTP_403_FORBIDDEN)
            
        from users.models import User as UserModel
        from .models import Registration
        try:
            target_user = UserModel.objects.get(pk=user_id)
        except UserModel.DoesNotExist:
             return Response({'detail': 'Usuario destino no encontrado'}, status=status.HTTP_404_NOT_FOUND)
             
        # Create registration
        # Note: We allow multiples
        reg = Registration.objects.create(
            user=target_user,
            event=event,
            alias=alias,
            attendee_type='guest' # Asignado manualmente suele ser invitado o especial
        )
        
        return Response({
            'detail': 'Ticket created successfully',
            'entry_code': reg.entry_code,
            'qr_code_url': reg.qr_code.url if reg.qr_code else None,
            'alias': reg.alias,
            'id': reg.id
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='request_access', permission_classes=[permissions.IsAuthenticated])
    def request_access(self, request, pk=None):
        """Solicitar acceso a un evento que requiere aprobación"""
        event = self.get_object()
        user = request.user
        message = request.data.get('message', '')
        
        # Verificar si el evento requiere aprobación
        if not event.requires_approval:
            return Response({'detail': 'Este evento no requiere aprobación'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Verificar si ya existe una solicitud
        existing = AccessRequest.objects.filter(user=user, event=event).first()
        if existing:
            if existing.status == 'pending':
                return Response({'detail': 'Ya tienes una solicitud pendiente para este evento'}, status=status.HTTP_400_BAD_REQUEST)
            elif existing.status == 'approved':
                return Response({'detail': 'Tu solicitud ya fue aprobada'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Crear la solicitud
        access_request = AccessRequest.objects.create(
            user=user,
            event=event,
            message=message
        )
        
        # Notificar a los administradores del evento
        from django.core.mail import send_mail
        admin_emails = [admin.email for admin in event.admins.all() if admin.email]
        if admin_emails:
            subject = f'Nueva solicitud de acceso: {event.name}'
            body = f'''
Hola,

{user.username} ({user.email}) ha solicitado acceso al evento "{event.name}".

Mensaje del solicitante:
{message if message else '(sin mensaje)'}

Por favor, revisa y aprueba/rechaza esta solicitud desde el panel de administración.

Saludos,
EventoApp
            '''
            try:
                send_mail(
                    subject,
                    body,
                    settings.DEFAULT_FROM_EMAIL,
                    admin_emails,
                    fail_silently=False,
                )
            except Exception as e:
                logger.error(f'Error sending notification email: {e}')
        serializer = AccessRequestSerializer(access_request)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'], url_path='check_in_stats')
    def check_in_stats(self, request, pk=None):
        """Admin Only: Get stats for check-ins vs total"""
        # ... (Mantener lógica check_in_stats intacta)
        pass

    @action(detail=True, methods=['get'], url_path='mutual_matches', permission_classes=[permissions.IsAuthenticated])
    def mutual_matches(self, request, pk=None):
        """
        Social Radar / Icebreaker Engine.
        Encuentra a otros asistentes del mismo evento que:
        1. Han hecho check-in (attendance=True) O simplemente tienen entrada.
        2. Tienen su 'UserProfile.availability_status' = True
        3. Comparten al menos 1 'InterestTag' con el usuario solicitante.
        """
        event = self.get_object()
        user = request.user
        
        # 1. Verificar si el usuario consultando tiene perfil y estado disponible
        if hasattr(user, 'profile') and not user.profile.availability_status:
            return Response({'detail': 'Debes activar tu disponibilidad para usar el Radar.'}, status=403)
            
        # 2. Obtener los intereses del usuario actual
        my_interests = set(user.interests.all())
        if not my_interests:
            return Response({'matches': [], 'detail': 'Añade intereses a tu perfil para encontrar matches.'})

        # 3. Encontrar otros registros para este evento (excluyendose a sí mismo)
        other_registrations = Registration.objects.filter(
            event=event, 
            status='valid'
        ).exclude(user=user).select_related('user', 'user__profile').prefetch_related('user__interests')

        matches = []
        
        for reg in other_registrations:
            target_user = reg.user
            
            # 3.1 Filtro de disponibilidad del objetivo
            if not target_user or not hasattr(target_user, 'profile') or not target_user.profile.availability_status:
                continue
                
            # 3.2 Calcular afinidad
            target_interests = set(target_user.interests.all())
            shared_interests = my_interests.intersection(target_interests)
            
            if shared_interests:
                # Top 2 shared interests para el rompehielos
                top_shared = list(shared_interests)[:2]
                top_names = [tag.name for tag in top_shared]
                
                # Generador de Icebreaker (IA-Lite)
                if len(top_names) == 1:
                    icebreaker = f"¡Ambos sois fans de {top_names[0]}! ¿Cuál es tu experiencia favorita relacionada?"
                elif len(top_names) >= 2:
                    icebreaker = f"Qué casualidad, coincidís en {top_names[0]} y {top_names[1]}. ¿Habéis hablado de esto antes?"
                else:
                    icebreaker = "¡Tenéis mucho en común! Saluda para descubrir qué es."

                # Ocultar apellidos completos por privacidad
                first_name = target_user.first_name or target_user.username
                last_initial = f" {target_user.last_name[0]}." if target_user.last_name else ""

                matches.append({
                    'user_id': target_user.id,
                    'name': f"{first_name}{last_initial}",
                    'avatar_url': target_user.avatar.url if target_user.avatar else f"https://ui-avatars.com/api/?name={target_user.username}&background=random",
                    'shared_tags': [tag.name for tag in shared_interests],
                    'match_score': len(shared_interests),
                    'icebreaker_suggestion': icebreaker
                })

        # Ordenar matches por el que tenga más cosas en común
        matches.sort(key=lambda x: x['match_score'], reverse=True)

        return Response({
            'detail': f"Hemos encontrado {len(matches)} personas afines cerca de ti.",
            'matches': matches[:15] # Limitar a los 15 mejores matches para no saturar la UI
        })
    
    @action(detail=True, methods=['get'], url_path='access_requests')
    def access_requests(self, request, pk=None):
        """Obtener todas las solicitudes de acceso para este evento (solo admins)"""
        event = self.get_object()
        requests_qs = AccessRequest.objects.filter(event=event).select_related('user', 'reviewed_by').order_by('-requested_at')
        
        page = self.paginate_queryset(requests_qs)
        if page is not None:
            serializer = AccessRequestSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = AccessRequestSerializer(requests_qs, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], url_path='approve_access')
    def approve_access(self, request, pk=None):
        """Aprobar una solicitud de acceso"""
        event = self.get_object()
        request_id = request.data.get('request_id')
        admin_notes = request.data.get('admin_notes', '')
        
        if not request_id:
            return Response({'detail': 'request_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            access_request = AccessRequest.objects.get(id=request_id, event=event)
        except AccessRequest.DoesNotExist:
            return Response({'detail': 'Solicitud no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        
        if access_request.status != 'pending':
            return Response({'detail': 'Esta solicitud ya fue procesada'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Aprobar la solicitud
        from django.utils import timezone
        access_request.status = 'approved'
        access_request.reviewed_at = timezone.now()
        access_request.reviewed_by = request.user
        access_request.admin_notes = admin_notes
        access_request.save()
        
        # Crear automáticamente una inscripción
        registration = Registration.objects.create(
            user=access_request.user,
            event=event
        )
        
        # Notificar al usuario
        from django.core.mail import send_mail
        if access_request.user.email:
            subject = f'Solicitud aprobada: {event.name}'
            body = f'''
Hola {access_request.user.username},

Tu solicitud para asistir al evento "{event.name}" ha sido aprobada.

Puedes ver tu código QR de entrada en la sección "Mis Inscripciones".

¡Nos vemos en el evento!

Saludos,
EventoApp
            '''
            try:
                send_mail(
                    subject,
                    body,
                    settings.DEFAULT_FROM_EMAIL,
                    [access_request.user.email],
                    fail_silently=False,
                )
            except Exception as e:
                logger.error(f'Error sending approval email: {e}')
        
        serializer = AccessRequestSerializer(access_request)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], url_path='reject_access')
    def reject_access(self, request, pk=None):
        """Rechazar una solicitud de acceso"""
        event = self.get_object()
        request_id = request.data.get('request_id')
        admin_notes = request.data.get('admin_notes', '')
        
        if not request_id:
            return Response({'detail': 'request_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            access_request = AccessRequest.objects.get(id=request_id, event=event)
        except AccessRequest.DoesNotExist:
            return Response({'detail': 'Solicitud no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        
        if access_request.status != 'pending':
            return Response({'detail': 'Esta solicitud ya fue procesada'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Rechazar la solicitud
        from django.utils import timezone
        access_request.status = 'rejected'
        access_request.reviewed_at = timezone.now()
        access_request.reviewed_by = request.user
        access_request.admin_notes = admin_notes
        access_request.save()
        
        # Notificar al usuario
        from django.core.mail import send_mail
        if access_request.user.email:
            subject = f'Solicitud rechazada: {event.name}'
            body = f'''
Hola {access_request.user.username},

Lamentamos informarte que tu solicitud para asistir al evento "{event.name}" ha sido rechazada.

{f"Notas del administrador: {admin_notes}" if admin_notes else ""}

Si tienes alguna pregunta, por favor contacta con los organizadores del evento.

Saludos,
EventoApp
            '''
            try:
                send_mail(
                    subject,
                    body,
                    settings.DEFAULT_FROM_EMAIL,
                    [access_request.user.email],
                    fail_silently=False,
                )
            except Exception as e:
                logger.error(f'Error sending rejection email: {e}')
        
        serializer = AccessRequestSerializer(access_request)
        return Response(serializer.data)





class RegistrationViewSet(viewsets.ModelViewSet):
    queryset = Registration.objects.all().order_by('-created_at')
    serializer_class = RegistrationSerializer
    permission_classes = [IsEventAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        queryset = Registration.objects.all()

        if not user.is_staff:
            # Base visibility: own registrations OR registrations for events I admin (direct or through club)
            queryset = queryset.filter(
                dj_models.Q(user=user) | 
                dj_models.Q(event__admins=user) |
                dj_models.Q(event__club__admins=user)
            ).distinct()

        # Apply specific filters if provided
        event_id = self.request.query_params.get('event')
        if event_id:
            queryset = queryset.filter(event_id=event_id)
        
        user_param = self.request.query_params.get('user')
        if user_param:
            queryset = queryset.filter(user_id=user_param)

        # Optimize: select related to avoid N+1 queries
        return queryset

    def create(self, request, *args, **kwargs):
        try:
            print(f"DEBUG CREATE REGISTRATION: Data={request.data} User={request.user}")
            serializer = self.get_serializer(data=request.data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            
            # Check max_qr_codes limit before creating
            status_val = request.data.get('status')
            if status_val == 'declined':
                # Skip all checks for declined status
                pass
            else:
                event_id = serializer.validated_data.get('event')
                event = None
                if event_id:
                    event = Event.objects.filter(pk=event_id.pk).first()
                    if event:
                        # Check admin privileges
                        user = request.user
                        is_admin = (
                            user.is_staff or 
                            event.admins.filter(pk=user.pk).exists() or 
                            (event.club and event.club.admins.filter(pk=user.pk).exists())
                        )

                        # Check registration deadline (Skip if admin)
                        if not is_admin and event.registration_deadline and timezone.now() > event.registration_deadline:
                            from rest_framework.exceptions import ValidationError
                            raise ValidationError({'detail': 'El plazo de inscripción para este evento ha finalizado.'})

                        # Check global capacity (Skip if admin)
                        current_total = Registration.objects.filter(event=event).exclude(status='declined').count()
                        if not is_admin and event.capacity and current_total >= event.capacity:
                             from rest_framework.exceptions import ValidationError
                             raise ValidationError({'detail': 'El evento ha alcanzado su capacidad máxima.'})

                        # Check max_qr_codes limit (Per User)
                        if event.max_qr_codes:
                            user_count = Registration.objects.filter(event=event, user=request.user).exclude(status='declined').count()
                            if not is_admin and user_count >= event.max_qr_codes:
                                from rest_framework.exceptions import ValidationError
                                raise ValidationError({'detail': f'Límite personal alcanzado. Solo puedes tener {event.max_qr_codes} tickets/QRs para este evento.'})

                        # SECURITY PATCH: Club Access
                        if not is_admin and event.club:
                            from .models import ClubMembership
                            try:
                                mem = ClubMembership.objects.get(user=request.user, club=event.club)
                                if mem.status != 'approved':
                                    from rest_framework.exceptions import ValidationError
                                    raise ValidationError({'detail': 'Debes ser un miembro aprobado del club para generar entradas a este evento.'})
                            except ClubMembership.DoesNotExist:
                                from rest_framework.exceptions import ValidationError
                                raise ValidationError({'detail': 'El evento es exclusivo para miembros del club.'})

                        # SECURITY PATCH: Event Pre-Approval
                        if not is_admin and event.requires_approval:
                            from .models import AccessRequest
                            try:
                                req = AccessRequest.objects.get(user=request.user, event=event)
                                if req.status != 'approved':
                                    from rest_framework.exceptions import ValidationError
                                    raise ValidationError({'detail': 'Tu solicitud de acceso a este evento aún no está aprobada.'})
                            except AccessRequest.DoesNotExist:
                                from rest_framework.exceptions import ValidationError
                                raise ValidationError({'detail': 'Este evento requiere solicitar acceso al organizador previamente.'})
            
                        # SECURITY PATCH: Price Check
                        if not is_admin and float(event.price or 0) > 0:
                            # We prevent direct registration for paid events; they must go through TicketPurchase flow
                            from rest_framework.exceptions import ValidationError
                            raise ValidationError({'detail': 'Este evento es de pago. Debes completar la compra antes de generar la entrada.'})
            
            # All events are now treated as free (Wallet/Payment removed)
            self.perform_create(serializer)
            registration = serializer.instance
            
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'detail': f'Error interno CRITICO en create: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='qr_token', permission_classes=[permissions.IsAuthenticated])
    def qr_token(self, request, pk=None):
        """
        Generate a short-lived (30s) HMAC-SHA256 QR token.
        Format:  <timestamp_window>.<hmac_hex>
        The QR encodes this token. The scanner validates it.
        """
        import hmac as _hmac
        import hashlib
        import time

        reg = self.get_object()
        user = request.user
        if reg.user != user and not (user.is_staff or reg.event.admins.filter(pk=user.pk).exists()):
            return Response({'detail': 'No tienes permiso.'}, status=403)

        # 30-second rolling window
        window = int(time.time() // 30)
        secret = settings.SECRET_KEY.encode('utf-8')
        message = f'{reg.entry_code}:{window}'.encode('utf-8')
        sig = _hmac.new(secret, message, hashlib.sha256).hexdigest()[:16]
        token = f'{reg.entry_code}:{window}:{sig}'

        return Response({
            'qr_token': token,
            'expires_in': 30 - (int(time.time()) % 30),
            'entry_code': reg.entry_code,
        })

    @action(detail=True, methods=['post'], url_path='validate_qr_token', permission_classes=[permissions.IsAuthenticated])
    def validate_qr_token(self, request, pk=None):
        """Validate a QR token on check-in (called by scanner)."""
        import hmac as _hmac
        import hashlib
        import time

        token = request.data.get('qr_token', '')
        try:
            entry_code, window_str, sig = token.split(':')
        except ValueError:
            return Response({'valid': False, 'detail': 'Formato de token inválido.'}, status=400)

        # Validate within ±1 window (allows up to 59s grace)
        current_window = int(time.time() // 30)
        token_window = int(window_str)
        if abs(current_window - token_window) > 1:
            return Response({'valid': False, 'detail': 'QR expirado. Pide al asistente que lo renueve.'}, status=400)

        # Verify signature
        secret = settings.SECRET_KEY.encode('utf-8')
        for w in [token_window, token_window + 1, token_window - 1]:
            expected = _hmac.new(secret, f'{entry_code}:{w}'.encode(), hashlib.sha256).hexdigest()[:16]
            if _hmac.compare_digest(expected, sig):
                # Valid — mark attendance
                reg = self.get_object()
                if reg.entry_code != entry_code:
                    return Response({'valid': False, 'detail': 'Código de entrada no coincide.'}, status=400)
                reg.used = True
                reg.attended_at = timezone.now()
                reg.save()
                return Response({'valid': True, 'detail': '✅ Acceso autorizado.'})

        return Response({'valid': False, 'detail': '❌ Firma inválida — posible uso de captura.'}, status=400)

    @action(detail=True, methods=['get'], url_path='download_ticket')

    def download_ticket(self, request, pk=None):
        """Generate a PDF ticket with embedded QR code for this registration."""
        registration = self.get_object()

        # Permission: allow owner, event admin or staff
        user = request.user
        event = registration.event
        is_admin = user.is_staff or event.admins.filter(pk=user.pk).exists()
        if not (registration.user == user or is_admin):
            return Response({'detail': 'No tienes permisos para descargar este ticket.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            pdf_bytes = generate_ticket_pdf_bytes(registration)
        except Exception as e:
            logger.error(f"Error generating PDF for registration {registration.pk}: {e}")
            return Response({'detail': 'Error generando el ticket PDF.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        filename = f'ticket_{registration.entry_code}.pdf'
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response



    @action(detail=False, methods=['post'], url_path='validate_qr', permission_classes=[permissions.IsAuthenticated])
    def verify_qr_scan(self, request):
        qr_content = request.data.get('qr_content')
        if not qr_content:
            return Response({'valid': False, 'message': 'No QR content provided.'}, status=status.HTTP_400_BAD_REQUEST)

        from django.db import transaction
        try:
            # 1. First, identify the registration (Read-only check)
            registration = None
            
            # Try UUID direct match
            reg_qs = Registration.objects.filter(entry_code=qr_content)
            if reg_qs.exists():
                registration = reg_qs.first()
            
            # If not found, try parsing URL
            if not registration:
                import uuid
                try:
                    parts = qr_content.split('/')
                    possible_id = parts[-1]
                    uuid.UUID(possible_id) # validate format
                    reg_qs = Registration.objects.filter(entry_code=possible_id)
                    if reg_qs.exists():
                        registration = reg_qs.first()
                except (ValueError, IndexError):
                    pass

            if not registration:
                return Response({'valid': False, 'message': 'Código QR no encontrado en el sistema.'}, status=status.HTTP_404_NOT_FOUND)

            # 2. Perform Validation within Atomic Transaction
            with transaction.atomic():
                # Re-fetch with lock to prevent race conditions
                try:
                    locked_reg = Registration.objects.select_for_update().get(pk=registration.pk)
                except Registration.DoesNotExist:
                    return Response({'valid': False, 'message': 'Error de concurrencia: Registro desaparecido.'}, status=status.HTTP_404_NOT_FOUND)

                # Check permissions
                user = request.user
                event = locked_reg.event
                
                is_event_admin = event.admins.filter(pk=user.pk).exists()
                is_club_admin = False
                if event.club:
                    is_club_admin = event.club.admins.filter(pk=user.pk).exists()
                
                is_admin = user.is_staff or is_event_admin or is_club_admin
                
                if not is_admin:
                     return Response({'valid': False, 'message': 'No tienes permisos de administrador para este evento.'}, status=status.HTTP_403_FORBIDDEN)

                # Check usage
                if locked_reg.used:
                    attendee_name = locked_reg.get_attendee_name()
                    return Response({
                        'valid': False, 
                        'message': 'QR YA UTILIZADO anteriormente.',
                        'attendee': attendee_name,
                        'event': event.name,
                        'attended_at': locked_reg.attended_at
                    })

                # Mark as used
                locked_reg.used = True
                locked_reg.attended_at = timezone.now()
                locked_reg.save()
                
                from events.networking import dispatch_networking_match
                if locked_reg.user:
                    dispatch_networking_match(locked_reg.user, event)
                
                attendee_name = locked_reg.get_attendee_name()
                return Response({
                    'valid': True, 
                    'message': 'Entrada Válida. Acceso permitido.', 
                    'attendee': attendee_name,
                    'event': event.name
                })


        except Exception as e:
            return Response({'valid': False, 'message': f'Error validando: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='validate_qr')
    def validate_qr(self, request, pk=None):
        """Mark a registration as used when QR is scanned by an admin."""
        registration = self.get_object()
        user = request.user
        event = registration.event
        
        from django.db import transaction

        # Check if event belongs to a club and user is admin of that club
        if event.club:
            is_club_admin = event.club.admins.filter(pk=user.pk).exists()
            is_event_admin = event.admins.filter(pk=user.pk).exists()
            if not (user.is_staff or is_club_admin or is_event_admin):
                return Response({'detail': 'Solo admins del club pueden validar QR.'}, status=status.HTTP_403_FORBIDDEN)
        else:
            # Event not in group, check event admin
            is_admin = user.is_staff or event.admins.filter(pk=user.pk).exists()
            if not is_admin:
                return Response({'detail': 'No tienes permisos para validar este QR.'}, status=status.HTTP_403_FORBIDDEN)
        
        with transaction.atomic():
            # Lock the row to prevent race conditions
            locked_reg = Registration.objects.select_for_update().get(pk=registration.pk)
            
            if locked_reg.used:
                return Response({
                    'detail': 'Este QR ya fue usado anteriormente.',
                    'already_used': True,
                    'registration': RegistrationSerializer(locked_reg).data
                }, status=status.HTTP_200_OK)
            
            locked_reg.used = True
            locked_reg.attended_at = timezone.now()
            locked_reg.save()
            
            from events.networking import dispatch_networking_match
            if locked_reg.user:
                dispatch_networking_match(locked_reg.user, event)
            
            return Response({
                'detail': 'QR validado exitosamente.',
                'already_used': False,
                'registration': RegistrationSerializer(locked_reg).data
            }, status=status.HTTP_200_OK)





def ticket_list_view(request):
    """Smart redirect: if React dev server responds on localhost:3000, redirect there;
    otherwise render the Django template as a fallback.
    """
    # try to detect React dev server
    try:
        from urllib.request import urlopen
        resp = urlopen('http://localhost:3000', timeout=1)
        if resp.status == 200:
            return redirect('http://localhost:3000')
    except Exception:
        # dev server not available; render Django fallback
        pass

    # Serve the static prototype index.html from the repository to avoid CORS/network issues.
    # Prototype path: ../frontend_web/prototype/index.html (relative to backend BASE_DIR)
    try:
        import os
        from django.conf import settings
        prototype_path = os.path.normpath(os.path.join(str(settings.BASE_DIR), '..', 'frontend_web', 'prototype', 'index.html'))
        if os.path.exists(prototype_path):
            with open(prototype_path, 'rb') as f:
                content = f.read()
            return HttpResponse(content, content_type='text/html')
    except Exception:
        pass

    user = request.user
    regs = Registration.objects.none()
    if user.is_authenticated:
        regs = Registration.objects.filter(user=user)
    return render(request, 'events/ticket_list.html', {'registrations': regs, 'user': user})


from .models import Wallet, Transaction
from .serializers import WalletSerializer, TransactionSerializer
from decimal import Decimal


class WalletViewSet(viewsets.ModelViewSet):
    serializer_class = WalletSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Wallet.objects.all()
        return Wallet.objects.filter(user=user)
    
    @action(detail=False, methods=['get'], url_path='my_wallet')
    def my_wallet(self, request):
        """Get or create wallet for current user"""
        wallet, created = Wallet.objects.get_or_create(user=request.user)
        serializer = self.get_serializer(wallet)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], url_path='add_funds')
    def add_funds(self, request, pk=None):
        """Add funds to wallet (deposit) via Stripe Checkout"""
        wallet = self.get_object()
        if wallet.user != request.user and not request.user.is_staff:
            return Response({'detail': 'No tienes permiso para agregar fondos a esta billetera'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        amount = request.data.get('amount')
        if not amount:
            return Response({'detail': 'amount es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            amount_dec = Decimal(str(amount))
            if amount_dec <= 0:
                return Response({'detail': 'El monto debe ser mayor a 0'}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({'detail': 'Monto inválido'}, status=status.HTTP_400_BAD_REQUEST)
        
        import stripe
        from django.conf import settings
        import os
        
        if not stripe.api_key:
            stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY', os.getenv('STRIPE_SECRET_KEY', ''))
            
        base_url = getattr(settings, 'FRONTEND_URL', os.getenv('FRONTEND_URL', 'http://localhost:5173')).rstrip('/')
        amount_cents = int(amount_dec * 100)
        
        try:
            session = stripe.checkout.Session.create(
                payment_method_types=['card', 'klarna', 'paypal', 'sepa_debit'],
                mode='payment',
                line_items=[{
                    'price_data': {
                        'currency': 'eur',
                        'product_data': {
                            'name': 'Recarga Billetera Mutuals',
                            'description': request.data.get('description') or 'Depósito de fondos',
                        },
                        'unit_amount': amount_cents,
                    },
                    'quantity': 1,
                }],
                customer_email=request.user.email,
                success_url=f"{base_url}/?wallet_success=true",
                cancel_url=f"{base_url}/?wallet_cancel=true",
                metadata={
                    'wallet_id': wallet.id,
                    'user_id': request.user.id,
                }
            )
            return Response({'checkout_url': session.url})
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'], url_path='transactions')
    def transactions(self, request, pk=None):
        """Get transaction history for wallet"""
        wallet = self.get_object()
        if wallet.user != request.user and not request.user.is_staff:
            return Response({'detail': 'No tienes permiso para ver estas transacciones'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        transactions = wallet.transactions.all()
        serializer = TransactionSerializer(transactions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='pay_membership')
    def pay_membership(self, request):
        """Internal payment: deducts wallet balance and grants membership"""
        wallet, _ = Wallet.objects.get_or_create(user=request.user)
        club_id = request.data.get('club_id')
        plan = request.data.get('plan', 'monthly')
        
        if not club_id:
            return Response({'detail': 'club_id es requerido'}, status=status.HTTP_400_BAD_REQUEST)
            
        from .models import Club, ClubMembership, ClubSubscription
        from django.utils import timezone
        try:
            club = Club.objects.get(pk=club_id)
        except Club.DoesNotExist:
            return Response({'detail': 'Club no encontrado'}, status=status.HTTP_404_NOT_FOUND)
            
        amount_eur = club.monthly_price if plan == 'monthly' else club.annual_price
        if not amount_eur or float(amount_eur) <= 0:
            return Response({'detail': 'El club no tiene precio configurado para este plan'}, status=status.HTTP_400_BAD_REQUEST)
            
        # SECURITY PATCH: If club is private AND paid, they must be approved_pending_payment
        if club.is_private:
            try:
                mem = ClubMembership.objects.get(user=request.user, club=club)
                if mem.status != 'approved_pending_payment':
                    return Response({'detail': 'Debes ser aprobado por un administrador antes de poder pagar la suscripción.'}, status=status.HTTP_403_FORBIDDEN)
            except ClubMembership.DoesNotExist:
                return Response({'detail': 'Debes solicitar acceso al club primero.'}, status=status.HTTP_403_FORBIDDEN)

        amount_dec = Decimal(str(amount_eur))
        
        if wallet.balance < amount_dec:
            return Response({'detail': 'Saldo insuficiente en tu Cartera'}, status=status.HTTP_400_BAD_REQUEST)
            
        from django.db import transaction
        with transaction.atomic():
            # Lock the wallet
            locked_wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)
            if locked_wallet.balance < amount_dec:
                return Response({'detail': 'Saldo insuficiente en tu Cartera'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Deduct balance
            locked_wallet.balance -= amount_dec
            locked_wallet.save()
            
            # Record transaction
            Transaction.objects.create(
                wallet=locked_wallet,
                amount=-amount_dec,
                transaction_type='payment',
                description=f"Pago membresía ({plan}) - {club.name}",
                balance_after=locked_wallet.balance
            )
            
            # Grant membership
            membership, _ = ClubMembership.objects.get_or_create(
                user=request.user, club=club,
                defaults={'status': 'approved', 'badge': 'vip', 'joined_at': timezone.now()}
            )
            membership.status = 'approved'
            membership.badge = 'vip'
            if not membership.joined_at:
                membership.joined_at = timezone.now()
            membership.save()
            
            # Compute period end
            import datetime
            from dateutil.relativedelta import relativedelta
            now = timezone.now()
            period_end = now + (relativedelta(months=1) if plan == 'monthly' else relativedelta(years=1))
            
            ClubSubscription.objects.update_or_create(
                membership=membership,
                defaults={
                    'plan': plan,
                    'status': 'active',
                    'current_period_end': period_end
                }
            )
            
        return Response({'detail': 'Pago completado', 'new_balance': locked_wallet.balance})


from .models import Club, ClubMembership
from .serializers import ClubSerializer, ClubMembershipSerializer
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

class ClubViewSet(viewsets.ModelViewSet):
    queryset = Club.objects.all()
    serializer_class = ClubSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'description']

    def perform_create(self, serializer):
        club = serializer.save()
        club.admins.add(self.request.user)
        ClubMembership.objects.create(
            user=self.request.user, club=club,
            status='approved', badge='founder', joined_at=timezone.now()
        )

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def join(self, request, pk=None):
        club = self.get_object()
        message = request.data.get('message', '')
        membership, created = ClubMembership.objects.get_or_create(
            user=request.user, club=club,
            defaults={'message': message}
        )
        if not created:
            if membership.status == 'rejected':
                # Allow re-application
                membership.status = 'pending'
                membership.message = message
                membership.save()
                return Response({'detail': 'Nueva solicitud enviada.', 'status': 'pending'}, status=200)
            return Response({'detail': f'Tu solicitud ya está en estado: {membership.get_status_display()}.', 'status': membership.status}, status=400)

        if not club.is_private:
            if float(club.monthly_price or 0) > 0 or float(club.annual_price or 0) > 0:
                # Public but paid -> they must pay before gaining access
                membership.status = 'approved_pending_payment'
                membership.save()
                return Response({'detail': 'Falta completar el pago.', 'status': 'approved_pending_payment'}, status=200)
            else:
                membership.status = 'approved'
                membership.joined_at = timezone.now()
                membership.save()
                return Response({'detail': '¡Te has unido al club!', 'status': 'approved'}, status=200)

        # Notify admins
        from notifications.models import Notification
        for admin in club.admins.all():
            if admin != request.user:
                Notification.objects.create(
                    user=admin,
                    type='system',
                    title=f'Nueva solicitud en {club.name}',
                    body=f'{request.user.get_full_name() or request.user.username} quiere unirse.',
                    data_json={'club_id': club.id},
                )
        return Response({'detail': 'Solicitud enviada. Pendiente de aprobación.', 'status': 'pending'}, status=200)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def leave(self, request, pk=None):
        club = self.get_object()
        deleted, _ = ClubMembership.objects.filter(user=request.user, club=club).delete()
        if deleted:
            return Response({'detail': 'Has abandonado el club.'}, status=200)
        return Response({'detail': 'No eres miembro de este club.'}, status=400)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def members(self, request, pk=None):
        club = self.get_object()
        qs = club.memberships.filter(status='approved').select_related('user').order_by('-joined_at')
        data = [{
            'id': m.id,
            'user_id': m.user.id,
            'username': m.user.username,
            'full_name': m.user.get_full_name(),
            'avatar': m.user.profile.avatar_url if hasattr(m.user, 'profile') else None,
            'badge': m.badge,
            'badge_display': m.get_badge_display(),
            'events_attended': m.events_attended,
            'joined_at': m.joined_at,
        } for m in qs]
        return Response(data)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def pending(self, request, pk=None):
        club = self.get_object()
        if not club.admins.filter(pk=request.user.pk).exists() and not request.user.is_staff:
            return Response({'detail': 'Solo los admins pueden ver las solicitudes pendientes.'}, status=403)
        qs = club.memberships.filter(status='pending').select_related('user').order_by('requested_at')
        data = [{
            'id': m.id,
            'user_id': m.user.id,
            'username': m.user.username,
            'full_name': m.user.get_full_name(),
            'message': m.message,
            'requested_at': m.requested_at,
        } for m in qs]
        return Response(data)

    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAuthenticated])
    def update_settings(self, request, pk=None):
        club = self.get_object()
        if not club.admins.filter(pk=request.user.pk).exists() and not request.user.is_staff:
            return Response({'detail': 'Sin permisos de administrador.'}, status=403)
        allowed = ['description', 'is_private', 'monthly_price', 'annual_price', 'membership_benefits']
        for field in allowed:
            if field in request.data:
                setattr(club, field, request.data[field])
        club.save()
        # Handle tags M2M separately
        if 'tags' in request.data:
            from users.models import InterestTag
            tag_ids = request.data['tags']
            club.tags.set(InterestTag.objects.filter(id__in=tag_ids))
        return Response(ClubSerializer(club, context={'request': request}).data)

    @action(detail=True, methods=['get'], url_path='posts', url_name='club-posts')
    def posts(self, request, pk=None):
        """GET /clubs/{id}/posts/ — members-only post feed."""
        club = self.get_object()
        if not request.user.is_authenticated:
            return Response([])
            
        is_admin  = club.admins.filter(pk=request.user.pk).exists()
        is_member = club.memberships.filter(user=request.user, status='approved').exists()
        if not (is_admin or is_member):
            return Response([])
        from events.views_clubs import ClubPostSerializer
        qs = club.posts.all()
        return Response(ClubPostSerializer(qs, many=True, context={'request': request}).data)

    @action(detail=True, methods=['get'], url_path='club_events', url_name='club-events')
    def club_events(self, request, pk=None):
        """GET /clubs/{id}/club_events/ — events attached to this club."""
        club = self.get_object()
        qs = Event.objects.filter(club=club).order_by('date')
        data = [{
            'id':          ev.id,
            'name':        ev.name,
            'date':        ev.date,
            'location':    getattr(ev, 'location', ''),
            'price':       str(getattr(ev, 'price', 0)),
            'image_url':   (request.build_absolute_uri(ev.image.url)
                           if getattr(ev, 'image', None) and ev.image else None),
            'description': (ev.description[:200] if ev.description else ''),
        } for ev in qs]
        return Response(data)

    @action(detail=True, methods=['get'], url_path='wall', url_name='club-wall')
    def wall(self, request, pk=None):
        """GET /clubs/{id}/wall/ — members-only community wall."""
        club = self.get_object()
        if not request.user.is_authenticated:
            return Response([])
            
        is_admin  = club.admins.filter(pk=request.user.pk).exists()
        is_member = club.memberships.filter(user=request.user, status='approved').exists()
        if not (is_admin or is_member):
            return Response([])
        from events.views_clubs import ClubWallPostSerializer
        qs = club.wall_posts.select_related('author', 'reply_to', 'reply_to__author').all()
        # Support incremental polling: ?since=<last_id>
        since_id = request.query_params.get('since')
        before_id = request.query_params.get('before')
        
        if since_id:
            try:
                qs = qs.filter(id__gt=int(since_id))
            except (ValueError, TypeError):
                pass
        elif before_id:
            try:
                qs = qs.filter(id__lt=int(before_id))[:50]
            except (ValueError, TypeError):
                pass
        else:
            # Initial load: only bottom 50
            qs = qs[:50]
            
        return Response(ClubWallPostSerializer(qs, many=True, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='create_invitation', permission_classes=[permissions.IsAuthenticated])
    def create_invitation(self, request, pk=None):
        """Create a shareable invitation link for the club"""
        club = self.get_object()
        user = request.user
        if not (user.is_staff or club.admins.filter(pk=user.pk).exists()):
            return Response({'detail': 'Only club admins can create invitations'}, status=status.HTTP_403_FORBIDDEN)
        
        expires_in_days = request.data.get('expires_in_days', 7)
        max_uses = request.data.get('max_uses', None)
        
        from datetime import timedelta
        from django.utils import timezone
        expires_at = timezone.now() + timedelta(days=expires_in_days)
        
        invitation = ClubInvitation.objects.create(
            club=club,
            created_by=user,
            expires_at=expires_at,
            max_uses=max_uses
        )
        
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        invitation_url = f"{frontend_url}/#/join/{invitation.token}"
        
        return Response({
            'token': invitation.token,
            'url': invitation_url,
            'expires_at': invitation.expires_at,
            'max_uses': invitation.max_uses,
            'use_count': invitation.use_count
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def add_member(self, request, pk=None):
        """Add a user to the club directly by username (admin only)"""
        club = self.get_object()
        if not (request.user.is_staff or club.admins.filter(pk=request.user.pk).exists()):
            return Response({'detail': 'Only club admins can add members directly.'}, status=403)
        username = request.data.get('username')
        if not username:
            return Response({'detail': 'Username is required.'}, status=400)
        from users.models import User
        try:
            target_user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=404)
        
        membership, created = ClubMembership.objects.get_or_create(
            user=target_user, club=club,
            defaults={'status': 'approved', 'joined_at': timezone.now()}
        )
        if not created:
            membership.status = 'approved'
            if not membership.joined_at:
                membership.joined_at = timezone.now()
            membership.save()
        return Response({'detail': f'User {username} added to the club.'})

    @action(detail=False, methods=['post'], url_path='accept_invitation', permission_classes=[permissions.IsAuthenticated])
    def accept_invitation(self, request):
        """Accept an invitation to join the club"""
        token = request.data.get('token')
        if not token:
            return Response({'detail': 'token is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            invitation = ClubInvitation.objects.get(token=token)
        except ClubInvitation.DoesNotExist:
            return Response({'detail': 'Invalid invitation token'}, status=status.HTTP_404_NOT_FOUND)
        
        if not invitation.is_valid():
            return Response({'detail': 'Invitation has expired or reached max uses'}, status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user
        club = invitation.club
        
        if club.memberships.filter(user=user, status='approved').exists():
            return Response({'detail': 'You are already a member of this club'}, status=status.HTTP_400_BAD_REQUEST)
        
        if club.memberships.filter(user=user, status='pending').exists():
            return Response({'detail': 'You already have a pending request for this club'}, status=status.HTTP_400_BAD_REQUEST)
        
        ClubMembership.objects.create(
            user=user, club=club,
            status='approved',
            joined_at=timezone.now()
        )
        
        invitation.use_count += 1
        invitation.save()
        
        return Response({
            'detail': 'Successfully joined the club',
            'club_id': club.id,
            'club_name': club.name
        })

    @action(detail=True, methods=['get'], url_path='invitations', permission_classes=[permissions.IsAuthenticated])
    def list_invitations(self, request, pk=None):
        """List active invitations for the club (admin only)"""
        club = self.get_object()
        user = request.user
        
        if not (user.is_staff or club.admins.filter(pk=user.pk).exists()):
            return Response({'detail': 'Only club admins can view invitations'}, status=status.HTTP_403_FORBIDDEN)
        
        invitations = club.invitations.filter(active=True).order_by('-created_at')
        
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        invitation_data = []
        for inv in invitations:
            invitation_data.append({
                'id': inv.id,
                'token': inv.token,
                'url': f"{frontend_url}/#/join/{inv.token}",
                'created_by': inv.created_by.username if inv.created_by else None,
                'created_at': inv.created_at,
                'expires_at': inv.expires_at,
                'max_uses': inv.max_uses,
                'use_count': inv.use_count,
                'is_valid': inv.is_valid()
            })
        
        return Response(invitation_data)

    @action(detail=False, methods=['get'], url_path='invitation-info/(?P<token>[^/.]+)', permission_classes=[permissions.AllowAny])
    def invitation_info(self, request, token=None):
        """Get invitation details (public endpoint for preview)"""
        try:
            invitation = ClubInvitation.objects.get(token=token)
        except ClubInvitation.DoesNotExist:
            return Response({'detail': 'Invalid invitation token'}, status=status.HTTP_404_NOT_FOUND)
        
        club = invitation.club
        
        return Response({
            'valid': invitation.is_valid(),
            'club_name': club.name,
            'club_description': club.description,
            'created_by': invitation.created_by.username if invitation.created_by else None,
            'expires_at': invitation.expires_at,
            'max_uses': invitation.max_uses,
            'use_count': invitation.use_count
        })

    @action(detail=False, methods=['get'], url_path='discover-by-interests')
    def discover_by_interests(self, request):
        """
        Radar Discovery: Returns clubs that share interest tags with the
        authenticated user, sorted by match score (number of shared tags).
        """
        user = request.user
        if not user.is_authenticated:
            return Response({'detail': 'Autenticación requerida.'}, status=401)

        my_tag_ids = set(user.interests.values_list('id', flat=True))
        if not my_tag_ids:
            return Response({'clubs': [], 'message': 'Añade intereses a tu perfil para descubrir clubs.'})

        clubs = Club.objects.prefetch_related('tags', 'admins').all()
        results = []
        for club in clubs:
            club_tag_ids = set(club.tags.values_list('id', flat=True))
            shared = my_tag_ids.intersection(club_tag_ids)
            if shared:
                club_data = ClubSerializer(club, context={'request': request}).data
                club_data['match_score'] = len(shared)
                club_data['shared_tag_ids'] = list(shared)
                results.append(club_data)

        results.sort(key=lambda x: x['match_score'], reverse=True)
        return Response({'clubs': results})
class ClubMembershipViewSet(viewsets.ModelViewSet):
    queryset = ClubMembership.objects.all()
    serializer_class = ClubMembershipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return ClubMembership.objects.all()
        return ClubMembership.objects.filter(models.Q(user=user) | models.Q(club__admins=user)).distinct()

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def approve(self, request, pk=None):
        membership = self.get_object()
        if request.user not in membership.club.admins.all() and not request.user.is_staff:
            return Response({'detail': 'No tienes permisos para aprobar miembros de este club.'}, status=403)
            
        club = membership.club
        is_paid = float(club.monthly_price or 0) > 0 or float(club.annual_price or 0) > 0
        from notifications.models import Notification
        
        if is_paid:
            membership.status = 'approved_pending_payment'
            membership.save()
            Notification.objects.create(
                user=membership.user,
                type='system',
                title=f'¡Solicitud aprobada en {club.name}!',
                body='Ya puedes completar el pago para activar tu membresía y acceder al club.',
                data_json={'club_id': club.id},
            )
            return Response({'detail': 'Miembro aprobado pendiente de pago.'})
        else:
            membership.status = 'approved'
            membership.joined_at = timezone.now()
            membership.save()
            Notification.objects.create(
                user=membership.user,
                type='system',
                title=f'¡Solicitud aprobada en {club.name}!',
                body='Ya puedes acceder a los eventos y beneficios del club.',
                data_json={'club_id': club.id},
            )
            return Response({'detail': 'Miembro aprobado exitosamente.'})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def reject(self, request, pk=None):
        membership = self.get_object()
        if request.user not in membership.club.admins.all() and not request.user.is_staff:
            return Response({'detail': 'No tienes permisos para rechazar miembros de este club.'}, status=403)
        membership.status = 'rejected'
        membership.save()
        return Response({'detail': 'Miembro rechazado.'})

    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAuthenticated])
    def set_badge(self, request, pk=None):
        membership = self.get_object()
        if request.user not in membership.club.admins.all() and not request.user.is_staff:
            return Response({'detail': 'Sin permisos de administrador.'}, status=403)
        badge = request.data.get('badge')
        valid = [c[0] for c in ClubMembership.BADGE_CHOICES]
        if badge not in valid:
             return Response({'detail': 'Badge inválido.'}, status=400)
        membership.badge = badge
        membership.save()
        return Response({'detail': 'Badge actualizado.'})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def add_admin(self, request, pk=None):
        membership = self.get_object()
        club = membership.club
        if request.user not in club.admins.all() and not request.user.is_staff:
            return Response({'detail': 'Solo los admins pueden promover a otros.'}, status=403)
        club.admins.add(membership.user)
        return Response({'detail': f'{membership.user.username} ahora es admin.'})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def remove_admin(self, request, pk=None):
        membership = self.get_object()
        club = membership.club
        if request.user not in club.admins.all() and not request.user.is_staff:
            return Response({'detail': 'Solo los admins pueden degradar a otros.'}, status=403)
        if club.admins.all().count() <= 1:
            return Response({'detail': 'No puedes dejar al club sin administradores.'}, status=400)
        club.admins.remove(membership.user)
        return Response({'detail': f'{membership.user.username} ya no es admin.'})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def kick(self, request, pk=None):
        membership = self.get_object()
        club = membership.club
        if request.user not in club.admins.all() and not request.user.is_staff:
            return Response({'detail': 'Solo los admins pueden expulsar miembros.'}, status=403)
        if membership.user in club.admins.all():
            if club.admins.all().count() <= 1:
                return Response({'detail': 'No puedes expulsar al único administrador.'}, status=400)
            club.admins.remove(membership.user)
        membership.delete()
        return Response({'detail': 'Miembro expulsado.'})
        if badge not in valid:
            return Response({'detail': f'Badge inválido. Opciones: {valid}'}, status=400)
        membership.badge = badge
        membership.save()
        return Response({'detail': 'Badge actualizado.', 'badge': badge})



class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Transaction.objects.all()
        return Transaction.objects.filter(wallet__user=user)


# ─── Networking CRM ──────────────────────────────────────────────────────────

from .models import Connection, EventPhoto, EventRating
from .serializers import ConnectionSerializer, EventPhotoSerializer, EventRatingSerializer
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser


class ConnectionViewSet(viewsets.ModelViewSet):
    """
    Doble opt-in networking CRM.
    POST /api/connections/ { to_user_id, event } → crea solicitud pendiente
    POST /api/connections/{id}/confirm/ → confirma desde el lado receptor
    GET  /api/connections/ → lista conexiones del usuario actual
    """
    serializer_class = ConnectionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Connection.objects.filter(
            dj_models.Q(from_user=user) | dj_models.Q(to_user=user)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(from_user=self.request.user)

    @action(detail=True, methods=['post'], url_path='confirm')
    def confirm(self, request, pk=None):
        """El receptor confirma la conexión. Si el emisor ya confirmó → status='confirmed'."""
        conn = self.get_object()
        user = request.user

        if conn.to_user == user:
            conn.confirmed_by_to = True
        elif conn.from_user == user:
            conn.confirmed_by_from = True
        else:
            return Response({'detail': 'No tienes permisos para confirmar esta conexión.'}, status=403)

        conn.update_status()
        return Response({'detail': f'Conexión {conn.status}.'})

    @action(detail=True, methods=['post'], url_path='decline')
    def decline(self, request, pk=None):
        conn = self.get_object()
        if request.user not in [conn.from_user, conn.to_user]:
            return Response({'detail': 'No permitido.'}, status=403)
        conn.status = 'declined'
        conn.save()
        return Response({'detail': 'Conexión rechazada.'})


# ─── Mutual Memories / Event Capsule ─────────────────────────────────────────

class EventPhotoViewSet(viewsets.ModelViewSet):
    """
    Muro de fotos post-evento. Se desbloquea 2h después del inicio del evento.
    GET  /api/event-photos/?event=<id>
    POST /api/event-photos/ { event, image, caption }
    POST /api/event-photos/{id}/like/
    POST /api/event-photos/{id}/fire_like/
    """
    serializer_class = EventPhotoSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_queryset(self):
        qs = EventPhoto.objects.select_related('user', 'event').prefetch_related('likes', 'fire_likes')
        event_id = self.request.query_params.get('event')
        if event_id:
            qs = qs.filter(event_id=event_id)
        return qs

    def perform_create(self, serializer):
        from datetime import timedelta
        event = serializer.validated_data.get('event')
        user = self.request.user

        # Throttle: 3 photos per user per event
        existing = EventPhoto.objects.filter(event=event, user=user).count()
        if existing >= 3:
            raise serializers.ValidationError('Máximo 3 fotos por usuario por evento.')

        # Lock: only 2h after event starts
        unlock_time = event.date + timedelta(hours=2)
        if timezone.now() < unlock_time:
            raise serializers.ValidationError(
                f'El muro se desbloquea a las {unlock_time.strftime("%H:%M")} (2h después del evento).'
            )

        serializer.save(user=user)

    def _toggle_like(self, request, pk, field):
        photo = self.get_object()
        user = request.user
        manager = getattr(photo, field)
        if manager.filter(pk=user.pk).exists():
            manager.remove(user)
            return Response({'detail': 'Like eliminado.', 'liked': False})
        manager.add(user)
        return Response({'detail': 'Like añadido.', 'liked': True})

    @action(detail=True, methods=['post'], url_path='like')
    def like(self, request, pk=None):
        return self._toggle_like(request, pk, 'likes')

    @action(detail=True, methods=['post'], url_path='fire_like')
    def fire_like(self, request, pk=None):
        return self._toggle_like(request, pk, 'fire_likes')

    @action(detail=True, methods=['post'], url_path='hide', permission_classes=[permissions.IsAuthenticated])
    def hide(self, request, pk=None):
        """Organizer-only: hide or show a photo that violates community standards."""
        photo = self.get_object()
        event = photo.event
        user = request.user
        is_admin = user.is_staff or event.admins.filter(pk=user.pk).exists()
        if not is_admin:
            return Response({'detail': 'Solo los organizadores pueden moderar fotos.'}, status=403)
        photo.is_hidden = not photo.is_hidden
        photo.save(update_fields=['is_hidden'])
        action_taken = 'oculta' if photo.is_hidden else 'visible'
        return Response({'detail': f'Foto ahora {action_taken}.', 'is_hidden': photo.is_hidden})

    def get_queryset(self):
        from django.db.models import Count, F
        user = self.request.user
        qs = EventPhoto.objects.select_related('user', 'event').prefetch_related('likes', 'fire_likes')
        event_id = self.request.query_params.get('event')
        if event_id:
            qs = qs.filter(event_id=event_id)
        # Organizers see all; regular users only see visible photos
        is_admin_param = self.request.query_params.get('include_hidden', 'false') == 'true'
        if not (user.is_staff or is_admin_param):
            qs = qs.filter(is_hidden=False)
        # Support ordering by total likes for the FOMO preview
        ordering = self.request.query_params.get('ordering', '')
        if ordering == 'likes':
            qs = qs.annotate(total_likes=Count('likes') + Count('fire_likes')).order_by('-total_likes')
        return qs


# ─── Post-Event Survey ───────────────────────────────────────────────────────

class EventRatingViewSet(viewsets.ModelViewSet):
    """
    POST /api/event-ratings/ { event, rating } → upsert (1 rating por user/event)
    GET  /api/event-ratings/?event=<id> → aggregate stats
    """
    serializer_class = EventRatingSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        qs = EventRating.objects.select_related('user', 'event')
        event_id = self.request.query_params.get('event')
        if event_id:
            qs = qs.filter(event_id=event_id)
        return qs

    def create(self, request, *args, **kwargs):
        event_id = request.data.get('event')
        rating_val = request.data.get('rating')
        rating, created = EventRating.objects.update_or_create(
            user=request.user,
            event_id=event_id,
            defaults={'rating': rating_val}
        )
        serializer = self.get_serializer(rating)
        status_code = 201 if created else 200
        return Response(serializer.data, status=status_code)

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """Aggregate NPS-style stats for organizer dashboard."""
        event_id = request.query_params.get('event')
        if not event_id:
            return Response({'detail': 'Param event required.'}, status=400)
        qs = EventRating.objects.filter(event_id=event_id)
        total = qs.count()
        breakdown = {
            'sad': qs.filter(rating='sad').count(),
            'neutral': qs.filter(rating='neutral').count(),
            'love': qs.filter(rating='love').count(),
        }
        love_pct = round(breakdown['love'] / total * 100, 1) if total else 0
        return Response({'total': total, 'breakdown': breakdown, 'love_pct': love_pct})


class ClubAccessTokenViewSet(viewsets.ModelViewSet):
    queryset = ClubAccessToken.objects.all()
    serializer_class = ClubAccessTokenSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return ClubAccessToken.objects.all()
        # Users see their own tokens, club admins see all tokens for their club
        return ClubAccessToken.objects.filter(
            models.Q(user=user) | models.Q(club__admins=user)
        ).distinct()

    def perform_create(self, serializer):
        club = serializer.validated_data['club']
        target_user = serializer.validated_data['user']
        current_user = self.request.user
        
        is_owner = (current_user == target_user)
        is_club_admin = club.admins.filter(pk=current_user.pk).exists()
        
        if not (is_owner or is_club_admin or current_user.is_staff):
            raise permissions.PermissionDenied("Permisos insuficientes para crear este token.")
            
        serializer.save()

