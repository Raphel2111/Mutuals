# Version: 1.0.1+ (Force redeploy)
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from django.shortcuts import redirect
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import (
    UserSerializer, UserRegistrationSerializer, UserUpdateSerializer,
    PasswordResetRequestSerializer, PasswordResetConfirmSerializer,
    InterestTagSerializer
)
from .models import User, VerificationCode, InterestTag
import jwt
import logging

logger = logging.getLogger(__name__)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        if self.action == 'register':
            return UserRegistrationSerializer
        if self.action == 'password_reset_request':
            return PasswordResetRequestSerializer
        if self.action == 'password_reset_confirm':
            return PasswordResetConfirmSerializer
        return UserSerializer
    
    def get_permissions(self):
        """Override permissions for specific actions"""
        if self.action in ['register', 'password_reset_request', 'password_reset_confirm', 'ping']:
            return [permissions.AllowAny()]
        if self.action in ['retrieve']:  # Permitir obtener un usuario específico sin auth
            return [permissions.AllowAny()]
        return super().get_permissions()
    
    def get_serializer_context(self):
        return super().get_serializer_context()

    @action(detail=False, methods=['get'], url_path='ping', permission_classes=[permissions.AllowAny], authentication_classes=[])
    def ping(self, request):
        """Endpoint para verificar conectividad y CORS"""
        return Response({'status': 'ok', 'message': 'Backend is reachable'}, status=status.HTTP_200_OK)
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def get_queryset(self):
        queryset = User.objects.all()
        email = self.request.query_params.get('email')
        if email:
            queryset = queryset.filter(email__iexact=email)
        return queryset
    
    def update(self, request, *args, **kwargs):
        """Only allow users to update their own profile"""
        user = self.get_object()
        if user.pk != request.user.pk and not request.user.is_staff:
            return Response(
                {'detail': 'No puedes editar el perfil de otro usuario'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)
    
    def partial_update(self, request, *args, **kwargs):
        """Only allow users to update their own profile"""
        user = self.get_object()
        if user.pk != request.user.pk and not request.user.is_staff:
            return Response(
                {'detail': 'No puedes editar el perfil de otro usuario'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=['get'], url_path='public_profile',
            permission_classes=[permissions.AllowAny])
    def public_profile(self, request, pk=None):
        """
        GET /api/users/{id}/public_profile/
        Public Social Resume — one optimised query, AllowAny.
        """
        from .serializers import PublicProfileSerializer
        from events.models import Registration
        from django.db.models import Prefetch

        try:
            user = (
                User.objects
                .prefetch_related(
                    Prefetch(
                        'club_memberships',
                        queryset=__import__('events.models', fromlist=['ClubMembership'])
                            .ClubMembership.objects
                            .filter(status='approved')
                            .select_related('club'),
                        to_attr='approved_memberships',
                    ),
                    'interests',
                    Prefetch(
                        'registrations',
                        queryset=Registration.objects
                            .filter(status='valid')
                            .select_related('event')
                            .order_by('-event__date'),
                        to_attr='last_events_list',
                    ),
                    'profile',
                )
                .get(pk=pk)
            )
        except User.DoesNotExist:
            return Response({'detail': 'Usuario no encontrado.'}, status=404)

        # Slice to 3 after prefetch (slicing in Prefetch breaks combine with .get())
        user.last_events_list = user.last_events_list[:3]

        serializer = PublicProfileSerializer(user, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='toggle_event_history')
    def toggle_event_history(self, request, pk=None):
        """POST /api/users/{id}/toggle_event_history/ — flip privacy toggle."""
        user = self.get_object()
        if user.pk != request.user.pk and not request.user.is_staff:
            return Response({'detail': 'Sin permisos.'}, status=403)
        profile, _ = __import__('users.models', fromlist=['UserProfile']).UserProfile.objects.get_or_create(user=user)
        profile.show_event_history = not profile.show_event_history
        profile.save(update_fields=['show_event_history'])
        return Response({'show_event_history': profile.show_event_history})

    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        """Return the currently logged in user's profile."""
        if not request.user.is_authenticated:
            return Response({'detail': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='for_select')
    def for_select(self, request):
        """Return a minimal list of users for populating selects in the frontend.

        Accessible to any authenticated user.
        """
        qs = User.objects.all().only('id', 'username', 'email')
        serializer = UserSerializer(qs, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny], url_path='make-superuser')
    def make_superuser(self, request):
        """Temporary endpoint to make a user superuser - REMOVE AFTER USE"""
        username = request.data.get('username')
        secret = request.data.get('secret')
        
        # Simple secret protection
        if secret != 'EventoApp2024Admin':
            return Response({'detail': 'Invalid secret'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            user = User.objects.get(username=username)
            user.is_superuser = True
            user.is_staff = True
            user.email_verified = True
            user.save()
            return Response({'detail': f'User {username} is now superuser'})
        except User.DoesNotExist:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny], authentication_classes=[], url_path='register')
    def register(self, request):
        """Public endpoint for user registration."""
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                'detail': 'Usuario registrado exitosamente',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'phone': user.phone
                }
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='magic-login', permission_classes=[permissions.AllowAny], authentication_classes=[])
    def magic_login(self, request):
        """Valida un Magic Link y loguea al usuario."""
        token = request.data.get('token')
        if not token:
            return Response({'error': 'Token missing'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            user_id = payload.get('user_id')
            email = payload.get('email')
            
            if user_id:
                user = User.objects.filter(id=user_id).first()
            else:
                user = User.objects.filter(email=email).first()
                
            if not user:
                return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
                
            refresh = RefreshToken.for_user(user)
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email
                }
            })
        except jwt.ExpiredSignatureError:
            return Response({'error': 'Link expired'}, status=status.HTTP_401_UNAUTHORIZED)
        except jwt.InvalidTokenError:
            return Response({'error': 'Invalid link'}, status=status.HTTP_401_UNAUTHORIZED)

    @action(detail=False, methods=['post'], url_path='send-magic-link', permission_classes=[permissions.AllowAny], authentication_classes=[])
    def send_magic_link(self, request):
        """Generates a temporary magic link and sends it via email. 
        Supports auto-creating guests if 'create_guest' is True."""
        email = request.data.get('email', '').strip().lower()
        create_guest = request.data.get('create_guest', False)

        if not email:
            return Response({'error': 'Email missing'}, status=status.HTTP_400_BAD_REQUEST)
            
        user = User.objects.filter(email=email).first()
        
        if not user and create_guest:
            # Create a guest user
            username = email.split('@')[0]
            # Ensure unique username
            base_username = username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}_{counter}"
                counter += 1
            
            user = User.objects.create_user(
                username=username,
                email=email,
                password=User.objects.make_random_password(),
                is_active=True
            )
            # Create profile and wallet for the new guest
            if not hasattr(user, 'profile'):
                from .models import UserProfile
                UserProfile.objects.create(user=user)
            from payments.models import Wallet
            Wallet.objects.get_or_create(user=user)

        if not user:
             return Response({'error': 'User not found and guest creation not requested'}, status=status.HTTP_404_NOT_FOUND)
        
        # Generate token valid for 15 minutes
        from datetime import datetime, timedelta
        payload = {
            'user_id': user.id,
            'email': email,
            'exp': datetime.utcnow() + timedelta(minutes=15),
            'iat': datetime.utcnow()
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
        
        magic_link = f"{settings.FRONTEND_URL}/#/magic-login?token={token}"
        
        # Send email
        try:
            subject = 'Your Ticket / Magic Link - MUTUALS'
            message = f'''Hello,

Click the link below to securely access your tickets and account:

{magic_link}

This link will expire in 15 minutes.

Cheers,
Mutuals Team
            '''
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
            )
            return Response({'detail': 'Magic link sent successfully'})
        except Exception as e:
            logger.error(f'Error sending magic link: {e}')
            return Response({'error': 'Failed to send email'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], url_path='send-email-verification')
    def send_email_verification(self, request):
        """Envía código de verificación por email"""
        user = request.user
        
        if user.email_verified:
            return Response({'detail': 'Tu email ya está verificado'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not user.email:
            return Response({'detail': 'No tienes un email configurado'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Crear código de verificación
        code = VerificationCode.objects.create(
            user=user,
            verification_type='email'
        )
        
        # Enviar email
        try:
            subject = 'Código de verificación - EventoApp'
            message = f'''
Hola {user.username},

Tu código de verificación es: {code.code}

Este código expirará en 15 minutos.

Si no solicitaste este código, ignora este mensaje.

Saludos,
EventoApp
            '''
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )
            return Response({
                'detail': 'Código de verificación enviado a tu email',
                'expires_at': code.expires_at
            })
        except Exception as e:
            logger.error(f'Error sending verification email: {e}')
            code.delete()
            return Response(
                {'detail': 'Error al enviar el email. Inténtalo de nuevo más tarde.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], url_path='verify-email')
    def verify_email(self, request):
        """Verifica el código de email"""
        user = request.user
        code_input = request.data.get('code', '').strip()
        
        if not code_input:
            return Response({'detail': 'El código es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Buscar código válido más reciente
        try:
            code = VerificationCode.objects.filter(
                user=user,
                verification_type='email',
                code=code_input,
                used=False
            ).latest('created_at')
            
            if not code.is_valid():
                return Response(
                    {'detail': 'El código ha expirado. Solicita uno nuevo.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Marcar código como usado y verificar email
            code.used = True
            code.save()
            
            user.email_verified = True
            user.save()
            
            return Response({
                'detail': 'Email verificado exitosamente',
                'email_verified': True
            })
            
        except VerificationCode.DoesNotExist:
            return Response(
                {'detail': 'Código inválido'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['post'], url_path='send-phone-verification')
    def send_phone_verification(self, request):
        """Envía código de verificación por SMS (simulado por ahora)"""
        user = request.user
        
        if user.phone_verified:
            return Response({'detail': 'Tu teléfono ya está verificado'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not user.phone:
            return Response({'detail': 'No tienes un teléfono configurado'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Crear código de verificación
        code = VerificationCode.objects.create(
            user=user,
            verification_type='phone'
        )
        
        # TODO: Integrar con servicio de SMS (Twilio, AWS SNS, etc.)
        # Por ahora, simplemente devolvemos el código en la respuesta (solo para desarrollo)
        logger.info(f'SMS code for {user.username} ({user.phone}): {code.code}')
        
        return Response({
            'detail': f'Código enviado por SMS a {user.phone}',
            'expires_at': code.expires_at,
            # SOLO PARA DESARROLLO - Remover en producción
            'dev_code': code.code if settings.DEBUG else None
        })
    
    @action(detail=False, methods=['post'], url_path='verify-phone')
    def verify_phone(self, request):
        """Verifica el código de teléfono"""
        user = request.user
        code_input = request.data.get('code', '').strip()
        
        if not code_input:
            return Response({'detail': 'El código es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Buscar código válido más reciente
        try:
            code = VerificationCode.objects.filter(
                user=user,
                verification_type='phone',
                code=code_input,
                used=False
            ).latest('created_at')
            
            if not code.is_valid():
                return Response(
                    {'detail': 'El código ha expirado. Solicita uno nuevo.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Marcar código como usado y verificar teléfono
            code.used = True
            code.save()
            
            user.phone_verified = True
            user.save()
            
            return Response({
                'detail': 'Teléfono verificado exitosamente',
                'phone_verified': True
            })
            
        except VerificationCode.DoesNotExist:
            return Response(
                {'detail': 'Código inválido'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'], url_path='discover-people')
    def discover_people(self, request):
        """
        Radar Discovery: Returns users who share interest tags with the
        authenticated user, sorted by match score (number of shared tags).
        """
        user = request.user
        my_tag_ids = set(user.interests.values_list('id', flat=True))
        if not my_tag_ids:
            return Response({'people': [], 'message': 'Añade intereses a tu perfil para descubrir gente.'})

        # Get users with at least one shared interest (exclude self)
        candidates = (
            User.objects
            .exclude(pk=user.pk)
            .filter(interests__id__in=my_tag_ids)
            .prefetch_related('interests')
            .distinct()
        )

        results = []
        for u in candidates[:50]:  # cap at 50
            their_tag_ids = set(u.interests.values_list('id', flat=True))
            shared = my_tag_ids.intersection(their_tag_ids)
            avatar_url = None
            if u.avatar:
                try:
                    avatar_url = request.build_absolute_uri(u.avatar.url)
                except Exception:
                    pass
            results.append({
                'id': u.id,
                'username': u.username,
                'full_name': f'{u.first_name} {u.last_name}'.strip() or u.username,
                'avatar_url': avatar_url,
                'bio': u.bio or '',
                'match_score': len(shared),
                'shared_tag_ids': list(shared),
                'interests': [{'id': t.id, 'name': t.name, 'category': t.category} for t in u.interests.all()],
            })

        results.sort(key=lambda x: x['match_score'], reverse=True)
        return Response({'people': results})

    @action(detail=False, methods=['post'], url_path='password-reset-request', permission_classes=[permissions.AllowAny], authentication_classes=[])
    def password_reset_request(self, request):
        """Solicita restablecimiento de contraseña"""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            user = User.objects.filter(email=email).first()
            
            if not user:
                return Response({'detail': 'No existe ningún usuario con este email'}, status=status.HTTP_404_NOT_FOUND)
            
            # Crear código
            code = VerificationCode.objects.create(
                user=user,
                verification_type='reset'
            )
            
            # Enviar email
            try:
                subject = 'Restablecer contraseña - EventoApp'
                message = f'''
Hola {user.username},

Has solicitado restablecer tu contraseña. Tu código de verificación es:

{code.code}

Este código expirará en 15 minutos.

Si no solicitaste esto, ignora este mensaje.

Saludos,
EventoApp
                '''
                send_mail(
                    subject,
                    message,
                    settings.DEFAULT_FROM_EMAIL,
                    [user.email],
                    fail_silently=False,
                )
                return Response({'detail': 'Código de restablecimiento enviado a tu email'})
            except Exception as e:
                import traceback
                error_trace = traceback.format_exc()
                logger.error(f"Error in password_reset_request: {error_trace}")
                # Incluimos el mensaje de error técnico para ayudar al usuario a ver qué falla (SMTP, etc)
                return Response(
                    {'detail': f'Error al enviar el email: {str(e)}. Revisa la configuración SMTP. Trace: {error_trace[:200]}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        # Handle serializer errors (like invalid email format)
        error_msg = 'Datos inválidos'
        if serializer.errors:
            if 'email' in serializer.errors:
                error_msg = serializer.errors['email'][0]
        return Response({'detail': error_msg}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='password-reset-confirm', permission_classes=[permissions.AllowAny], authentication_classes=[])
    def password_reset_confirm(self, request):
        """Confirma el restablecimiento de contraseña"""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            code_input = serializer.validated_data['code']
            password = serializer.validated_data['password']
            
            try:
                user = User.objects.get(email=email)
                code = VerificationCode.objects.filter(
                    user=user,
                    verification_type='reset',
                    code=code_input,
                    used=False
                ).latest('created_at')
                
                if not code.is_valid():
                    return Response(
                        {'detail': 'El código ha expirado. Solicita uno nuevo.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Todo correcto: cambiar contraseña
                user.set_password(password)
                user.save()
                
                # Marcar código como usado
                code.used = True
                code.save()
                
                return Response({'detail': 'Contraseña restablecida exitosamente'})
                
            except (User.DoesNotExist, VerificationCode.DoesNotExist):
                return Response(
                    {'detail': 'Datos inválidos o código incorrecto'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OAuthCallbackView(APIView):
    """
    View to handle OAuth callback and return JWT tokens.
    After user authenticates with Google/Facebook, they are redirected here.
    The tokens should have been stored in session by the pipeline.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []  # Don't use JWT auth for this endpoint
    
    def get(self, request):
        logger.info(f"OAuth callback - Session data: {dict(request.session)}")
        
        # Try to get tokens from session (set by pipeline)
        access_token = request.session.get('oauth_access_token')
        refresh_token = request.session.get('oauth_refresh_token')
        
        if access_token and refresh_token:
            logger.info(f"OAuth callback - Found tokens in session")
            
            # Clear tokens from session
            del request.session['oauth_access_token']
            del request.session['oauth_refresh_token']
            request.session.save()
            
            # Redirect to frontend with tokens
            redirect_url = f"{settings.FRONTEND_URL}/#/oauth-success?access={access_token}&refresh={refresh_token}"
            logger.info(f"OAuth callback - Redirecting with tokens to: {redirect_url[:100]}...")
            return redirect(redirect_url)
        
        # Fallback: try to get user from session
        user = request.user
        logger.info(f"OAuth callback - User authenticated: {user.is_authenticated}")
        logger.info(f"OAuth callback - User: {user}")
        
        if not user.is_authenticated:
            logger.error("OAuth callback - No tokens in session and user not authenticated")
            return redirect(f"{settings.FRONTEND_URL}/#/?error=oauth_failed")
        
        # Generate tokens if not in session
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token_str = str(refresh)
        
        logger.info(f"OAuth callback - Generated new tokens for user {user.username}")
        
        # Redirect to frontend with tokens
        redirect_url = f"{settings.FRONTEND_URL}/#/oauth-success?access={access_token}&refresh={refresh_token_str}"
        logger.info(f"OAuth callback - Redirecting to: {redirect_url[:100]}...")
        return redirect(redirect_url)

class InterestTagViewSet(viewsets.ModelViewSet):
    """
    API endpoint for listing, searching, and creating InterestTags.
    Any authenticated user can create new tags.
    """
    queryset = InterestTag.objects.all().order_by('name')
    serializer_class = InterestTagSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset

    def create(self, request, *args, **kwargs):
        """Create a new interest tag (or return existing if name matches)."""
        name = request.data.get('name', '').strip()
        category = request.data.get('category', 'General').strip()
        if not name:
            return Response({'detail': 'El nombre es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(name) > 50:
            return Response({'detail': 'Máximo 50 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)
        tag, created = InterestTag.objects.get_or_create(
            name__iexact=name,
            defaults={'name': name, 'category': category}
        )
        serializer = self.get_serializer(tag)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

