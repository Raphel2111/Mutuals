from rest_framework import serializers
from django.contrib.contenttypes.models import ContentType
from .models import Notification, Report


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'body', 'type', 'is_read', 'data_json', 'created_at']
        read_only_fields = ['id', 'title', 'body', 'type', 'data_json', 'created_at']


class ReportSerializer(serializers.ModelSerializer):
    """
    Accepts: model_name (str), object_id (int), reason, description
    Resolves ContentType automatically from model_name.
    """
    model_name  = serializers.CharField(write_only=True)

    class Meta:
        model  = Report
        fields = ['id', 'model_name', 'object_id', 'reason', 'description', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']

    def validate(self, attrs):
        model_name = attrs.pop('model_name', '').lower()
        # Map allowed model names to ContentType
        ALLOWED = {
            'user': 'users.user',
            'eventphoto': 'events.eventphoto',
            'club': 'events.club',
            'event': 'events.event',
        }
        app_model = ALLOWED.get(model_name)
        if not app_model:
            raise serializers.ValidationError({'model_name': f'Modelo no soportado: {model_name}'})

        app, model = app_model.split('.')
        try:
            ct = ContentType.objects.get(app_label=app, model=model)
        except ContentType.DoesNotExist:
            raise serializers.ValidationError({'model_name': 'Modelo no encontrado.'})

        attrs['content_type'] = ct
        return attrs

    def create(self, validated_data):
        reporter = self.context['request'].user
        try:
            report, created = Report.objects.get_or_create(
                reporter=reporter,
                content_type=validated_data['content_type'],
                object_id=validated_data['object_id'],
                reason=validated_data['reason'],
                defaults={'description': validated_data.get('description', '')}
            )
            if not created:
                raise serializers.ValidationError('Ya has reportado este contenido por el mismo motivo.')
            return report
        except Exception as e:
            if 'unique_together' in str(e).lower() or 'Ya has reportado' in str(e):
                raise serializers.ValidationError('Ya has reportado este contenido por el mismo motivo.')
            raise
