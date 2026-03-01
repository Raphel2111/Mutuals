"""
Populate InterestTag table with preset tags for the Radar discovery feature.
Run: python manage.py shell < scripts/populate_interest_tags.py
"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'evento_app.settings')

# Add parent dir so imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from users.models import InterestTag

TAGS = [
    # Arte
    ('✏️ Dibujo', 'Arte'),
    ('🎨 Arte y cultura', 'Arte'),
    ('📷 Fotografía', 'Arte'),
    ('💃 Baile', 'Arte'),
    ('🎭 Teatro', 'Arte'),

    # Entretenimiento
    ('🎬 Cine y Series', 'Entretenimiento'),
    ('🎌 Anime y manga', 'Entretenimiento'),
    ('🏰 Disney', 'Entretenimiento'),
    ('👻 Terror', 'Entretenimiento'),
    ('🎵 Música', 'Entretenimiento'),
    ('📺 K-Drama', 'Entretenimiento'),

    # Gaming
    ('🎮 Videojuegos', 'Gaming'),
    ('🃏 TCG y Cartas', 'Gaming'),
    ('🎲 Juegos de mesa', 'Gaming'),
    ('♟️ Ajedrez', 'Gaming'),

    # Cultura
    ('📚 Libros', 'Cultura'),
    ('⚡ Harry Potter', 'Cultura'),
    ('🏛️ Mitología', 'Cultura'),
    ('🌍 Historia', 'Cultura'),

    # Lifestyle
    ('🧸 Cozy', 'Lifestyle'),
    ('✈️ Viajes', 'Lifestyle'),
    ('🍳 Cocina', 'Lifestyle'),
    ('🧘 Bienestar', 'Lifestyle'),
    ('🌱 Naturaleza', 'Lifestyle'),
    ('🐾 Mascotas', 'Lifestyle'),
    ('☕ Café', 'Lifestyle'),

    # Deportes
    ('⚽ Deportes', 'Deportes'),
    ('🏋️ Fitness', 'Deportes'),
    ('🏄 Surf', 'Deportes'),

    # Tech
    ('💻 Tecnología', 'Tech'),
    ('🤖 IA', 'Tech'),
    ('🚀 Startups', 'Tech'),

    # Social
    ('🎉 Fiestas', 'Social'),
    ('🍷 Vino y Gastronomía', 'Social'),
    ('🌈 LGBTQ+', 'Social'),
    ('🤝 Networking', 'Social'),
]

created = 0
for name, category in TAGS:
    obj, was_created = InterestTag.objects.get_or_create(
        name=name,
        defaults={'category': category}
    )
    if was_created:
        created += 1
        print(f'  ✅ {name} ({category})')
    else:
        # Update category if it changed
        if obj.category != category:
            obj.category = category
            obj.save(update_fields=['category'])
        print(f'  ⏭️  {name} (already exists)')

print(f'\nDone! {created} new tags created, {len(TAGS) - created} already existed.')
