"""
Club feed views — ClubPost CRUD only.
The /clubs/{id}/posts/ and /clubs/{id}/club_events/ actions are defined
directly on ClubViewSet in views.py to avoid DRF router name conflicts.
"""
from django.db import models as dj_models
from rest_framework import viewsets, permissions, serializers
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from events.models import Club, ClubPost, ClubWallPost


# ── Serializer ────────────────────────────────────────────────────────────────

class ClubPostSerializer(serializers.ModelSerializer):
    author_name       = serializers.SerializerMethodField()
    author_avatar     = serializers.SerializerMethodField()
    like_count        = serializers.SerializerMethodField()
    user_liked        = serializers.SerializerMethodField()
    image_url         = serializers.SerializerMethodField()
    post_type_display = serializers.CharField(source='get_post_type_display', read_only=True)

    class Meta:
        model  = ClubPost
        fields = [
            'id', 'club', 'author_name', 'author_avatar', 'post_type',
            'post_type_display', 'title', 'content', 'image', 'image_url',
            'is_pinned', 'like_count', 'user_liked', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'author_name', 'author_avatar', 'like_count', 'user_liked',
            'image_url', 'created_at', 'updated_at',
        ]

    def get_author_name(self, obj):
        return obj.author.get_full_name() or obj.author.username

    def get_author_avatar(self, obj):
        profile = getattr(obj.author, 'profile', None)
        if profile and getattr(profile, 'avatar', None):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(profile.avatar.url)
        return None

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_user_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(pk=request.user.pk).exists()
        return False

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
        return None


# ── ViewSet ───────────────────────────────────────────────────────────────────

class ClubPostViewSet(viewsets.ModelViewSet):
    """
    ClubPost CRUD — registered at /api/club-posts/
      POST   /club-posts/              → create (admin of the club only)
      GET    /club-posts/{id}/         → retrieve (member or admin)
      DELETE /club-posts/{id}/         → delete (admin only)
      POST   /club-posts/{id}/like/    → toggle like
      PATCH  /club-posts/{id}/pin/     → toggle pin (admin)
    """
    serializer_class = ClubPostSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_queryset(self):
        user = self.request.user
        return ClubPost.objects.filter(
            dj_models.Q(club__admins=user) |
            dj_models.Q(club__memberships__user=user, club__memberships__status='approved')
        ).distinct()

    def perform_create(self, serializer):
        club_id = self.request.data.get('club')
        try:
            club = Club.objects.get(pk=club_id)
        except Club.DoesNotExist:
            raise serializers.ValidationError({'club': 'Club no encontrado.'})
        if not club.admins.filter(pk=self.request.user.pk).exists() and not self.request.user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Solo los admins pueden publicar en el club.')
        serializer.save(author=self.request.user)

    def destroy(self, request, *args, **kwargs):
        post = self.get_object()
        if not post.club.admins.filter(pk=request.user.pk).exists() and not request.user.is_staff:
            return Response({'detail': 'Sin permisos para eliminar este post.'}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='like', url_name='like')
    def like(self, request, pk=None):
        post = self.get_object()
        if post.likes.filter(pk=request.user.pk).exists():
            post.likes.remove(request.user)
            liked = False
        else:
            post.likes.add(request.user)
            liked = True
        return Response({'liked': liked, 'like_count': post.likes.count()})

    @action(detail=True, methods=['patch'], url_path='pin', url_name='pin')
    def pin(self, request, pk=None):
        post = self.get_object()
        if not post.club.admins.filter(pk=request.user.pk).exists() and not request.user.is_staff:
            return Response({'detail': 'Sin permisos de administrador.'}, status=403)
        post.is_pinned = not post.is_pinned
        post.save()
        return Response({'is_pinned': post.is_pinned})

# ── Community Wall ────────────────────────────────────────────────────────────

class ClubWallPostSerializer(serializers.ModelSerializer):
    author_id     = serializers.IntegerField(source='author.id', read_only=True)
    author_name   = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()
    like_count    = serializers.SerializerMethodField()
    user_liked    = serializers.SerializerMethodField()
    reply_to_id   = serializers.PrimaryKeyRelatedField(
        source='reply_to', queryset=ClubWallPost.objects.all(),
        required=False, allow_null=True
    )
    reply_preview = serializers.SerializerMethodField()
    image_url     = serializers.SerializerMethodField()

    class Meta:
        model  = ClubWallPost
        fields = [
            'id', 'club', 'author_id', 'author_name', 'author_avatar',
            'content', 'image_url', 'reply_to_id', 'reply_preview',
            'like_count', 'user_liked', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'author_id', 'author_name', 'author_avatar',
            'like_count', 'user_liked', 'reply_preview', 'image_url',
            'created_at', 'updated_at',
        ]

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
        return None

    def get_author_name(self, obj):
        return obj.author.get_full_name() or obj.author.username

    def get_author_avatar(self, obj):
        profile = getattr(obj.author, 'profile', None)
        if profile and getattr(profile, 'avatar', None):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(profile.avatar.url)
        return None

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_user_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(pk=request.user.pk).exists()
        return False

    def get_reply_preview(self, obj):
        if not obj.reply_to:
            return None
        parent = obj.reply_to
        return {
            'id': parent.id,
            'author_name': parent.author.get_full_name() or parent.author.username,
            'content': parent.content[:80] + ('…' if len(parent.content) > 80 else ''),
        }


class ClubWallPostViewSet(viewsets.ModelViewSet):
    """
    Community Wall Posts — /api/club-wall-posts/
      POST   /club-wall-posts/           → create (any approved member)
      DELETE /club-wall-posts/{id}/      → delete (author or club admin)
      POST   /club-wall-posts/{id}/like/ → toggle like
    """
    serializer_class = ClubWallPostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return ClubWallPost.objects.filter(
            dj_models.Q(club__admins=user) |
            dj_models.Q(club__memberships__user=user, club__memberships__status='approved')
        ).select_related('author', 'reply_to', 'reply_to__author').distinct()

    def perform_create(self, serializer):
        club_id = self.request.data.get('club')
        try:
            club = Club.objects.get(pk=club_id)
        except Club.DoesNotExist:
            raise serializers.ValidationError({'club': 'Club no encontrado.'})

        is_admin = club.admins.filter(pk=self.request.user.pk).exists()
        is_member = club.memberships.filter(user=self.request.user, status='approved').exists()

        if not (is_admin or is_member) and not self.request.user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Solo los miembros pueden publicar en la comunidad.')

        serializer.save(author=self.request.user)

    def destroy(self, request, *args, **kwargs):
        post = self.get_object()
        is_author = (post.author == request.user)
        is_admin = post.club.admins.filter(pk=request.user.pk).exists()
        if not (is_author or is_admin) and not request.user.is_staff:
            return Response({'detail': 'Sin permisos para eliminar este post.'}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='like', url_name='like')
    def like(self, request, pk=None):
        post = self.get_object()
        if post.likes.filter(pk=request.user.pk).exists():
            post.likes.remove(request.user)
            liked = False
        else:
            post.likes.add(request.user)
            liked = True
        return Response({'liked': liked, 'like_count': post.likes.count()})

