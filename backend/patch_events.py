import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from events.models import Event, Club

# Crear o recuperar un club principal
c, created = Club.objects.get_or_create(name='Fallas 2026', defaults={'slug': 'fallas-2026', 'is_private': False, 'description': 'Eventos importados'})

updated = Event.objects.filter(club__isnull=True).update(club=c, is_public=True)
print(f'Actualizados {updated} eventos huecos con club Fallas 2026 y is_public=True')

events = Event.objects.all()
print("All Events in Supabase:")
for e in events:
    print(f"ID={e.id} Name={e.name} Public={e.is_public} Club={e.club.name if e.club else 'None'}")
