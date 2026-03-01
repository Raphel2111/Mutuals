from rest_framework import permissions


class IsEventAdminOrReadOnly(permissions.BasePermission):
    """Allow only event admins or staff to edit/delete; read-only for others.

    Assumes the view has `.get_object()` that returns an Event for object-level checks,
    or that the object has an `event` attribute (like Registration).
    """

    def has_permission(self, request, view):
        # Allow unauthenticated read-only access; require auth for modifications
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        # Safe methods allowed for any authenticated user
        if request.method in permissions.SAFE_METHODS:
            return True

        # Determine event instance
        event = None
        if hasattr(obj, 'admins'):
            # obj is Event
            event = obj
        elif hasattr(obj, 'event'):
            # obj is Registration - users can delete their own registrations
            try:
                if hasattr(obj, 'user') and obj.user and obj.user == request.user:
                    return True
            except Exception:
                pass
            event = obj.event

        if not event:
            return False

        # Staff users can do anything
        if request.user.is_staff:
            return True

        # Check if user is in event.admins
        try:
            if event.admins.filter(pk=request.user.pk).exists():
                return True
        except Exception:
            pass
            
        # Check if user is in club admins (if event belongs to club)
        try:
            if event.club:
                if event.club.admins.filter(pk=request.user.pk).exists():
                    return True
        except Exception:
            pass
            
        return False


class IsClubOrEventAdmin(permissions.BasePermission):
    """Allow modifications only to club admins or event admins or staff.

    - If `obj` is a Club, check `obj.admins`.
    - If `obj` has an `event` attribute (Registration), check `event.admins` or `event.club.admins`.
    """

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        user = request.user
        if user.is_staff:
            return True

        # If obj is a Club
        if hasattr(obj, 'admins') and not hasattr(obj, 'event'):
            # Basic heuristic for Club object vs Event
            return obj.admins.filter(pk=user.pk).exists()

        # If obj is an Event or has an event attribute
        event = None
        if hasattr(obj, 'admins'):
            event = obj
        elif hasattr(obj, 'event'):
            event = obj.event

        if event:
            if event.admins.filter(pk=user.pk).exists():
                return True
            if event.club and event.club.admins.filter(pk=user.pk).exists():
                return True

        return False


class IsClubAdminOrEventAdmin(permissions.BasePermission):
    """Allow modifications when the user is club admin, event admin, or staff."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        if user.is_staff:
            return True

        # Club object
        if hasattr(obj, 'admins') and not hasattr(obj, 'event'):
            return obj.admins.filter(pk=user.pk).exists()

        # Event object or object with event attribute
        event = None
        if hasattr(obj, 'admins'):
            event = obj
        elif hasattr(obj, 'event'):
            event = obj.event

        if event is not None:
            # event admins or club admins
            if event.admins.filter(pk=user.pk).exists():
                return True
            if event.club:
                if event.club.admins.filter(pk=user.pk).exists():
                    return True
        return False
