import os
import django
import sys

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from users.models import User
from events.models import DistributionGroup
from events.serializers import DistributionGroupSerializer
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

def diagnose_crash():
    print("🚑 DIAGNOSTICO POST-CRASH 🚑")
    
    # 1. Estado de la Base de Datos
    group = DistributionGroup.objects.filter(name="Fallas 2026").first()
    if not group:
        print("❌ CRÍTICO: El grupo 'Fallas 2026' NO EXISTE en la BD. (Pérdida de datos total)")
        return

    print(f"✅ Grupo encontrado: {group.name} (ID: {group.id})")
    print(f"   Miembros en BD: {group.members.count()}")
    print(f"   Admins en BD: {group.admins.count()}")
    print(f"   Tiene Logo: {'SÍ' if group.logo else 'NO'}")
    if group.logo:
        print(f"   Ruta Logo: {group.logo.name}")

    if group.members.count() == 0:
        print("⚠️ ALERTA: El grupo existe pero tiene 0 miembros. Posible reinicio de BD o pérdida de relaciones.")
    
    # 2. Prueba de Serialización (¿Rompe la imagen?)
    print("\n🧪 Probando Serializador...")
    try:
        factory = APIRequestFactory()
        request = factory.get('/')
        context = {'request': request}
        
        serializer = DistributionGroupSerializer(instance=group, context=context)
        data = serializer.data
        
        print("✅ Serialización EXITOSA.")
        print(f"   Datos de salida - member_count: {data.get('member_count')}")
        print(f"   Datos de salida - logo_url: {data.get('logo_url')}")
    except Exception as e:
        print(f"❌ ERROR CRÍTICO EN SERIALIZADOR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    diagnose_crash()
