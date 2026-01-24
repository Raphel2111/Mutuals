from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('events', '0025_remove_entry_code_unique'),
    ]

    operations = [
        migrations.RunSQL(
            # For PostgreSQL
            sql=[
                "ALTER TABLE events_registration ALTER COLUMN entry_code DROP NOT NULL;",
                # Drop constraint if exists (name might vary but usually logic handles it, simply removing uniqueness index if present)
                "DROP INDEX IF EXISTS events_registration_entry_code_key;",
                "ALTER TABLE events_registration DROP CONSTRAINT IF EXISTS events_registration_entry_code_key;"
            ],
            # Reverse SQL (optional, best effort)
            reverse_sql=""
        ),
    ]
