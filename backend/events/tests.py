from django.test import TestCase
from django.contrib.auth import get_user_model
from events.models import Event, Registration, DistributionGroup
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from datetime import timedelta

User = get_user_model()

class FunctionalLogicTest(TestCase):
    def setUp(self):
        # Users
        self.normal_user = User.objects.create_user(username='normal', email='normal@test.com', password='password123')
        self.admin_user = User.objects.create_user(username='gadmin', email='admin@test.com', password='password123')
        
        # Clients
        self.client_user = APIClient()
        self.client_user.force_authenticate(user=self.normal_user)
        
        self.client_admin = APIClient()
        self.client_admin.force_authenticate(user=self.admin_user)

    def test_01_public_event_flow(self):
        """Test simple user flow: View list, RSVP public event, Get Ticket"""
        print("\n🧪 TEST 1: Flujo de Usuario Normal (Evento Público)")
        
        # 1. Create Public Event (by some superadmin or seed)
        event = Event.objects.create(
            name="Fiesta Pública",
            date=timezone.now() + timedelta(days=5),
            location="Plaza",
            capacity=100,
            is_public=True
        )
        
        # 2. User lists events
        response = self.client_user.get('/api/events/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, "Fiesta Pública")
        print("✅ Listado de eventos funciona")

        # 3. User registers (RSVP)
        response = self.client_user.post(f'/api/registrations/', {'event': event.id, 'status': 'confirmed'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        print("✅ RSVP (Inscripción) exitoso")
        
        # 4. Check Ticket existence
        reg_id = response.data['id']
        reg = Registration.objects.get(pk=reg_id)
        self.assertTrue(reg.entry_code, "El ticket debe tener código QR")
        print(f"✅ Ticket generado: {reg.entry_code}")

    def test_02_group_admin_access_control(self):
        """Test Group Admin flow: Create Group, Create Private Event, Logic Check"""
        print("\n🧪 TEST 2: Flujo Admin de Grupo y Permisos")

        # 1. Create Group (authenticated as admin_user)
        response = self.client_admin.post('/api/groups/', {
            'name': 'Grupo VIP',
            'description': 'Solo para gente VIP',
            'is_public': False
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        group_id = response.data['id']
        print("✅ Grupo VIP creado")

        # 2. Create PRIVATE Event linked to Group
        response = self.client_admin.post('/api/events/', {
            'name': 'Fiesta Secreta',
            'date': (timezone.now() + timedelta(days=10)).isoformat(),
            'location': 'Bunker',
            'capacity': 50,
            'is_public': False,
            'group': group_id
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        event_id = response.data['id']
        print("✅ Evento Privado (Grupo VIP) creado")

        # 3. Verify Normal User CANNOT see the private event
        # Logic: Events endpoint filters private events unless you are a member
        response = self.client_user.get('/api/events/')
        # Should NOT contain 'Fiesta Secreta'
        self.assertNotContains(response, "Fiesta Secreta")
        print("✅ Lógica de Privacidad correcta: Usuario normal NO ve el evento")

        # 4. Add Normal User to Group (Simulate invitation/join)
        group = DistributionGroup.objects.get(pk=group_id)
        group.members.add(self.normal_user)
        print("ℹ️  Usuario normal añadido al grupo VIP")

        # 5. Verify Normal User NOW sees the event
        response = self.client_user.get('/api/events/')
        self.assertContains(response, "Fiesta Secreta")
        print("✅ Lógica de Acceso correcta: Miembro del grupo VE el evento")

    def test_03_qr_validation_logic(self):
        """Test logic for Validating QRs"""
        print("\n🧪 TEST 3: Validación de QR")
        
        # Setup: Event and Ticket
        event = Event.objects.create(
            name="Evento QR",
            date=timezone.now() + timedelta(days=1),
            location="Sala",
            capacity=50,
            is_public=True
        )
        event.admins.add(self.admin_user) # Make gadmin the event admin
        
        # User gets ticket
        reg = Registration.objects.create(user=self.normal_user, event=event, status='confirmed')
        qr_code = reg.entry_code
        
        # 1. Admin scans ticket (Valid)
        # Using verify_qr_scan (detail=False) found in views.py line 1108
        response = self.client_admin.post('/api/registrations/validate_qr/', {'qr_content': qr_code})
        
        if response.status_code == 404:
             print(f"⚠️ Endpoint 404. response: {response.content}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['valid'])
        print("✅ Admin valida QR exitosamente")

        # 2. Scan again (Should be used)
        response = self.client_admin.post('/api/registrations/validate_qr/', {'qr_content': qr_code})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['valid'])
        self.assertIn("YA UTILIZADO", response.data['message'])
        print("✅ Detección de QR duplicado/usado correcta")

