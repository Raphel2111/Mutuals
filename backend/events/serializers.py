from rest_framework import serializers
from .models import Event, Registration, DistributionGroup, AccessRequest, GroupAccessRequest, Wallet, Transaction
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
    group = serializers.PrimaryKeyRelatedField(queryset=DistributionGroup.objects.all(), allow_null=True, required=False)
    group_name = serializers.CharField(source='group.name', read_only=True, allow_null=True)

    is_admin = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = ['id','name','description','date','location','capacity','max_qr_codes','admins','group','group_name','requires_approval','is_public','price','registration_deadline','is_admin']

    def get_is_admin(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        user = request.user
        return (
            user.is_staff or 
            user.role == 'admin' or
            obj.admins.filter(pk=user.pk).exists() or 
            (obj.group and (obj.group.admins.filter(pk=user.pk).exists() or obj.group.creators.filter(pk=user.pk).exists()))
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


from .models import DistributionGroup, Event


class DistributionGroupSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    default_logo_url = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()
    
    class Meta:
        model = DistributionGroup
        fields = ['id', 'name', 'description', 'logo', 'logo_url', 'default_logo_url', 'is_public', 'members', 'events', 'admins', 'creators', 'member_count', 'is_member']
    
    def get_logo_url(self, obj):
        if obj.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.logo.url)
            return obj.logo.url
        return self.get_default_logo_url(obj)

    def get_default_logo_url(self, obj):
        return f"https://ui-avatars.com/api/?name={obj.name}&background=3b82f6&color=fff&size=256"
    
    def get_member_count(self, obj):
        return getattr(obj, 'annotated_member_count', obj.members.count())
    
    def get_is_member(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.members.filter(id=request.user.id).exists()
        return False
    
    def to_representation(self, instance):
        # For GET: return lists of IDs
        ret = super().to_representation(instance)
        ret['members'] = list(instance.members.values_list('id', flat=True))
        ret['admins'] = list(instance.admins.values_list('id', flat=True))
        ret['creators'] = list(instance.creators.values_list('id', flat=True))
        ret['events'] = list(instance.events.values_list('id', flat=True))
        return ret

    def create(self, validated_data):
        members_in = validated_data.pop('members', [])
        admins_in = validated_data.pop('admins', [])
        creators_in = validated_data.pop('creators', [])
        events_in = validated_data.pop('events', [])

        group = DistributionGroup.objects.create(
            name=validated_data.get('name', ''),
            description=validated_data.get('description', ''),
            logo=validated_data.get('logo'),
            is_public=validated_data.get('is_public', False)
        )

        # Members/admins/creators: accept list of user IDs
        if members_in:
            group.members.set(members_in)
        if admins_in:
            group.admins.set(admins_in)
        if creators_in:
            group.creators.set(creators_in)

        # Events: accept list of event IDs
        if events_in:
            group.events.set(events_in)

        return group

    def update(self, instance, validated_data):
        members_in = validated_data.pop('members', None)
        admins_in = validated_data.pop('admins', None)
        creators_in = validated_data.pop('creators', None)
        events_in = validated_data.pop('events', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if members_in is not None:
            instance.members.set(members_in)
        if admins_in is not None:
            instance.admins.set(admins_in)
        if creators_in is not None:
            instance.creators.set(creators_in)
        if events_in is not None:
            instance.events.set(events_in)

        return instance


from .models import GroupAccessToken

class GroupAccessTokenSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    group = serializers.PrimaryKeyRelatedField(queryset=DistributionGroup.objects.all())
    qr_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = GroupAccessToken
        fields = ['id','group','user','token','qr_code','qr_url','active','created_at','usage_count']
        read_only_fields = ['token','qr_code','qr_url','created_at','usage_count']

    def get_qr_url(self, obj):
        request = self.context.get('request')
        if obj.qr_code and hasattr(obj.qr_code, 'url'):
            return request.build_absolute_uri(obj.qr_code.url) if request else obj.qr_code.url
        return None

    def create(self, validated_data):
        token = GroupAccessToken.objects.create(**validated_data)
        return token


class AccessRequestSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    event_id = serializers.IntegerField(source='event.id', read_only=True)
    event_name = serializers.CharField(source='event.name', read_only=True)
    reviewed_by = UserSerializer(read_only=True)
    
    class Meta:
        model = AccessRequest
        fields = ['id', 'user', 'event_id', 'event_name', 'status', 'message', 'requested_at', 'reviewed_at', 'reviewed_by', 'admin_notes']
        read_only_fields = ['status', 'requested_at', 'reviewed_at', 'reviewed_by', 'admin_notes']


class GroupAccessRequestSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    group_id = serializers.IntegerField(source='group.id', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    reviewed_by = UserSerializer(read_only=True)
    
    class Meta:
        from .models import GroupAccessRequest
        model = GroupAccessRequest
        fields = ['id', 'user', 'group_id', 'group_name', 'status', 'message', 'requested_at', 'reviewed_at', 'reviewed_by', 'admin_notes']
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


