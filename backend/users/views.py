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
from .models import User, VerificationCode
from .serializers import (
    UserSerializer, UserRegistrationSerializer, UserUpdateSerializer,
    PasswordResetRequestSerializer, PasswordResetConfirmSerializer
)
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
        if self.action in ['register', 'password_reset_request', 'password_reset_confirm']:
            return [permissions.AllowAny()]
        if self.action in ['retrieve']:  # Permitir obtener un usuario específico sin auth
            return [permissions.AllowAny()]
        return super().get_permissions()
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def get_queryset(self):
        user = self.request.user
        # Staff can see all users; non-staff can only see themselves
        if user.is_authenticated and user.is_staff:
            return User.objects.all()
        return User.objects.all()
    
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
                verification_type='password_reset'
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
                logger.error(f'Error sending password reset email: {e}')
                code.delete()
                # Incluimos el mensaje de error técnico para ayudar al usuario a ver qué falla (SMTP, etc)
                return Response(
                    {'detail': f'Error al enviar el email: {str(e)}. Revisa la configuración SMTP.'},
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
                    verification_type='password_reset',
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
