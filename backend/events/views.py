from rest_framework import viewsets, permissions, status
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

from .models import Event, Registration, EmailLog, DistributionGroup, GroupAccessToken, GroupInvitation, AccessRequest, GroupAccessRequest
from .serializers import EventSerializer, RegistrationSerializer, AccessRequestSerializer, GroupAccessRequestSerializer
from .permissions import IsEventAdminOrReadOnly
from .permissions import IsGroupAdminOrCreatorOrEventAdmin
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
        
        # Filter by group
        group_id = self.request.query_params.get('group', None)
        if group_id:
            queryset = queryset.filter(group_id=group_id)
        
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
            # 2. Private events where they are group members or event admins
            public_events = dj_models.Q(is_public=True)
            is_event_admin = dj_models.Q(admins=user)
            is_group_member = dj_models.Q(group__members=user)
            queryset = queryset.filter(public_events | is_event_admin | is_group_member).distinct()
        
        # Ordering
        order_by = self.request.query_params.get('order_by', '-date')
        queryset = queryset.order_by(order_by)
        
        return queryset

    def perform_create(self, serializer):
        # If the event belongs to a group, check permissions: only group admins/creators or staff can create.
        user = getattr(self.request, 'user', None)
        group = serializer.validated_data.get('group') if hasattr(serializer, 'validated_data') else None
        event = serializer.save()
        if user and user.is_authenticated:
            # Make the creator an admin of the event by default
            event.admins.add(user)
            # If a group is present, ensure the creator is allowed (group admin/creator)
            if group is not None:
                if not (user.is_staff or group.admins.filter(pk=user.pk).exists() or group.creators.filter(pk=user.pk).exists()):
                    # rollback: remove event and raise permission denied
                    event.delete()
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied('Not allowed to create events for this group')

    @action(detail=True, methods=['post'], url_path='add_admin')
    def add_admin(self, request, pk=None):
        event = self.get_object()
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        from users.models import User as UserModel
        try:
            u = UserModel.objects.get(pk=user_id)
        except UserModel.DoesNotExist:
            return Response({'detail': 'user not found'}, status=status.HTTP_404_NOT_FOUND)
        event.admins.add(u)
        return Response({'detail': 'admin added'})

    @action(detail=True, methods=['post'], url_path='remove_admin')
    def remove_admin(self, request, pk=None):
        event = self.get_object()
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        from users.models import User as UserModel
        try:
            u = UserModel.objects.get(pk=user_id)
        except UserModel.DoesNotExist:
            return Response({'detail': 'user not found'}, status=status.HTTP_404_NOT_FOUND)
        event.admins.remove(u)
        return Response({'detail': 'admin removed'})

    @action(detail=True, methods=['get'], url_path='participants')
    def participants(self, request, pk=None):
        """Get all participants (users with registrations) for this event"""
        event = self.get_object()
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
    
    @action(detail=True, methods=['get'], url_path='access_requests')
    def access_requests(self, request, pk=None):
        """Obtener todas las solicitudes de acceso para este evento (solo admins)"""
        event = self.get_object()
        requests_qs = AccessRequest.objects.filter(event=event).select_related('user', 'reviewed_by')
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


class DistributionGroupViewSet(viewsets.ModelViewSet):
    queryset = DistributionGroup.objects.all()
    # read/list allowed for authenticated, modification restricted by IsGroupOrEventAdmin
    from .permissions import IsGroupOrEventAdmin
    permission_classes = [IsGroupOrEventAdmin]

    def get_serializer_class(self):
        from .serializers import DistributionGroupSerializer
        return DistributionGroupSerializer

    def get_queryset(self):
        # Mostrar TODOS los grupos para permitir que los usuarios los descubran
        return DistributionGroup.objects.all()

    def perform_create(self, serializer):
        group = serializer.save()
        # Make creator an admin of the group
        user = getattr(self.request, 'user', None)
        if user and user.is_authenticated:
            group.admins.add(user)
            group.creators.add(user)

    @action(detail=True, methods=['post'], url_path='add_member')
    def add_member(self, request, pk=None):
        group = self.get_object()
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        from users.models import User as UserModel
        try:
            u = UserModel.objects.get(pk=user_id)
        except UserModel.DoesNotExist:
            return Response({'detail': 'user not found'}, status=status.HTTP_404_NOT_FOUND)
        group.members.add(u)
        return Response({'detail': 'member added'})

    @action(detail=True, methods=['post'], url_path='remove_member')
    def remove_member(self, request, pk=None):
        group = self.get_object()
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        from users.models import User as UserModel
        try:
            u = UserModel.objects.get(pk=user_id)
        except UserModel.DoesNotExist:
            return Response({'detail': 'user not found'}, status=status.HTTP_404_NOT_FOUND)
        group.members.remove(u)
        return Response({'detail': 'member removed'})

    @action(detail=True, methods=['post'], url_path='add_event')
    def add_event(self, request, pk=None):
        group = self.get_object()
        event_id = request.data.get('event_id')
        if not event_id:
            return Response({'detail': 'event_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            ev = Event.objects.get(pk=event_id)
        except Event.DoesNotExist:
            return Response({'detail': 'event not found'}, status=status.HTTP_404_NOT_FOUND)
        group.events.add(ev)
        return Response({'detail': 'event added'})

    @action(detail=True, methods=['post'], url_path='add_creator')
    def add_creator(self, request, pk=None):
        group = self.get_object()
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        from users.models import User as UserModel
        try:
            u = UserModel.objects.get(pk=user_id)
        except UserModel.DoesNotExist:
            return Response({'detail': 'user not found'}, status=status.HTTP_404_NOT_FOUND)
        group.creators.add(u)
        return Response({'detail': 'creator added'})

    @action(detail=True, methods=['post'], url_path='add_admin')
    def add_admin(self, request, pk=None):
        group = self.get_object()
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        from users.models import User as UserModel
        try:
            u = UserModel.objects.get(pk=user_id)
        except UserModel.DoesNotExist:
            return Response({'detail': 'user not found'}, status=status.HTTP_404_NOT_FOUND)
        group.admins.add(u)
        return Response({'detail': 'admin added'})

    @action(detail=True, methods=['post'], url_path='remove_admin')
    def remove_admin(self, request, pk=None):
        group = self.get_object()
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        from users.models import User as UserModel
        try:
            u = UserModel.objects.get(pk=user_id)
        except UserModel.DoesNotExist:
            return Response({'detail': 'user not found'}, status=status.HTTP_404_NOT_FOUND)
        group.admins.remove(u)
        return Response({'detail': 'admin removed'})

    @action(detail=True, methods=['post'], url_path='join', permission_classes=[permissions.IsAuthenticated])
    def join_group(self, request, pk=None):
        """Join a group (public groups) or request access (private groups)"""
        group = self.get_object()
        user = request.user
        
        # Check if user is already a member
        if group.members.filter(pk=user.pk).exists():
            return Response({'detail': 'Already a member'}, status=status.HTTP_400_BAD_REQUEST)
        
        # If group is public, add user immediately
        if group.is_public:
            group.members.add(user)
            return Response({'detail': 'Successfully joined the group', 'is_member': True})
        else:
            # For private groups, create an access request
            existing_request = GroupAccessRequest.objects.filter(user=user, group=group, status='pending').first()
            if existing_request:
                return Response({'detail': 'Ya tienes una solicitud pendiente para este grupo'}, status=status.HTTP_400_BAD_REQUEST)
            
            access_request = GroupAccessRequest.objects.create(
                user=user,
                group=group,
                message=f'Solicitud de acceso al grupo {group.name}'
            )
            
            # Send email to group admins
            admin_emails = [admin.email for admin in group.admins.all() if admin.email]
            if admin_emails:
                subject = f'Nueva solicitud de acceso al grupo {group.name}'
                body = f'{user.username} ({user.email}) ha solicitado acceso al grupo "{group.name}".'
                try:
                    from django.core.mail import send_mail
                    send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, admin_emails, fail_silently=True)
                except Exception as e:
                    logger.error(f'Error sending email: {str(e)}')
            
            return Response({
                'detail': 'Access request sent to group admins',
                'is_member': False,
                'pending': True
            })
    
    @action(detail=True, methods=['post'], url_path='leave', permission_classes=[permissions.IsAuthenticated])
    def leave_group(self, request, pk=None):
        """Leave a group"""
        group = self.get_object()
        user = request.user
        
        # Check if user is a member
        if not group.members.filter(pk=user.pk).exists():
            return Response({'detail': 'Not a member'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Remove user from group
        group.members.remove(user)
        return Response({'detail': 'Successfully left the group'})
    
    @action(detail=True, methods=['post'], url_path='create_invitation')
    def create_invitation(self, request, pk=None):
        """Create a shareable invitation link for the group"""
        group = self.get_object()
        # Only admins/creators can create invitations
        user = request.user
        if not (user.is_staff or group.admins.filter(pk=user.pk).exists() or group.creators.filter(pk=user.pk).exists()):
            return Response({'detail': 'Only group admins can create invitations'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get optional parameters
        expires_in_days = request.data.get('expires_in_days', 7)  # Default 7 days
        max_uses = request.data.get('max_uses', None)  # Default unlimited
        
        # Create invitation
        from datetime import timedelta
        from django.utils import timezone
        expires_at = timezone.now() + timedelta(days=expires_in_days)
        
        invitation = GroupInvitation.objects.create(
            group=group,
            created_by=user,
            expires_at=expires_at,
            max_uses=max_uses
        )
        
        # Build shareable URL
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        invitation_url = f"{frontend_url}/#/join/{invitation.token}"
        
        return Response({
            'token': invitation.token,
            'url': invitation_url,
            'expires_at': invitation.expires_at,
            'max_uses': invitation.max_uses,
            'use_count': invitation.use_count
        })

    @action(detail=False, methods=['post'], url_path='accept_invitation')
    def accept_invitation(self, request):
        """Accept an invitation and join the group"""
        token = request.data.get('token')
        if not token:
            return Response({'detail': 'token is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            invitation = GroupInvitation.objects.get(token=token)
        except GroupInvitation.DoesNotExist:
            return Response({'detail': 'Invalid invitation token'}, status=status.HTTP_404_NOT_FOUND)
        
        # Validate invitation
        if not invitation.is_valid():
            return Response({'detail': 'Invitation has expired or reached max uses'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Add user to group
        user = request.user
        group = invitation.group
        
        # Check if user is already a member
        if group.members.filter(pk=user.pk).exists():
            return Response({'detail': 'You are already a member of this group'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Add user to members
        group.members.add(user)
        
        # Increment use count
        invitation.use_count += 1
        invitation.save()
        
        return Response({
            'detail': 'Successfully joined the group',
            'group_id': group.id,
            'group_name': group.name
        })

    @action(detail=True, methods=['get'], url_path='invitations')
    def list_invitations(self, request, pk=None):
        """List active invitations for the group (admin only)"""
        group = self.get_object()
        user = request.user
        
        # Only admins/creators can view invitations
        if not (user.is_staff or group.admins.filter(pk=user.pk).exists() or group.creators.filter(pk=user.pk).exists()):
            return Response({'detail': 'Only group admins can view invitations'}, status=status.HTTP_403_FORBIDDEN)
        
        invitations = group.invitations.filter(active=True).order_by('-created_at')
        
        # Build invitation data
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
            invitation = GroupInvitation.objects.get(token=token)
        except GroupInvitation.DoesNotExist:
            return Response({'detail': 'Invalid invitation token'}, status=status.HTTP_404_NOT_FOUND)
        
        group = invitation.group
        
        return Response({
            'valid': invitation.is_valid(),
            'group_name': group.name,
            'group_description': group.description,
            'created_by': invitation.created_by.username if invitation.created_by else None,
            'expires_at': invitation.expires_at,
            'max_uses': invitation.max_uses,
            'use_count': invitation.use_count
        })

    @action(detail=True, methods=['post'], url_path='request_access', permission_classes=[permissions.IsAuthenticated])
    def request_group_access(self, request, pk=None):
        """Solicitar acceso a un grupo"""
        group = self.get_object()
        user = request.user
        
        # Check if user is already a member
        if group.members.filter(pk=user.pk).exists():
            return Response({'detail': 'Ya eres miembro de este grupo'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if there's already a pending request
        existing_request = GroupAccessRequest.objects.filter(user=user, group=group, status='pending').first()
        if existing_request:
            return Response({'detail': 'Ya tienes una solicitud pendiente para este grupo'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create access request (limit message to 300 chars)
        raw_message = request.data.get('message', '') or ''
        message = raw_message[:300]
        access_request = GroupAccessRequest.objects.create(
            user=user,
            group=group,
            message=message
        )
        
        # Send email to group admins
        from django.core.mail import send_mail
        admin_emails = [admin.email for admin in group.admins.all() if admin.email]
        
        if admin_emails:
            subject = f'Nueva solicitud de acceso al grupo {group.name}'
            body = f'{user.username} ({user.email}) ha solicitado acceso al grupo "{group.name}".\n\n'
            if message:
                body += f'Mensaje: {message}\n\n'
            body += f'Puedes aprobar o rechazar esta solicitud desde la administración del grupo.'
            
            try:
                send_mail(
                    subject,
                    body,
                    settings.DEFAULT_FROM_EMAIL,
                    admin_emails,
                    fail_silently=False,
                )
            except Exception as e:
                logger.error(f'Error sending access request email: {e}')
        
        serializer = GroupAccessRequestSerializer(access_request, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='access_requests')
    def group_access_requests(self, request, pk=None):
        """Listar solicitudes de acceso al grupo (solo admins)"""
        group = self.get_object()
        user = request.user
        
        # Only admins can view access requests
        if not (user.is_staff or group.admins.filter(pk=user.pk).exists()):
            return Response({'detail': 'Solo los administradores pueden ver las solicitudes'}, status=status.HTTP_403_FORBIDDEN)
        
        requests = group.access_requests.all()
        serializer = GroupAccessRequestSerializer(requests, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='approve_access')
    def approve_group_access(self, request, pk=None):
        """Aprobar solicitud de acceso al grupo"""
        group = self.get_object()
        user = request.user
        
        # Only admins can approve
        if not (user.is_staff or group.admins.filter(pk=user.pk).exists()):
            return Response({'detail': 'Solo los administradores pueden aprobar solicitudes'}, status=status.HTTP_403_FORBIDDEN)
        
        request_id = request.data.get('request_id')
        if not request_id:
            return Response({'detail': 'request_id es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            access_request = GroupAccessRequest.objects.get(id=request_id, group=group)
        except GroupAccessRequest.DoesNotExist:
            return Response({'detail': 'Solicitud no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        
        if access_request.status != 'pending':
            return Response({'detail': 'Esta solicitud ya fue procesada'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Approve and add user to group
        access_request.status = 'approved'
        access_request.reviewed_by = user
        access_request.reviewed_at = timezone.now()
        access_request.save()
        
        group.members.add(access_request.user)
        
        # Send email to user
        if access_request.user.email:
            subject = f'Solicitud aprobada: {group.name}'
            body = f'Tu solicitud para unirte al grupo "{group.name}" ha sido aprobada.\n\nYa puedes acceder a los eventos del grupo.'
            
            try:
                send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [access_request.user.email], fail_silently=False)
            except Exception as e:
                logger.error(f'Error sending approval email: {e}')
        
        serializer = GroupAccessRequestSerializer(access_request, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='reject_access')
    def reject_group_access(self, request, pk=None):
        """Rechazar solicitud de acceso al grupo"""
        group = self.get_object()
        user = request.user
        
        # Only admins can reject
        if not (user.is_staff or group.admins.filter(pk=user.pk).exists()):
            return Response({'detail': 'Solo los administradores pueden rechazar solicitudes'}, status=status.HTTP_403_FORBIDDEN)
        
        request_id = request.data.get('request_id')
        admin_notes = request.data.get('admin_notes', '')
        
        if not request_id:
            return Response({'detail': 'request_id es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            access_request = GroupAccessRequest.objects.get(id=request_id, group=group)
        except GroupAccessRequest.DoesNotExist:
            return Response({'detail': 'Solicitud no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        
        if access_request.status != 'pending':
            return Response({'detail': 'Esta solicitud ya fue procesada'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Reject
        access_request.status = 'rejected'
        access_request.reviewed_by = user
        access_request.reviewed_at = timezone.now()
        access_request.admin_notes = admin_notes
        access_request.save()
        
        # Send email to user
        if access_request.user.email:
            subject = f'Solicitud rechazada: {group.name}'
            body = f'Tu solicitud para unirte al grupo "{group.name}" ha sido rechazada.'
            if admin_notes:
                body += f'\n\nMotivo: {admin_notes}'
            
            try:
                send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [access_request.user.email], fail_silently=False)
            except Exception as e:
                logger.error(f'Error sending rejection email: {e}')
        
        serializer = GroupAccessRequestSerializer(access_request, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='remove_creator')
    def remove_creator(self, request, pk=None):
        group = self.get_object()
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        from users.models import User as UserModel
        try:
            u = UserModel.objects.get(pk=user_id)
        except UserModel.DoesNotExist:
            return Response({'detail': 'user not found'}, status=status.HTTP_404_NOT_FOUND)
        group.creators.remove(u)
        return Response({'detail': 'creator removed'})

    @action(detail=True, methods=['post'], url_path='remove_event')
    def remove_event(self, request, pk=None):
        group = self.get_object()
        event_id = request.data.get('event_id')
        if not event_id:
            return Response({'detail': 'event_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            ev = Event.objects.get(pk=event_id)
        except Event.DoesNotExist:
            return Response({'detail': 'event not found'}, status=status.HTTP_404_NOT_FOUND)
        group.events.remove(ev)
        return Response({'detail': 'event removed'})


class RegistrationViewSet(viewsets.ModelViewSet):
    queryset = Registration.objects.all()
    serializer_class = RegistrationSerializer
    permission_classes = [IsEventAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Registration.objects.all()
        # Users see their own registrations or registrations for events they administer
        return Registration.objects.filter(dj_models.Q(user=user) | dj_models.Q(event__admins=user)).distinct()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        # Check max_qr_codes limit before creating
        event_id = serializer.validated_data.get('event')
        event = None
        if event_id:
            event = Event.objects.filter(pk=event_id.pk).first()
            if event and event.max_qr_codes:
                current_count = Registration.objects.filter(event=event).count()
                if current_count >= event.max_qr_codes:
                    from rest_framework.exceptions import ValidationError
                    raise ValidationError({'detail': f'Límite de registros alcanzado. Este evento solo permite {event.max_qr_codes} registros/QR.'})
        
        # Check if event has a price and process payment
        user = request.user
        if event and event.price > 0:
            # Get or create user's wallet
            wallet, created = Wallet.objects.get_or_create(user=user)
            
            # Check if user has sufficient balance
            if wallet.balance < event.price:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({
                    'detail': f'Saldo insuficiente. Necesitas {event.price} {wallet.currency} pero solo tienes {wallet.balance} {wallet.currency}.',
                    'required': float(event.price),
                    'available': float(wallet.balance)
                })
            
            # Deduct payment from wallet
            wallet.balance -= event.price
            wallet.save()
            
            # Create registration
            self.perform_create(serializer)
            registration = serializer.instance
            
            # Create transaction record
            Transaction.objects.create(
                wallet=wallet,
                amount=-event.price,
                transaction_type='payment',
                description=f'Pago por entrada a {event.name}',
                event=event,
                balance_after=wallet.balance
            )
        else:
            # Free event, just create registration
            self.perform_create(serializer)
            registration = serializer.instance

        # Generate PDF and send by email to the registrant if email is available
        try:
            pdf_bytes = generate_ticket_pdf_bytes(registration)
            recipient = getattr(registration.user, 'email', None)

            if recipient:
                subject = f'Ticket for {registration.event.name}'
                body = f'Adjunto su entrada para {registration.event.name}. Código: {registration.entry_code}'
                email = EmailMessage(subject, body, settings.DEFAULT_FROM_EMAIL, [recipient])
                email.attach(f'ticket_{registration.entry_code}.pdf', pdf_bytes, 'application/pdf')
                try:
                    send_result = email.send(fail_silently=False)
                    # record success in EmailLog
                    EmailLog.objects.create(
                        registration=registration,
                        recipient=recipient,
                        subject=subject,
                        body=body,
                        success=True,
                    )
                except Exception as e:
                    # log the exception and record failure
                    logger.error('Failed sending ticket email to %s: %s', recipient, str(e))
                    EmailLog.objects.create(
                        registration=registration,
                        recipient=recipient,
                        subject=subject,
                        body=body,
                        success=False,
                        error_text=str(e),
                    )
        except Exception as e:
            # PDF generation or other failure — log it and record an EmailLog entry if possible
            logger.error('Failed to generate/send ticket for registration %s: %s', registration.pk, str(e))
            recipient = getattr(registration.user, 'email', None)
            try:
                EmailLog.objects.create(
                    registration=registration,
                    recipient=recipient or '',
                    subject=f'Ticket for {registration.event.name}',
                    body='',
                    success=False,
                    error_text=str(e),
                )
            except Exception:
                pass

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['get'], url_path='download_ticket')
    def download_ticket(self, request, pk=None):
        """Generate a PDF ticket with embedded QR code for this registration."""
        registration = self.get_object()

        # Permission: allow owner, event admin or staff
        user = request.user
        event = registration.event
        is_admin = user.is_staff or event.admins.filter(pk=user.pk).exists()
        if not (is_admin or registration.user == user):
            return Response({'detail': 'No permission to download this ticket.'}, status=status.HTTP_403_FORBIDDEN)

        # Use helper to build PDF bytes
        pdf_bytes = generate_ticket_pdf_bytes(registration)
        filename = f'ticket_{registration.entry_code}.pdf'
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=True, methods=['post'], url_path='validate_qr')
    def validate_qr(self, request, pk=None):
        """Mark a registration as used when QR is scanned by an admin."""
        registration = self.get_object()
        user = request.user
        event = registration.event
        
        # Check if event belongs to a group and user is admin of that group
        if event.group:
            is_group_admin = event.group.admins.filter(pk=user.pk).exists()
            is_event_admin = event.admins.filter(pk=user.pk).exists()
            if not (user.is_staff or is_group_admin or is_event_admin):
                return Response({'detail': 'Solo admins del grupo pueden validar QR.'}, status=status.HTTP_403_FORBIDDEN)
        else:
            # Event not in group, check event admin
            is_admin = user.is_staff or event.admins.filter(pk=user.pk).exists()
            if not is_admin:
                return Response({'detail': 'No tienes permisos para validar este QR.'}, status=status.HTTP_403_FORBIDDEN)
        
        if registration.used:
            return Response({
                'detail': 'Este QR ya fue usado anteriormente.',
                'already_used': True,
                'registration': RegistrationSerializer(registration).data
            }, status=status.HTTP_200_OK)
        
        registration.used = True
        registration.save()
        
        return Response({
            'detail': 'QR validado exitosamente.',
            'already_used': False,
            'registration': RegistrationSerializer(registration).data
        }, status=status.HTTP_200_OK)


class GroupAccessTokenViewSet(viewsets.ModelViewSet):
    from .serializers import GroupAccessTokenSerializer
    serializer_class = GroupAccessTokenSerializer
    queryset = GroupAccessToken.objects.all()
    permission_classes = [IsGroupAdminOrCreatorOrEventAdmin]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return GroupAccessToken.objects.all()
        # users see their own tokens; group admins/creators can see tokens for their groups
        return GroupAccessToken.objects.filter(dj_models.Q(user=user) | dj_models.Q(group__admins=user) | dj_models.Q(group__creators=user)).distinct()

    def perform_create(self, serializer):
        user = self.request.user
        obj = serializer.save()
        return obj

    @action(detail=True, methods=['get'], url_path='download_qr')
    def download_qr(self, request, pk=None):
        token = self.get_object()
        # permission: owner, group admin/creator, staff
        user = request.user
        if not (user.is_staff or token.user == user or token.group.admins.filter(pk=user.pk).exists() or token.group.creators.filter(pk=user.pk).exists()):
            return Response({'detail': 'No permission to access this token'}, status=status.HTTP_403_FORBIDDEN)
        if token.qr_code and hasattr(token.qr_code, 'path'):
            with open(token.qr_code.path, 'rb') as f:
                data = f.read()
            response = HttpResponse(data, content_type='image/png')
            response['Content-Disposition'] = f'attachment; filename="token_{token.pk}.png"'
            return response
        return Response({'detail': 'No QR available'}, status=status.HTTP_404_NOT_FOUND)


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
        """Add funds to wallet (deposit)"""
        wallet = self.get_object()
        if wallet.user != request.user and not request.user.is_staff:
            return Response({'detail': 'No tienes permiso para agregar fondos a esta billetera'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        amount = request.data.get('amount')
        if not amount:
            return Response({'detail': 'amount es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            amount = Decimal(str(amount))
            if amount <= 0:
                return Response({'detail': 'El monto debe ser mayor a 0'}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({'detail': 'Monto inválido'}, status=status.HTTP_400_BAD_REQUEST)
        
        wallet.balance += amount
        wallet.save()
        
        # Create transaction record
        Transaction.objects.create(
            wallet=wallet,
            amount=amount,
            transaction_type='deposit',
            description=request.data.get('description', 'Depósito de fondos'),
            balance_after=wallet.balance
        )
        
        return Response({
            'detail': 'Fondos agregados exitosamente',
            'new_balance': wallet.balance
        })
    
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


class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Transaction.objects.all()
        return Transaction.objects.filter(wallet__user=user)
