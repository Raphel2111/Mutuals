import os
import django
import sys
import csv
import uuid

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from users.models import User
from events.models import Event, Registration

def restore_registrations():
    csv_path = 'Cena FM_asistentes (2).csv'
    print(f"🚀 INICIANDO RESTAURACIÓN DE REGISTROS desde {csv_path} 🚀")

    # 1. Buscar Evento 'Cena FM'
    event = Event.objects.filter(name__icontains="Cena FM").first()
    if not event:
        print("❌ CRÍTICO: No se encontró el evento 'Cena FM'.")
        return
    print(f"✅ Evento encontrado: {event.name} (ID: {event.id})")

    if not os.path.exists(csv_path):
        print(f"❌ El archivo {csv_path} no está en el directorio raiz.")
        # Try finding it in backend/ or root
        if os.path.exists(os.path.join('backend', csv_path)):
            csv_path = os.path.join('backend', csv_path)
            print(f"✅ Encontrado en {csv_path}")
        else:
             print("❌ No se encuentra el archivo CSV. Asegúrate de que está subido.")
             return

    success_count = 0
    error_count = 0

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter=';')
        
        for row in reader:
            try:
                username = row.get('Usuario (App)', '').strip()
                email = row.get('Email', '').strip()
                entry_code_str = row.get('Código Entrada', '').strip()
                rol = row.get('Rol', 'Fallero').strip()
                nombre = row.get('Nombre', '').strip()
                apellido = row.get('Apellido', '').strip()
                alias = row.get('Alias', '').strip()
                
                if not username or not entry_code_str:
                    print(f"⚠️ Fila inválida (falta username o código): {row}")
                    continue

                # Buscar Usuario
                user = User.objects.filter(username__iexact=username).first()
                if not user and email:
                    user = User.objects.filter(email__iexact=email).first()
                
                if not user:
                    print(f"❌ Usuario no encontrado: {username} ({email}) - Saltando...")
                    error_count += 1
                    continue

                # Determinar Tipo
                attendee_type = 'member'
                if 'Invitado' in rol:
                    attendee_type = 'guest'
                elif 'Niño' in rol:
                    attendee_type = 'child'

                # Validar UUID
                try:
                    entry_code = uuid.UUID(entry_code_str)
                except ValueError:
                    print(f"❌ UUID inválido para {username}: {entry_code_str}")
                    error_count += 1
                    continue

                # Crear/Actualizar Registro
                # Usamos update_or_create para ser idempotentes (evitar duplicados si se corre 2 veces)
                # Buscamos por entry_code para asegurar que restauramos ESE QR específico
                reg, created = Registration.objects.update_or_create(
                    entry_code=entry_code,
                    defaults={
                        'user': user,
                        'event': event,
                        'status': 'confirmed',
                        'attendee_first_name': nombre,
                        'attendee_last_name': apellido,
                        'attendee_type': attendee_type,
                        'alias': alias,
                        'used': row.get('Entrada Usada', 'NO').upper() == 'SÍ'
                    }
                )

                if created:
                    print(f"✅ [NUEVO] Restaurado QR para {username} ({attendee_type}) - {entry_code_str[-6:]}...")
                else:
                    print(f"🔄 [ACTUALIZADO] QR para {username} ({attendee_type}) - {entry_code_str[-6:]}...")
                
                success_count += 1

            except Exception as e:
                print(f"❌ Error procesando fila {row}: {e}")
                error_count += 1

    print("\n------------------------------------------------")
    print(f"🏁 FINALIZADO: {success_count} registros restaurados, {error_count} errores.")
    print("------------------------------------------------")

if __name__ == "__main__":
    restore_registrations()
