"""
assign_founder_badges — Django management command
Usage:
    python manage.py assign_founder_badges --limit=100 --club_slug=mutuals-early-access
    python manage.py assign_founder_badges --limit=50  --dry-run
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from events.models import Club, ClubMembership
from users.models import User


class Command(BaseCommand):
    help = 'Assign the FOUNDER badge to the earliest registered approved club members.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=100,
                            help='Maximum number of users to badge (default: 100)')
        parser.add_argument('--club_slug', type=str, default='',
                            help='Slug or partial name of the target club (leave empty for all clubs)')
        parser.add_argument('--dry-run', action='store_true',
                            help='Preview the action without saving changes')

    def handle(self, *args, **options):
        limit    = options['limit']
        club_slug = options['club_slug']
        dry_run  = options['dry_run']

        qs = ClubMembership.objects.filter(status='approved').select_related('user', 'club')

        if club_slug:
            qs = qs.filter(club__name__icontains=club_slug)

        # Earliest registered users first
        qs = qs.order_by('user__date_joined')[:limit]

        count = 0
        for membership in qs:
            if membership.badge == 'founder':
                self.stdout.write(
                    self.style.WARNING(f'  SKIP (ya founder): {membership.user.username} — {membership.club.name}')
                )
                continue

            self.stdout.write(
                f'  {"[DRY-RUN] " if dry_run else ""}🏅 FOUNDER → {membership.user.username} ({membership.club.name})'
            )
            if not dry_run:
                membership.badge = 'founder'
                membership.save(update_fields=['badge'])
            count += 1

        mode = 'Simulación' if dry_run else 'Asignación'
        self.stdout.write(self.style.SUCCESS(
            f'\n✅ {mode} completada: {count} badge(s) FOUNDER {"(sin guardar)" if dry_run else "asignados"}.'
        ))
