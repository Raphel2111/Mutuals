from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Notification, Report
from .serializers import NotificationSerializer, ReportSerializer


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET  /api/notifications/             → list (unread first)
    GET  /api/notifications/unread_count/→ {count: N}
    POST /api/notifications/mark_read/  → mark all as read
    POST /api/notifications/{id}/read/  → mark one as read
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'], url_path='unread_count')
    def unread_count(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({'count': count})

    @action(detail=False, methods=['post'], url_path='mark_read')
    def mark_read(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'detail': 'Todas las notificaciones marcadas como leídas.'})

    @action(detail=True, methods=['post'], url_path='read')
    def read_one(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save(update_fields=['is_read'])
        return Response({'detail': 'Notificación leída.'})


# ─── Report ViewSet ───────────────────────────────────────────────────────────

class ReportViewSet(viewsets.ModelViewSet):
    """
    POST /api/reports/                     → submit a report (any authenticated user)
    GET  /api/reports/                     → list pending reports (staff only)
    GET  /api/reports/pending_count/       → {count: N} (staff only)
    POST /api/reports/{id}/resolve/        → mark reviewed/actioned (staff only)
    """
    serializer_class   = ReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            status_filter = self.request.query_params.get('status', 'pending')
            return Report.objects.filter(status=status_filter).select_related(
                'reporter', 'content_type', 'reviewed_by'
            )
        # Regular users can only see their own reports
        return Report.objects.filter(reporter=self.request.user)

    def perform_create(self, serializer):
        serializer.save(reporter=self.request.user)

    @action(detail=False, methods=['get'], url_path='pending_count',
            permission_classes=[permissions.IsAdminUser])
    def pending_count(self, request):
        count = Report.objects.filter(status='pending').count()
        return Response({'count': count})

    @action(detail=True, methods=['post'], url_path='resolve',
            permission_classes=[permissions.IsAdminUser])
    def resolve(self, request, pk=None):
        from django.utils import timezone
        report = self.get_object()
        new_status = request.data.get('status', 'reviewed')
        if new_status not in ('reviewed', 'actioned'):
            return Response({'detail': 'Status debe ser "reviewed" o "actioned".'}, status=400)
        report.status      = new_status
        report.reviewed_at = timezone.now()
        report.reviewed_by = request.user
        report.save(update_fields=['status', 'reviewed_at', 'reviewed_by'])
        return Response({'detail': f'Reporte marcado como {new_status}.', 'status': new_status})
