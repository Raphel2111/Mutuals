from rest_framework import serializers
from .models import User, InterestTag

class InterestTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterestTag
        fields = ['id', 'name', 'category']

class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    default_avatar_url = serializers.SerializerMethodField()
    interests = InterestTagSerializer(many=True, read_only=True)
    
    availability_status = serializers.BooleanField(source='profile.availability_status', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone', 'avatar', 'avatar_url', 'default_avatar_url', 'bio', 'email_verified', 'phone_verified', 'is_staff', 'interests', 'availability_status']
        read_only_fields = ['avatar_url', 'default_avatar_url', 'email_verified', 'phone_verified', 'is_staff']
    
    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return self.get_default_logo_url(obj) # Fallback to default logic

    def get_default_avatar_url(self, obj):
        return f"https://ui-avatars.com/api/?name={obj.username}&background=random&size=128"
    
    def get_default_logo_url(self, obj):
        # Helper for compatibility if get_avatar_url calls it
        return self.get_default_avatar_url(obj)

    def get_default_avatar_url(self, obj):
        return f"https://ui-avatars.com/api/?name={obj.username}&background=random&size=128"


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    first_name = serializers.CharField(required=True)
    last_name = serializers.CharField(required=True)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'phone', 'password', 'password_confirm']
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Las contraseñas no coinciden"})
        return attrs
    
    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Este email ya está registrado")
        return value
    
    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Este nombre de usuario ya está en uso")
        return value
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            phone=validated_data.get('phone', ''),
            password=validated_data['password']
        )
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile"""
    interests = serializers.PrimaryKeyRelatedField(
        queryset=InterestTag.objects.all(),
        many=True,
        required=False
    )
    
    availability_status = serializers.BooleanField(source='profile.availability_status', required=False)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'phone', 'bio', 'avatar', 'interests', 'availability_status']
        read_only_fields = ['username']  # No permitir cambiar username

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})
        
        # Actualizar campos nativos del User
        instance = super().update(instance, validated_data)
        
        # Actualizar campos del UserProfile
        if profile_data:
            profile = instance.profile
            if 'availability_status' in profile_data:
                profile.availability_status = profile_data['availability_status']
            profile.save()
            
        return instance
    
    def validate_email(self, value):
        user = self.instance
        if User.objects.filter(email=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("Este email ya está registrado")
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError("No existe ningún usuario con este email")
        return value


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)
    password = serializers.CharField(min_length=8, write_only=True)
    password_confirm = serializers.CharField(min_length=8, write_only=True)

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({"password": "Las contraseñas no coinciden"})
        return data


# ─── Profile 2.0 — Public Social Resume Serializer ───────────────────────────

class PublicBadgeSerializer(serializers.Serializer):
    """Flattened representation of a ClubMembership for the badge wall."""
    club_name = serializers.SerializerMethodField()
    club_image_url = serializers.SerializerMethodField()
    badge = serializers.CharField()
    events_attended = serializers.IntegerField()

    def get_club_name(self, obj):
        return obj.club.name if obj.club else ''

    def get_club_image_url(self, obj):
        request = self.context.get('request')
        if obj.club and obj.club.image:
            return request.build_absolute_uri(obj.club.image.url) if request else obj.club.image.url
        return None


class PublicLastEventSerializer(serializers.Serializer):
    """Minimal event snapshot for the 'Visto en...' timeline."""
    name = serializers.CharField(source='event.name')
    date = serializers.DateTimeField(source='event.date')
    location = serializers.CharField(source='event.location', allow_null=True)


class PublicProfileSerializer(serializers.ModelSerializer):
    """
    Social Resume — read-only, AllowAny.
    Single optimised query via prefetch_related on UserViewSet.public_profile action.
    """
    full_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    slug = serializers.CharField(read_only=True)
    badges = serializers.SerializerMethodField()
    interests = InterestTagSerializer(many=True, read_only=True)
    last_events = serializers.SerializerMethodField()
    connections_count = serializers.SerializerMethodField()
    show_event_history = serializers.SerializerMethodField()
    activity_level = serializers.SerializerMethodField()   # 'high' | 'mid' | 'low'
    
    # Mutual Insights
    mutual_interests = serializers.SerializerMethodField()
    mutual_events_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'slug', 'full_name', 'bio', 'avatar_url',
            'badges', 'interests', 'last_events', 'connections_count',
            'show_event_history', 'activity_level',
            'mutual_interests', 'mutual_events_count',
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username

    def get_avatar_url(self, obj):
        request = self.context.get('request')
        if obj.avatar:
            return request.build_absolute_uri(obj.avatar.url) if request else obj.avatar.url
        return f"https://ui-avatars.com/api/?name={obj.username}&background=random&size=200"

    def get_badges(self, obj):
        """Return approved memberships — top badges first (vip > founder > loyal > member)."""
        order = {'vip': 0, 'founder': 1, 'loyal': 2, 'member': 3}
        memberships = [m for m in getattr(obj, 'approved_memberships', []) if m.status == 'approved']
        memberships.sort(key=lambda m: order.get(m.badge, 9))
        return PublicBadgeSerializer(memberships, many=True, context=self.context).data

    def get_last_events(self, obj):
        """Return last 3 attended events — gated by privacy toggle."""
        try:
            if not obj.profile.show_event_history:
                return []
        except Exception:
            pass
        events = getattr(obj, 'last_events_list', [])
        return PublicLastEventSerializer(events, many=True).data

    def get_connections_count(self, obj):
        """Count confirmed connections — both directions."""
        from events.models import Connection
        from django.db import models as dj_models
        return Connection.objects.filter(
            dj_models.Q(from_user=obj) | dj_models.Q(to_user=obj),
            status='confirmed'
        ).count()

    def get_show_event_history(self, obj):
        try:
            return obj.profile.show_event_history
        except Exception:
            return True

    def get_activity_level(self, obj):
        """Used by Frontend to colour the neon ring: high ≥5 events, mid 1-4, low 0."""
        events = getattr(obj, 'last_events_list', [])
        count = len(events)
        if count >= 3:
            return 'high'
        if count >= 1:
            return 'mid'
        return 'low'

    def get_mutual_interests(self, obj):
        """Returns the IDs of interests shared between the requester and the profile owner."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated or request.user.id == obj.id:
            return []
        
        my_interests = set(request.user.interests.values_list('id', flat=True))
        their_interests = set(obj.interests.values_list('id', flat=True))
        return list(my_interests.intersection(their_interests))

    def get_mutual_events_count(self, obj):
        """Count how many events both users have attended."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated or request.user.id == obj.id:
            return 0
            
        from events.models import Registration
        my_events = set(Registration.objects.filter(user=request.user, status='valid').values_list('event_id', flat=True))
        their_events = set(Registration.objects.filter(user=obj, status='valid').values_list('event_id', flat=True))
        return len(my_events.intersection(their_events))
