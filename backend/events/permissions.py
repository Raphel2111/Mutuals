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
            
        # Check if user is in group admins/creators (if event belongs to group)
        try:
            if event.group:
                if event.group.admins.filter(pk=request.user.pk).exists():
                    return True
                if event.group.creators.filter(pk=request.user.pk).exists():
                    return True
        except Exception:
            pass
            
        return False


class IsGroupOrEventAdmin(permissions.BasePermission):
    """Allow modifications only to group admins or event admins or staff.

    - If `obj` is a DistributionGroup, check `obj.admins`.
    - If `obj` has an `event` attribute (Registration), check `event.admins`.
    - For list/create, allow authenticated users to create but creator will be made admin.
    """

    def has_permission(self, request, view):
        # Allow unauthenticated read-only access; require auth for create/update/delete
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        # Safe methods allowed
        if request.method in permissions.SAFE_METHODS:
            return True

        user = request.user
        if user.is_staff:
            return True

        # If obj is a DistributionGroup
        if hasattr(obj, 'admins') and hasattr(obj, 'members'):
            return obj.admins.filter(pk=user.pk).exists()

        # If obj has event attribute -> check event admins
        if hasattr(obj, 'event') and obj.event is not None:
            return obj.event.admins.filter(pk=user.pk).exists()

        return False


class IsGroupAdminOrCreatorOrEventAdmin(permissions.BasePermission):
    """Allow modifications when the user is group admin, group creator, event admin, or staff."""

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

        # DistributionGroup object
        if hasattr(obj, 'admins') and hasattr(obj, 'members'):
            if obj.admins.filter(pk=user.pk).exists():
                return True
            if obj.creators.filter(pk=user.pk).exists():
                return True
            return False

        # Event object or object with event attribute
        event = None
        if hasattr(obj, 'admins'):
            event = obj
        elif hasattr(obj, 'event'):
            event = obj.event

        if event is not None:
            # event admins or group's creators/admins
            if event.admins.filter(pk=user.pk).exists():
                return True
            if event.group:
                if event.group.admins.filter(pk=user.pk).exists():
                    return True
                if event.group.creators.filter(pk=user.pk).exists():
                    return True
        return False
