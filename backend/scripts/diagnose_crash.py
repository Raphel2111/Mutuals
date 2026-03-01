import os
import django
import sys

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from users.models import User
from events.models import Club, ClubMembership
from events.serializers import ClubSerializer
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

def diagnose_crash():
    print("🚑 DIAGNOSTICO POST-CRASH 🚑")
    
    # 1. Estado de la Base de Datos
    club = Club.objects.filter(name="Fallas 2026").first()
    if not club:
        print("❌ CRÍTICO: El club 'Fallas 2026' NO EXISTE en la BD. (Pérdida de datos total)")
        return

    print(f"✅ Club encontrado: {club.name} (ID: {club.id})")
    print(f"   Miembros aprobados: {club.memberships.filter(status='approved').count()}")
    print(f"   Admins en BD: {club.admins.count()}")
    print(f"   Tiene Imagen: {'SÍ' if club.image else 'NO'}")
    if club.image:
        print(f"   Ruta Imagen: {club.image.name}")

    if club.memberships.count() == 0:
        print("⚠️ ALERTA: El club existe pero tiene 0 miembros. Posible reinicio de BD o pérdida de relaciones.")
    
    # 2. Prueba de Serialización
    print("\n🧪 Probando Serializador...")
    try:
        factory = APIRequestFactory()
        request = factory.get('/')
        # Attach a dummy user or the admin user to the request
        request.user = User.objects.filter(username__iexact='Admin').first() or User.objects.filter(is_superuser=True).first()
        context = {'request': request}
        
        serializer = ClubSerializer(instance=club, context=context)
        data = serializer.data
        
        print("✅ Serialización EXITOSA.")
        print(f"   Datos de salida - members_count: {data.get('members_count')}")
        print(f"   Datos de salida - image_url: {data.get('image_url')}")
    except Exception as e:
        print(f"❌ ERROR CRÍTICO EN SERIALIZADOR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    diagnose_crash()
