import os, django, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')
django.setup()

from django.core.serializers import deserialize
from django.db import transaction

with open('C:/Users/Rafa/Desktop/MUTUALS/neon_data_prepared.json', 'r', encoding='utf-8') as f:
    data = f.read()

print('Deserializing data...')
objects = list(deserialize('json', data))
print(f'Total objects to save: {len(objects)}')

for i, obj in enumerate(objects):
    try:
        model_name = obj.object.__class__.__name__
        # print(f'[{i}] Saving {model_name} (pk={obj.object.pk})...')
        with transaction.atomic():
            obj.save()
    except Exception as e:
        print(f'Failed to save {model_name} (pk={obj.object.pk}): {e}')

print('Done.')
