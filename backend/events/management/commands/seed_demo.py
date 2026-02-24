"""
Management command: seed_demo
Populates the database with realistic demo data so organizers and devs
can see how MUTUALS looks with real content.

Usage:
    python manage.py seed_demo
    python manage.py seed_demo --clear   # wipe non-superuser data first
"""

import random
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.utils.text import slugify

User = get_user_model()

INTERESTS = [
    'Música electrónica', 'Jazz & Blues', 'Indie Rock', 'Hip-Hop',
    'Fotografía', 'Arte contemporáneo', 'Diseño UX', 'Programación',
    'Networking tech', 'Gastronomía', 'Coctelería craft', 'Vino natural',
    'Running', 'Yoga', 'Surf', 'Cinema independiente',
    'Podcasting', 'Escritura creativa', 'Stand-up comedy', 'Teatro',
]

USERS = [
    {'first_name': 'Alex',     'last_name': 'Martínez',  'username': 'alexma',    'email': 'alex@demo.com'},
    {'first_name': 'Sofía',    'last_name': 'González',  'username': 'sofiag',    'email': 'sofia@demo.com'},
    {'first_name': 'Carlos',   'last_name': 'Llop',      'username': 'carlosll',  'email': 'carlos@demo.com'},
    {'first_name': 'Laia',     'last_name': 'Puig',      'username': 'laiap',     'email': 'laia@demo.com'},
    {'first_name': 'Marc',     'last_name': 'Ferrer',    'username': 'marcf',     'email': 'marc@demo.com'},
    {'first_name': 'Elena',    'last_name': 'Roca',      'username': 'elenar',    'email': 'elena@demo.com'},
    {'first_name': 'David',    'last_name': 'Serra',     'username': 'davids',    'email': 'david@demo.com'},
    {'first_name': 'Julia',    'last_name': 'Costa',     'username': 'juliac',    'email': 'julia@demo.com'},
    {'first_name': 'Pau',      'last_name': 'Vidal',     'username': 'pauv',      'email': 'pau@demo.com'},
    {'first_name': 'Claudia',  'last_name': 'Moya',      'username': 'claudiam',  'email': 'claudia@demo.com'},
    {'first_name': 'Iker',     'last_name': 'Ruiz',      'username': 'ikerr',     'email': 'iker@demo.com'},
    {'first_name': 'Marta',    'last_name': 'López',     'username': 'martal',    'email': 'marta@demo.com'},
]

CLUBS_DATA = [
    {
        'name': 'Tech Dinners BCN',
        'description': 'Cenas mensuales donde fundadores, devs y PMs debaten el futuro de la tecnología. Conversaciones profundas, sin PowerPoints.',
        'is_private': True,
        'monthly_price': 15.00,
        'benefits': 'Acceso a cenas exclusivas\nBadge FOUNDER para los primeros 20\nCalendario privado de eventos',
    },
    {
        'name': 'Jazz & Vinos Madrid',
        'description': 'Club de amantes del jazz en directo y el vino natural. Sesiones cada viernes en venues secretos de Madrid.',
        'is_private': False,
        'monthly_price': 0,
        'benefits': '',
    },
    {
        'name': 'Fotógrafos Urbanos',
        'description': 'Photowalks, critiques y exposiciones pop-up por la ciudad. Nivel de todos los bienvenidos, pasión obligatoria.',
        'is_private': False,
        'monthly_price': 0,
        'benefits': '',
    },
    {
        'name': 'VIP Gastronomy Circle',
        'description': 'Acceso a mesas en restaurantes Michelin, cenas con chefs y maridajes exclusivos. Lista de espera permanente.',
        'is_private': True,
        'monthly_price': 49.00,
        'benefits': 'Reservas prioritarias en restaurantes top\nBadge VIP\nInvitaciones a chef\'s table',
    },
]

EVENTS_DATA = [
    {
        'name': 'Radar Night — IA & Startups',
        'description': 'La noche definitiva para founders y early adopters de IA. Demos en vivo, networking y DJ set hasta las 2h.',
        'location': 'La Térmica, Barcelona',
        'days_offset': 7,
        'capacity': 200,
        'price': 25.00,
        'is_public': True,
    },
    {
        'name': 'Jazz Clandestino Vol. 5',
        'description': 'Cuarteto de jazz moderno en local secreto. Solo 60 plazas. La dirección se envía 2h antes.',
        'location': 'Secreto, Madrid',
        'days_offset': 14,
        'capacity': 60,
        'price': 0,
        'is_public': False,
    },
    {
        'name': 'Sunset Photowalk Barceloneta',
        'description': 'Paseo fotográfico al atardecer por la playa y el puerto olímpico. Lleva cualquier cámara.',
        'location': 'Barceloneta, Barcelona',
        'days_offset': 3,
        'capacity': 30,
        'price': 0,
        'is_public': True,
    },
    {
        'name': 'Cena Tech Founders — Febrero',
        'description': 'Cena íntima para fundadores de startups. Max 20 personas. Sin pitches, solo conversaciones reales.',
        'location': 'Parking Pizza, Barcelona',
        'days_offset': 21,
        'capacity': 20,
        'price': 45.00,
        'is_public': False,
    },
    {
        'name': 'Electronic Roots — Live Sets',
        'description': 'Tres DJs locales + un artista invitado internacional. Techno, ambient y experimentación sonora.',
        'location': 'Razzmatazz, Barcelona',
        'days_offset': 10,
        'capacity': 500,
        'price': 18.00,
        'is_public': True,
    },
    {
        'name': 'Stand-up & Gin Tonic',
        'description': 'Noche de comedia con 4 cómicos emergentes + barra libre de gin tonic. Aforo limitadísimo.',
        'location': 'El Beso, Valencia',
        'days_offset': 5,
        'capacity': 80,
        'price': 15.00,
        'is_public': True,
    },
]


class Command(BaseCommand):
    help = 'Populate the database with realistic demo data'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Clear existing non-superuser data before seeding')

    def handle(self, *args, **options):
        from events.models import Event, Club, ClubMembership, Registration
        from users.models import InterestTag
        try:
            from users.models import UserProfile
        except ImportError:
            UserProfile = None

        if options['clear']:
            self.stdout.write('🗑  Clearing existing demo data...')
            Event.objects.all().delete()
            Club.objects.all().delete()
            User.objects.filter(is_superuser=False).delete()
            self.stdout.write(self.style.WARNING('  → Cleared.'))

        # ── 1. Interest tags ────────────────────────────────────────────────
        self.stdout.write('\n📌 Creating interest tags...')
        tags = []
        try:
            from users.models import InterestTag as IT
            for name in INTERESTS:
                tag, _ = IT.objects.get_or_create(name=name)
                tags.append(tag)
            self.stdout.write(self.style.SUCCESS(f'  ✓ {len(tags)} tags'))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'  ⚠ Interest tags skipped: {e}'))

        # ── 2. Users ────────────────────────────────────────────────────────
        self.stdout.write('\n👤 Creating demo users...')
        users = []
        for u in USERS:
            user, created = User.objects.get_or_create(
                username=u['username'],
                defaults={
                    'first_name': u['first_name'],
                    'last_name':  u['last_name'],
                    'email':      u['email'],
                    'slug':       u['username'],
                }
            )
            if created:
                user.set_password('demo1234')
                user.save()
                # Assign random interests
                if tags:
                    user_tags = random.sample(tags, k=min(5, len(tags)))
                    try:
                        user.interest_tags.set(user_tags)
                    except Exception:
                        pass
            users.append(user)
        self.stdout.write(self.style.SUCCESS(f'  ✓ {len(users)} users (password: demo1234)'))

        # ── 3. Clubs ────────────────────────────────────────────────────────
        self.stdout.write('\n🎭 Creating clubs...')
        clubs = []
        organizer = users[0]  # Alex = organizer for all demo clubs
        for cd in CLUBS_DATA:
            slug = slugify(cd['name'])
            club, _ = Club.objects.get_or_create(
                name=cd['name'],
                defaults={
                    'slug':        slug,
                    'description': cd['description'],
                    'is_private':  cd['is_private'],
                    'monthly_price': cd['monthly_price'],
                    'membership_benefits': cd.get('benefits', ''),
                }
            )
            club.admins.add(organizer)
            # Add random members (approved)
            members = random.sample(users[1:], k=random.randint(3, 8))
            for member in members:
                ClubMembership.objects.get_or_create(
                    user=member, club=club,
                    defaults={
                        'status':    'approved',
                        'badge':     random.choice(['member', 'loyal', 'founder', 'vip']),
                        'joined_at': timezone.now() - timezone.timedelta(days=random.randint(5, 90)),
                    }
                )
            clubs.append(club)
        self.stdout.write(self.style.SUCCESS(f'  ✓ {len(clubs)} clubs with members'))

        # ── 4. Events ────────────────────────────────────────────────────────
        self.stdout.write('\n📅 Creating events...')
        events = []
        for i, ed in enumerate(EVENTS_DATA):
            event_date = timezone.now() + timezone.timedelta(days=ed['days_offset'])
            club = clubs[i % len(clubs)] if ed.get('assign_club', True) else None
            event, _ = Event.objects.get_or_create(
                name=ed['name'],
                defaults={
                    'description':         ed['description'],
                    'date':                event_date,
                    'location':            ed['location'],
                    'capacity':            ed['capacity'],
                    'price':               ed['price'],
                    'is_public':           ed['is_public'],
                    'platform_fee_percentage': 5.00,
                    'club':                club,
                }
            )
            event.admins.add(organizer)

            # Create 5-15 registrations per event
            attendees = random.sample(users, k=min(len(users), random.randint(5, 12)))
            for attendee in attendees:
                Registration.objects.get_or_create(
                    user=attendee, event=event,
                    defaults={'status': 'valid'}
                )
            events.append(event)
        self.stdout.write(self.style.SUCCESS(f'  ✓ {len(events)} events with attendees'))

        # ── 5. Summary ───────────────────────────────────────────────────────
        self.stdout.write('\n' + '─' * 50)
        self.stdout.write(self.style.SUCCESS('✅ Demo data seeded successfully!\n'))
        self.stdout.write('📋 Quick login credentials:')
        self.stdout.write('   Organizer  → username: alexma       / pass: demo1234')
        self.stdout.write('   Member     → username: sofiag       / pass: demo1234')
        self.stdout.write('   Member     → username: carlosll     / pass: demo1234')
        self.stdout.write(f'\n   Total: {len(users)} users · {len(clubs)} clubs · {len(events)} events')
        self.stdout.write('─' * 50 + '\n')
