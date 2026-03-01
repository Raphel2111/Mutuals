from rest_framework import serializers
from .models import Event, Registration, AccessRequest, Wallet, Transaction, Club, ClubMembership, ClubPost, ClubInvitation, ClubAccessToken
from users.models import User
from rest_framework import exceptions

class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'role', 'avatar', 'avatar_url']
    
    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return f"https://ui-avatars.com/api/?name={obj.username}&background=random&size=128"

    def get_default_avatar_url(self, obj):
        return f"https://ui-avatars.com/api/?name={obj.username}&background=random&size=128"


class ForSelectUserSerializer(serializers.ModelSerializer):
    """Minimal serializer for populating selects in the frontend — does not expose emails."""
    class Meta:
        model = User
        fields = ['id', 'username']

class EventSerializer(serializers.ModelSerializer):
    admins = UserSerializer(many=True, read_only=True)
    club = serializers.PrimaryKeyRelatedField(queryset=Club.objects.all(), allow_null=True, required=False)
    club_name = serializers.CharField(source='club.name', read_only=True)

    is_admin = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = ['id','name','description','date','location','capacity','max_qr_codes','admins','club','club_name','requires_approval','is_public','price','registration_deadline','is_admin']

    def get_is_admin(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        user = request.user
        return (
            user.is_staff or 
            user.role == 'admin' or
            obj.admins.filter(pk=user.pk).exists() or 
            (obj.club and obj.club.admins.filter(pk=user.pk).exists())
        )

class RegistrationSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    qr_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Registration
        fields = ['id','user','event','entry_code','qr_code','qr_url','used', 'attendee_first_name', 'attendee_last_name', 'attendee_type', 'alias', 'created_at', 'attended_at', 'status']
        read_only_fields = ['entry_code','qr_code','qr_url', 'created_at', 'attended_at']

    def get_qr_url(self, obj):
        request = self.context.get('request')
        if obj.qr_code and hasattr(obj.qr_code, 'url'):
            return request.build_absolute_uri(obj.qr_code.url) if request else obj.qr_code.url
        return None

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Nest event details for read operations
        if instance.event:
            ret['event'] = EventSerializer(instance.event).data
        return ret

    def create(self, validated_data):
        # associate the registration with the request user if available
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            user = request.user
        else:
            user = validated_data.get('user')
        registration = Registration(user=user, **{k: v for k, v in validated_data.items() if k != 'user'})
        registration.save()
        return registration


from .models import Event

class ClubSerializer(serializers.ModelSerializer):
    members_count       = serializers.SerializerMethodField()
    is_member           = serializers.SerializerMethodField()
    my_badge            = serializers.SerializerMethodField()
    my_membership_status = serializers.SerializerMethodField()
    image_url           = serializers.SerializerMethodField()
    is_admin            = serializers.SerializerMethodField()
    is_paid             = serializers.SerializerMethodField()

    class Meta:
        model = Club
        fields = [
            'id', 'name', 'slug', 'description', 'image', 'image_url', 'is_private', 'admins',
            'members_count', 'is_member', 'my_badge', 'my_membership_status', 'is_admin',
            'monthly_price', 'annual_price', 'membership_benefits',
            'stripe_account_status', 'is_paid',
        ]

    def get_members_count(self, obj):
        return obj.memberships.filter(status='approved').count()

    def get_is_member(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.memberships.filter(user=request.user, status='approved').exists()

    def get_my_badge(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        membership = obj.memberships.filter(user=request.user, status='approved').first()
        return membership.badge if membership else None

    def get_my_membership_status(self, obj):
        """Returns the current user's membership status: 'approved'|'pending'|'rejected'|None."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        membership = obj.memberships.filter(user=request.user).first()
        return membership.status if membership else None

    def get_is_admin(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.admins.filter(pk=request.user.pk).exists()

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def get_is_paid(self, obj):
        return float(obj.monthly_price or 0) > 0 or float(obj.annual_price or 0) > 0

class ClubMembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    club_name = serializers.CharField(source='club.name', read_only=True)
    badge_display = serializers.CharField(source='get_badge_display', read_only=True)

    class Meta:
        model = ClubMembership
        fields = ['id', 'user', 'club', 'club_name', 'status', 'badge', 'badge_display', 'events_attended', 'message', 'requested_at', 'joined_at']
        read_only_fields = ['status', 'badge', 'events_attended', 'joined_at']




class AccessRequestSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    event_id = serializers.IntegerField(source='event.id', read_only=True)
    event_name = serializers.CharField(source='event.name', read_only=True)
    reviewed_by = UserSerializer(read_only=True)
    
    class Meta:
        model = AccessRequest
        fields = ['id', 'user', 'event_id', 'event_name', 'status', 'message', 'requested_at', 'reviewed_at', 'reviewed_by', 'admin_notes']
        read_only_fields = ['status', 'requested_at', 'reviewed_at', 'reviewed_by', 'admin_notes']





class WalletSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = Wallet
        fields = ['id', 'user', 'user_username', 'balance', 'currency', 'created_at', 'updated_at']
        read_only_fields = ['balance', 'created_at', 'updated_at']


class TransactionSerializer(serializers.ModelSerializer):
    event_name = serializers.CharField(source='event.name', read_only=True, allow_null=True)
    
    class Meta:
        model = Transaction
        fields = ['id', 'wallet', 'amount', 'transaction_type', 'description', 'event', 'event_name', 'created_at', 'balance_after']
        read_only_fields = ['created_at', 'balance_after']


# ─── Networking CRM ──────────────────────────────────────────────────────────

from .models import Connection, EventPhoto, EventRating

class ConnectionSerializer(serializers.ModelSerializer):
    from_user = UserSerializer(read_only=True)
    to_user = UserSerializer(read_only=True)
    to_user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='to_user', write_only=True
    )
    event_name = serializers.CharField(source='event.name', read_only=True, allow_null=True)

    class Meta:
        model = Connection
        fields = [
            'id', 'from_user', 'to_user', 'to_user_id', 'event', 'event_name',
            'status', 'confirmed_by_from', 'confirmed_by_to', 'created_at'
        ]
        read_only_fields = ['from_user', 'status', 'confirmed_by_from', 'confirmed_by_to', 'created_at']


# ─── Mutual Memories ─────────────────────────────────────────────────────────

class EventPhotoSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    image_url = serializers.SerializerMethodField()
    likes_count = serializers.SerializerMethodField()
    fire_likes_count = serializers.SerializerMethodField()
    i_liked = serializers.SerializerMethodField()
    i_fire_liked = serializers.SerializerMethodField()

    class Meta:
        model = EventPhoto
        fields = [
            'id', 'event', 'user', 'image', 'image_url', 'caption',
            'likes_count', 'fire_likes_count', 'i_liked', 'i_fire_liked', 'created_at'
        ]
        read_only_fields = ['user', 'created_at', 'likes_count', 'fire_likes_count', 'i_liked', 'i_fire_liked']

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image:
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None

    def get_likes_count(self, obj): return obj.likes.count()
    def get_fire_likes_count(self, obj): return obj.fire_likes.count()

    def get_i_liked(self, obj):
        request = self.context.get('request')
        return request and request.user.is_authenticated and obj.likes.filter(pk=request.user.pk).exists()

    def get_i_fire_liked(self, obj):
        request = self.context.get('request')
        return request and request.user.is_authenticated and obj.fire_likes.filter(pk=request.user.pk).exists()


# ─── Post-Event Survey ───────────────────────────────────────────────────────

class ClubAccessTokenSerializer(serializers.ModelSerializer):
    qr_url = serializers.ReadOnlyField()
    club_name = serializers.CharField(source='club.name', read_only=True)

    class Meta:
        model = ClubAccessToken
        fields = ['id', 'club', 'club_name', 'user', 'token', 'usage_count', 'qr_url', 'active', 'created_at']
        read_only_fields = ['token', 'usage_count', 'created_at']

class EventRatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventRating
        fields = ['id', 'user', 'event', 'rating', 'created_at']
        read_only_fields = ['user', 'created_at']
