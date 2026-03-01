import os, django, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from django.core.serializers import deserialize
from django.db import transaction

# Definir el orden correcto de dependencias (Padres -> Hijos)
MODEL_ORDER = [
    'users.user',
    'users.verificationcode',
    'users.emaillog',
    'events.club',
    'events.clubmembership',
    'events.clubsubscription',
    'events.clubaccesstoken',
    'events.clubinvitation',
    'events.event',
    'events.registration',
    'events.eventphoto',
    'events.eventrating',
    'events.accessrequest',
    'notifications.notification',
]

def load_data_in_order(json_file_path):
    with open(json_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print(f"Total objects in dump: {len(data)}")
    
    saved_count = 0
    failed_count = 0
    
    # Pre-agrupar datos por modelo para la carga
    data_by_model = {model: [] for model in MODEL_ORDER}
    other_data = []
    
    for d in data:
        m = d.get('model')
        if m in MODEL_ORDER:
            data_by_model[m].append(d)
        else:
            other_data.append(d)
            
    # Función para cargar un subset en transacción atómica global por si acaso
    def save_chunk(chunk):
        nonlocal saved_count, failed_count
        if not chunk: return
        
        objs = list(deserialize('json', json.dumps(chunk), ignorenonexistent=True))
        for obj in objs:
            try:
                with transaction.atomic():
                    obj.save()
                saved_count += 1
            except Exception as e:
                failed_count += 1
                print(f"Failed to save {obj.object._meta.db_table} (pk={obj.object.pk}): {e}")

    for model_name in MODEL_ORDER:
        print(f"Loading {model_name}... ({len(data_by_model[model_name])} objects)")
        save_chunk(data_by_model[model_name])
        
    if other_data:
        print(f"Loading remaining unclassified models... ({len(other_data)} objects)")
        save_chunk(other_data)
        
    print(f"Finished! Successfully saved: {saved_count}, Failed: {failed_count}")

if __name__ == '__main__':
    load_data_in_order(r'C:\Users\Rafa\Desktop\MUTUALS\neon_data_prepared.json')
