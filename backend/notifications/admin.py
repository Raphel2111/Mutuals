from django.contrib import admin
from django.utils import timezone
from .models import Notification, Report


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display  = ['user', 'type', 'title', 'is_read', 'created_at']
    list_filter   = ['type', 'is_read']
    search_fields = ['user__username', 'title']
    readonly_fields = ['created_at']


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display  = ['reporter', 'reason', 'content_type', 'object_id', 'status', 'created_at']
    list_filter   = ['reason', 'status', 'content_type']
    search_fields = ['reporter__username', 'description']
    readonly_fields = ['reporter', 'content_type', 'object_id', 'reason', 'description', 'created_at']
    actions = ['mark_reviewed', 'mark_actioned']

    @admin.action(description='✅ Marcar como Revisado (sin acción)')
    def mark_reviewed(self, request, queryset):
        queryset.update(status='reviewed', reviewed_at=timezone.now(), reviewed_by=request.user)
        self.message_user(request, f'{queryset.count()} reporte(s) marcados como revisados.')

    @admin.action(description='⚠️ Marcar como Accion Tomada')
    def mark_actioned(self, request, queryset):
        queryset.update(status='actioned', reviewed_at=timezone.now(), reviewed_by=request.user)
        self.message_user(request, f'{queryset.count()} reporte(s) marcados con acción tomada.')
