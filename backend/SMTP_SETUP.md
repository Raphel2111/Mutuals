SMTP setup for production

Overview
- Use environment variables to configure SMTP. Do NOT commit real credentials into the repository.
- This project reads variables from a `.env` file when present (via `python-dotenv`). Use OS-level secret storage in production when possible.

Required environment variables
- `EMAIL_BACKEND` (e.g. `django.core.mail.backends.smtp.EmailBackend`)
- `EMAIL_HOST` (SMTP host, e.g. `smtp.sendgrid.net`)
- `EMAIL_PORT` (e.g. `587`)
- `EMAIL_HOST_USER` (SMTP username)
- `EMAIL_HOST_PASSWORD` (SMTP password)
- `EMAIL_USE_TLS` (`True` or `False`)
- `DEFAULT_FROM_EMAIL` (e.g. `no-reply@yourdomain.com`)

### Configuración específica para **Brevo** (antes Sendinblue)
Para usar Brevo, utiliza estos valores:
- `EMAIL_BACKEND`: `django.core.mail.backends.smtp.EmailBackend`
- `EMAIL_HOST`: `smtp-relay.brevo.com`
- `EMAIL_PORT`: `587`
- `EMAIL_USE_TLS`: `True`
- `EMAIL_HOST_USER`: Tu correo de registro en Brevo.
- `EMAIL_HOST_PASSWORD`: Tu **SMTP Key** (la generas en Brevo -> SMTP & API -> SMTP keys).
- `DEFAULT_FROM_EMAIL`: El correo que hayas verificado como remitente en Brevo.

Development quickstart (PowerShell)
1. Copy `.env.example` to `.env` in the `backend` folder and fill values.
2. Temporarily set env vars in the current PowerShell session:

```powershell
$env:EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend'
$env:EMAIL_HOST='smtp.example.com'
$env:EMAIL_PORT='587'
$env:EMAIL_HOST_USER='your_user'
$env:EMAIL_HOST_PASSWORD='your_password'
$env:EMAIL_USE_TLS='True'
$env:DEFAULT_FROM_EMAIL='no-reply@yourdomain.com'
```

3. Start the Django server:

```powershell
python manage.py runserver
```

4. Test email sending by creating a registration via the API; if configured, EmailLog entries will be recorded and errors will be written to `email_errors.log` in the `backend` directory.

Production recommendations
- Use a managed email provider (SendGrid, Mailgun, SES) to improve deliverability.
- Store secrets in your cloud provider's secret store (Azure Key Vault, AWS Secrets Manager) or in environment variables set by your deployment system; avoid `.env` on production servers if possible.
- Use TLS (port 587) or SMTPS (465) as required by provider.
- Monitor `email_errors.log` and enable Sentry (set `SENTRY_DSN`) to capture exceptions and alerts.
- Rotate SMTP credentials periodically and limit access.

Additional notes
- The project supports `EMAIL_BACKEND` values; for development use `django.core.mail.backends.console.EmailBackend` to print emails to console.
- If you need to send many emails, consider background processing (Celery, RQ) rather than sending synchronously during request handling.
