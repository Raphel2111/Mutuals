import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from events.models import Event
from django.utils import timezone
from datetime import timedelta

def create_demo_events():
    categories = ['Festival', 'Concert', 'Tech Meetup']
    print("Deleting old events...")
    Event.objects.all().delete()
    
    print("Creating 3 demo events...")
    for i, cat in enumerate(categories):
        Event.objects.create(
            name=f"Demo: {cat} {timezone.now().year}",
            description=f"Welcome to the ultimate {cat} experience!",
            date=timezone.now() + timedelta(days=5+i),
            location="MUTUALS Central Hub, Madrid",
            capacity=100 + (i*50),
            price=15.00 + (i*10)
        )
    print(f"Success! {Event.objects.count()} events are now in the DB.")

if __name__ == '__main__':
    create_demo_events()
