import React, { useEffect, useState } from 'react';
import axios from '../api';
import { fetchCurrentUser } from '../auth';
import MyEventQR from './MyEventQR';
import QRScanner from '../components/QRScanner';
import GroupForm from './GroupForm';

export default function GroupDetail({ groupId, onBack }) {
    const [group, setGroup] = useState(null);
    const [events, setEvents] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [showCreateEvent, setShowCreateEvent] = useState(false);
    const [showEditGroup, setShowEditGroup] = useState(false);
    const [newEventName, setNewEventName] = useState('');
    const [newEventDate, setNewEventDate] = useState('');
    const [newEventLocation, setNewEventLocation] = useState('');
    const [newEventCapacity, setNewEventCapacity] = useState('');
    const [newEventMaxQR, setNewEventMaxQR] = useState('');
    const [newEventDescription, setNewEventDescription] = useState('');
    const [newEventIsPublic, setNewEventIsPublic] = useState(true);
    const [newEventPrice, setNewEventPrice] = useState('');
    const [newEventDeadline, setNewEventDeadline] = useState('');
    const [viewingQREventId, setViewingQREventId] = useState(null);
    const [scanningQREventId, setScanningQREventId] = useState(null);
    const [invitations, setInvitations] = useState([]);
    const [showInvitations, setShowInvitations] = useState(false);
    const [generatingInvitation, setGeneratingInvitation] = useState(false);
    const [invitationExpireDays, setInvitationExpireDays] = useState(7);
    const [invitationMaxUses, setInvitationMaxUses] = useState('');
    const [members, setMembers] = useState([]);
    const [showMembers, setShowMembers] = useState(true);
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [showAddAdmin, setShowAddAdmin] = useState(false);
    const [admins, setAdmins] = useState([]);
    const [isMember, setIsMember] = useState(false);
    const [requestingAccess, setRequestingAccess] = useState(false);
    const [accessRequests, setAccessRequests] = useState([]);
    const [showAccessRequests, setShowAccessRequests] = useState(false);
    const [showAccessMessageForm, setShowAccessMessageForm] = useState(false);
    const [accessMessage, setAccessMessage] = useState('');

    useEffect(() => {
        fetchCurrentUser().then(u => setCurrentUser(u));
    }, []);

    useEffect(() => {
        if (!groupId) return;
        loadGroup();
    }, [groupId]);

    useEffect(() => {
        if (isAdmin && groupId) {
            loadInvitations();
            loadAccessRequests();
        }
    }, [isAdmin, groupId]);

    useEffect(() => {
        if (group && currentUser) {
            const adminIds = group.admins || [];
            setIsAdmin(adminIds.includes(currentUser.id) || currentUser.role === 'admin');

            const memberIds = group.members || [];
            setIsMember(memberIds.includes(currentUser.id));
        }
    }, [group, currentUser]);

    function loadGroup() {
        setLoading(true);

        Promise.all([
            axios.get(`groups/${groupId}/`),
            axios.get(`events/?group=${groupId}`)
        ])
            .then(([groupRes, eventsRes]) => {
                setGroup(groupRes.data);
                const payload = eventsRes.data;
                const items = Array.isArray(payload) ? payload : (payload.results || []);
                setEvents(items);

                // Load members details
                const memberIds = groupRes.data.members || [];
                if (memberIds.length > 0) {
                    loadMembers(memberIds);
                } else {
                    setMembers([]);
                }
            })
            .catch(err => console.error('Error loading group details:', err))
            .finally(() => setLoading(false));
    }

    function loadMembers(memberIds) {
        Promise.all(memberIds.map(id => axios.get(`users/${id}/`)))
            .then(responses => {
                setMembers(responses.map(res => res.data));

                // Also load admin details
                const adminIds = group?.admins || [];
                if (adminIds.length > 0) {
                    Promise.all(adminIds.map(id => axios.get(`users/${id}/`)))
                        .then(adminResponses => {
                            setAdmins(adminResponses.map(res => res.data));
                        })
                        .catch(err => console.error('Error loading admins:', err));
                }
            })
            .catch(err => console.error('Error loading members:', err));
    }

    function loadInvitations() {
        axios.get(`groups/${groupId}/invitations/`)
            .then(res => setInvitations(res.data))
            .catch(err => console.error('Error loading invitations:', err));
    }

    function createInvitation() {
        setGeneratingInvitation(true);
        const payload = {
            expires_in_days: invitationExpireDays,
            max_uses: invitationMaxUses ? parseInt(invitationMaxUses) : null
        };

        axios.post(`groups/${groupId}/create_invitation/`, payload)
            .then(() => {
                loadInvitations();
                setInvitationExpireDays(7);
                setInvitationMaxUses('');
            })
            .catch(err => alert('Error: ' + (err.response?.data?.detail || err.message)))
            .finally(() => setGeneratingInvitation(false));
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text)
            .then(() => alert('Enlace copiado al portapapeles'))
            .catch(() => alert('No se pudo copiar el enlace'));
    }

    function shareWhatsApp(url, groupName) {
        const message = `¡Únete a mi grupo "${groupName}" en EventoApp! ${url}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    }

    function shareEmail(url, groupName) {
        const subject = `Invitación al grupo ${groupName}`;
        const body = `Has sido invitado a unirte al grupo "${groupName}" en EventoApp.\n\nHaz clic en el siguiente enlace para unirte:\n${url}`;
        const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoUrl;
    }

    function addMemberToGroup(userId) {
        axios.post(`groups/${groupId}/add_member/`, { user_id: userId })
            .then(() => {
                alert('Miembro añadido');
                loadGroup();
            })
            .catch(err => alert('Error: ' + (err.response?.data?.detail || err.message)));
    }

    function removeMemberFromGroup(userId) {
        if (!window.confirm('¿Eliminar este miembro del grupo?')) return;
        axios.post(`groups/${groupId}/remove_member/`, { user_id: userId })
            .then(() => {
                loadGroup();
            })
            .catch(err => alert('Error: ' + (err.response?.data?.detail || err.message)));
    }

    function toggleAdmin(userId, isCurrentlyAdmin) {
        const action = isCurrentlyAdmin ? 'quitar' : 'dar';
        if (!window.confirm(`¿Seguro que deseas ${action} privilegios de admin?`)) return;

        const endpoint = isCurrentlyAdmin ? 'remove_admin' : 'add_admin';
        axios.post(`groups/${groupId}/${endpoint}/`, { user_id: userId })
            .then(() => {
                loadGroup();
                alert(isCurrentlyAdmin ? 'Admin removido exitosamente' : 'Admin agregado exitosamente');
            })
            .catch(err => alert('Error: ' + (err.response?.data?.detail || err.message)));
    }

    function addGroupAdmin() {
        if (!newAdminEmail.trim()) {
            alert('Por favor ingresa un email');
            return;
        }

        // Find user by email first
        axios.get(`users/?email=${encodeURIComponent(newAdminEmail)}`)
            .then(res => {
                const users = Array.isArray(res.data) ? res.data : (res.data.results || []);
                if (users.length === 0) {
                    alert('Usuario no encontrado con ese email');
                    return;
                }
                const user = users[0];

                // Add user as admin to group
                return axios.post(`groups/${groupId}/add_admin/`, { user_id: user.id });
            })
            .then(() => {
                setNewAdminEmail('');
                setShowAddAdmin(false);
                loadGroup();
                alert('Admin agregado exitosamente');
            })
            .catch(err => {
                console.error('Error adding admin:', err.response?.data || err.message);
                alert('Error al agregar admin: ' + (err.response?.data?.detail || err.message));
            });
    }

    function removeGroupAdmin(userId) {
        if (!window.confirm('¿Estás seguro de remover este admin?')) {
            return;
        }

        axios.post(`groups/${groupId}/remove_admin/`, { user_id: userId })
            .then(() => {
                loadGroup();
                alert('Admin removido exitosamente');
            })
            .catch(err => {
                console.error('Error removing admin:', err.response?.data || err.message);
                alert('Error al remover admin: ' + (err.response?.data?.detail || err.message));
            });
    }

    function requestAccess() {
        setShowAccessMessageForm(true);
    }

    function submitAccessRequest() {
        setRequestingAccess(true);

        axios.post(`groups/${groupId}/request_access/`, {
            message: accessMessage
        })
            .then(() => {
                alert('Solicitud de acceso enviada. Los administradores serán notificados.');
                setShowAccessMessageForm(false);
                setAccessMessage('');
                loadGroup(); // Recargar el grupo para actualizar el estado
            })
            .catch(err => {
                const errorMsg = err.response?.data?.detail || err.message;
                alert('Error al solicitar acceso: ' + errorMsg);
                console.error('Error requesting access:', err);
            })
            .finally(() => {
                setRequestingAccess(false);
            });
    }

    function loadAccessRequests() {
        axios.get(`groups/${groupId}/access_requests/`)
            .then(res => {
                const requests = Array.isArray(res.data) ? res.data : (res.data.results || []);
                setAccessRequests(requests);
            })
            .catch(err => console.error('Error loading access requests:', err));
    }

    function approveAccessRequest(requestId) {
        axios.post(`groups/${groupId}/approve_access/`, { request_id: requestId })
            .then(() => {
                alert('Solicitud aprobada');
                loadAccessRequests();
                loadGroup();
            })
            .catch(err => {
                console.error('Error approving request:', err);
                alert('Error al aprobar: ' + (err.response?.data?.detail || err.message));
            });
    }

    function rejectAccessRequest(requestId) {
        axios.post(`groups/${groupId}/reject_access/`, {
            request_id: requestId,
            admin_notes: 'Solicitud rechazada'
        })
            .then(() => {
                alert('Solicitud rechazada');
                loadAccessRequests();
            })
            .catch(err => {
                console.error('Error rejecting request:', err);
                alert('Error al rechazar: ' + (err.response?.data?.detail || err.message));
            });
    }

    function leaveGroup() {
        if (!window.confirm('¿Estás seguro de que quieres abandonar este grupo?')) {
            return;
        }

        axios.post(`groups/${groupId}/remove_member/`, { user_id: currentUser.id })
            .then(() => {
                alert('Has abandonado el grupo exitosamente');
                onBack(); // Return to groups list
            })
            .catch(err => {
                const errorMsg = err.response?.data?.detail || err.message;
                alert('Error al abandonar el grupo: ' + errorMsg);
            });
    }

    function createEvent(e) {
        e.preventDefault();
        if (!newEventName || !newEventDate) {
            alert('Nombre y fecha son obligatorios');
            return;
        }

        const payload = {
            name: newEventName,
            date: newEventDate,
            location: newEventLocation || 'No especificada',
            capacity: newEventCapacity ? parseInt(newEventCapacity) : 100,
            max_qr_codes: newEventMaxQR ? parseInt(newEventMaxQR) : null,
            description: newEventDescription,
            group: groupId,
            is_public: newEventIsPublic,
            is_public: newEventIsPublic,
            price: 0.00,
            registration_deadline: newEventDeadline || null
        };

        axios.post('events/', payload)
            .then(() => {
                setShowCreateEvent(false);
                setNewEventName('');
                setNewEventDate('');
                setNewEventLocation('');
                setNewEventCapacity('');
                setNewEventMaxQR('');
                setNewEventDescription('');
                setNewEventIsPublic(true);
                setNewEventDeadline('');
                loadGroup();
            })
            .catch(err => {
                console.error('Error creating event:', err.response?.data || err.message);
                alert('Error creando evento: ' + (err.response?.data?.detail || JSON.stringify(err.response?.data) || err.message));
            });
    }

    function addGroupAdmin() {
        if (!newAdminEmail.trim()) {
            alert('Por favor ingresa un email');
            return;
        }

        // Find user by email first
        axios.get(`users/?email=${encodeURIComponent(newAdminEmail)}`)
            .then(res => {
                const users = Array.isArray(res.data) ? res.data : (res.data.results || []);
                if (users.length === 0) {
                    alert('Usuario no encontrado con ese email');
                    return;
                }
                const user = users[0];

                // Add user as admin to group
                return axios.post(`groups/${groupId}/add_admin/`, { user_id: user.id });
            })
            .then(() => {
                setNewAdminEmail('');
                setShowAddAdmin(false);
                alert('Admin agregado exitosamente');
                loadGroup(); // Reload to get updated admins
            })
            .catch(err => {
                console.error('Error adding admin:', err.response?.data || err.message);
                alert('Error al agregar admin: ' + (err.response?.data?.detail || err.message));
            });
    }

    function removeGroupAdmin(userId) {
        if (!window.confirm('¿Estás seguro de remover este admin?')) {
            return;
        }

        axios.post(`groups/${groupId}/remove_admin/`, { user_id: userId })
            .then(() => {
                alert('Admin removido exitosamente');
                loadGroup(); // Reload to get updated admins
            })
            .catch(err => {
                console.error('Error removing admin:', err.response?.data || err.message);
                alert('Error al remover admin: ' + (err.response?.data?.detail || err.message));
            });
    }

    if (loading) return <div className="container"><p>Cargando...</p></div>;
    if (!group) return <div className="container"><p>Grupo no encontrado</p></div>;

    if (viewingQREventId) {
        return <MyEventQR eventId={viewingQREventId} onBack={() => setViewingQREventId(null)} isMember={isMember} />;
    }

    if (scanningQREventId) {
        return <QRScanner eventId={scanningQREventId} onBack={() => setScanningQREventId(null)} />;
    }

    return (
        <div className="container">
            <button className="btn secondary" onClick={onBack} style={{ marginBottom: 12 }}>← Volver a grupos</button>

            <div className="card">
                {/* Logo del grupo */}
                <div style={{
                    width: '100%',
                    aspectRatio: '1',
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #f1f5f9 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '24px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '2px solid #e2e8f0'
                }}>
                    {group.logo ? (
                        <img
                            src={group.logo}
                            alt={group.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        <div style={{ textAlign: 'center', color: '#cbd5e1' }}>
                            <div style={{ fontSize: '80px' }}>📸</div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ marginTop: 0, marginBottom: '8px' }}>{group.name}</h2>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                            <div style={{
                                padding: '6px 12px',
                                background: group.is_public ? '#dcfce7' : '#fef3c7',
                                color: group.is_public ? '#166534' : '#92400e',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: '600'
                            }}>
                                {group.is_public ? '🌐 Público' : '🔒 Privado'}
                            </div>
                        </div>
                        {group.description && (
                            <p style={{ color: '#64748b', margin: '0 0 12px 0', lineHeight: '1.6' }}>
                                {group.description}
                            </p>
                        )}
                        <div className="muted">
                            {isAdmin ? '✓ Eres administrador de este grupo' : isMember ? '✓ Miembro del grupo' : 'No eres miembro de este grupo'}
                        </div>
                    </div>
                    <div>
                        {!isMember && !isAdmin && (
                            <button
                                className="btn"
                                onClick={requestAccess}
                                disabled={requestingAccess}
                            >
                                {requestingAccess ? 'Enviando...' : '➕ Solicitar unirse'}
                            </button>
                        )}
                        {isMember && !isAdmin && (
                            <button
                                className="btn secondary"
                                onClick={leaveGroup}
                                style={{ backgroundColor: '#dc3545', color: 'white' }}
                            >
                                🚪 Abandonar grupo
                            </button>
                        )}
                        {isAdmin && (
                            <button
                                className="btn"
                                onClick={() => setShowEditGroup(!showEditGroup)}
                                style={{ marginBottom: '12px' }}
                            >
                                {showEditGroup ? '✕ Cancelar' : '✏️ Editar grupo'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Sección de edición del grupo */}
                {isAdmin && showEditGroup && (
                    <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Editar información del grupo</h3>
                        <GroupForm groupId={groupId} onSaved={() => { setShowEditGroup(false); loadGroup(); }} />
                    </div>
                )}

                {/* Formulario de solicitud de acceso */}
                {showAccessMessageForm && !isMember && !isAdmin && (
                    <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>📝 Solicitar acceso al grupo</h3>
                        <div className="card" style={{ backgroundColor: '#f0f9ff', borderLeft: '4px solid #0ea5e9' }}>
                            <p style={{ color: '#475569', marginBottom: '16px' }}>
                                Este es un grupo privado. Los administradores revisarán tu solicitud.
                            </p>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                                    Mensaje opcional (máx 300 caracteres)
                                </label>
                                <textarea
                                    value={accessMessage}
                                    onChange={(e) => setAccessMessage(e.target.value.slice(0, 300))}
                                    placeholder="Cuéntales por qué quieres unirte a este grupo..."
                                    rows={4}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '4px',
                                        border: '1px solid #cbd5e1',
                                        fontFamily: 'inherit',
                                        resize: 'vertical',
                                        boxSizing: 'border-box'
                                    }}
                                />
                                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', textAlign: 'right' }}>
                                    {accessMessage.length}/300
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    className="btn secondary"
                                    onClick={() => {
                                        setShowAccessMessageForm(false);
                                        setAccessMessage('');
                                    }}
                                    style={{ flex: 1 }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="btn"
                                    onClick={submitAccessRequest}
                                    disabled={requestingAccess}
                                    style={{ flex: 1, backgroundColor: '#10b981' }}
                                >
                                    {requestingAccess ? '⏳ Enviando...' : '📩 Enviar Solicitud'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Events Section */}
            <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0 }}>Eventos del grupo</h3>
                    {isAdmin && (
                        <button className="btn" onClick={() => setShowCreateEvent(!showCreateEvent)}>
                            {showCreateEvent ? 'Cancelar' : 'Crear Evento'}
                        </button>
                    )}
                </div>

                {showCreateEvent && (
                    <form className="card" onSubmit={createEvent} style={{ marginBottom: 12 }}>
                        <h4 style={{ marginTop: 0 }}>Nuevo Evento</h4>
                        <div className="form-row">
                            <label>Nombre *</label>
                            <input type="text" value={newEventName} onChange={e => setNewEventName(e.target.value)} required />
                        </div>
                        <div className="form-row">
                            <label>Fecha *</label>
                            <input type="datetime-local" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} required />
                        </div>
                        <div className="form-row">
                            <label>Ubicación</label>
                            <input type="text" value={newEventLocation} onChange={e => setNewEventLocation(e.target.value)} />
                        </div>
                        <div className="form-row">
                            <label>Capacidad</label>
                            <input type="number" value={newEventCapacity} onChange={e => setNewEventCapacity(e.target.value)} />
                        </div>
                        <div className="form-row">
                            <label>Límite de QR/Tokens</label>
                            <input type="number" value={newEventMaxQR} onChange={e => setNewEventMaxQR(e.target.value)} placeholder="Dejar vacío para ilimitado" />
                        </div>
                        <div className="form-row">
                            <label>Fecha Límite Inscripción (Opcional)</label>
                            <input type="datetime-local" value={newEventDeadline} onChange={e => setNewEventDeadline(e.target.value)} />
                        </div>

                        <div className="form-row">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={newEventIsPublic}
                                    onChange={e => setNewEventIsPublic(e.target.checked)}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                                <span>Evento público (visible para todos)</span>
                            </label>
                            <small style={{ color: '#64748b', marginTop: '4px', display: 'block' }}>
                                {newEventIsPublic ? 'El evento será visible para todos los usuarios' : 'El evento solo será visible para miembros del grupo'}
                            </small>
                        </div>
                        <div className="form-row">
                            <label>Descripción</label>
                            <textarea value={newEventDescription} onChange={e => setNewEventDescription(e.target.value)} rows={3}></textarea>
                        </div>
                        <button type="submit" className="btn">Crear</button>
                    </form>
                )}

                {events.length === 0 ? (
                    <div className="card">No hay eventos en este grupo.</div>
                ) : (
                    <div className="grid">
                        {events.map(ev => (
                            <div className="card event-card" key={ev.id}>
                                <h3>{ev.name}</h3>
                                <div className="muted">{ev.date ? new Date(ev.date).toLocaleString() : 'Fecha desconocida'}</div>
                                {ev.description && <p style={{ marginTop: 8 }}>{ev.description}</p>}
                                <div style={{ marginTop: 8 }}>
                                    <strong>Límite QR:</strong> {ev.max_qr_codes || 'Ilimitado'}
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                    <button className="btn secondary" onClick={() => setViewingQREventId(ev.id)}>Ver mi QR</button>
                                    {isAdmin && (
                                        <button className="btn" onClick={() => setScanningQREventId(ev.id)}>Escanear QR</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Members Section - Only for admins */}
            {isAdmin && (
                <div style={{ marginTop: 20 }}>
                    <h3>Invitaciones</h3>
                    <button className="btn" onClick={() => setShowInvitations(!showInvitations)} style={{ marginBottom: 12 }}>
                        {showInvitations ? 'Ocultar invitaciones' : 'Gestionar invitaciones'}
                    </button>

                    {showInvitations && (
                        <div>
                            {/* Create new invitation */}
                            <div className="card" style={{ marginBottom: 12 }}>
                                <h4 style={{ marginTop: 0 }}>Crear nueva invitación</h4>
                                <div className="form-row">
                                    <label>Expira en (días)</label>
                                    <input
                                        type="number"
                                        value={invitationExpireDays}
                                        onChange={e => setInvitationExpireDays(e.target.value)}
                                        min="1"
                                    />
                                </div>
                                <div className="form-row">
                                    <label>Máximo de usos (vacío = ilimitado)</label>
                                    <input
                                        type="number"
                                        value={invitationMaxUses}
                                        onChange={e => setInvitationMaxUses(e.target.value)}
                                        placeholder="Ilimitado"
                                    />
                                </div>
                                <button
                                    className="btn"
                                    onClick={createInvitation}
                                    disabled={generatingInvitation}
                                >
                                    {generatingInvitation ? 'Generando...' : 'Generar enlace de invitación'}
                                </button>
                            </div>

                            {/* List active invitations */}
                            {invitations.length === 0 ? (
                                <div className="card">No hay invitaciones activas</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {invitations.map(inv => (
                                        <div className="card" key={inv.id} style={{
                                            backgroundColor: inv.is_valid ? 'var(--surface)' : 'var(--muted)',
                                            opacity: inv.is_valid ? 1 : 0.6
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div className="muted" style={{ fontSize: '0.85em', marginBottom: 4 }}>
                                                        Creada por {inv.created_by} • {new Date(inv.created_at).toLocaleDateString()}
                                                    </div>
                                                    <div style={{ fontSize: '0.9em', fontFamily: 'monospace', padding: '4px 8px', backgroundColor: 'var(--bg)', borderRadius: 4, marginBottom: 8, wordBreak: 'break-all' }}>
                                                        {inv.url}
                                                    </div>
                                                    <div style={{ fontSize: '0.85em' }}>
                                                        <span className="muted">Expira:</span> {new Date(inv.expires_at).toLocaleString()} •
                                                        <span className="muted"> Usos:</span> {inv.use_count}/{inv.max_uses || '∞'} •
                                                        <span className="muted"> Estado:</span> {inv.is_valid ? '✅ Válida' : '❌ Expirada/Agotada'}
                                                    </div>
                                                </div>
                                            </div>
                                            {inv.is_valid && (
                                                <div style={{ marginTop: 12 }}>
                                                    {navigator.share ? (
                                                        <button
                                                            className="btn full"
                                                            style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)', border: 'none' }}
                                                            onClick={() => {
                                                                const shareText = `¡Hola! ${currentUser?.username || 'Alguien'} te invita a unirte al grupo "${group.name}" en EventoApp.`;
                                                                navigator.share({
                                                                    title: `Invitación de ${group.name}`,
                                                                    text: shareText,
                                                                    url: inv.url
                                                                }).catch(console.error);
                                                            }}
                                                        >
                                                            📤 Compartir Invitación
                                                        </button>
                                                    ) : (
                                                        <div style={{ display: 'flex', gap: 8 }}>
                                                            <button className="btn secondary" onClick={() => copyToClipboard(inv.url)} style={{ flex: 1 }}>
                                                                📋 Copiar
                                                            </button>
                                                            <button
                                                                className="btn"
                                                                style={{ backgroundColor: '#25D366', flex: 1, border: 'none' }}
                                                                onClick={() => {
                                                                    const message = `¡Hola! ${currentUser?.username || 'Alguien'} te invita a unirte al grupo "${group.name}" en EventoApp. ${inv.url}`;
                                                                    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                                                                    window.open(whatsappUrl, '_blank');
                                                                }}
                                                            >
                                                                WhatsApp
                                                            </button>
                                                            <button className="btn secondary" onClick={() => shareEmail(inv.url, group.name)} style={{ flex: 1 }}>
                                                                📧 Email
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Admins Section */}
            {isAdmin && admins.length > 0 && (
                <div className="card" style={{ marginTop: 20, padding: 16, backgroundColor: '#fef3c7', borderColor: '#fbbf24' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 style={{ margin: 0 }}>👑 Administradores del grupo ({admins.length})</h3>
                        <button
                            className="btn secondary"
                            onClick={() => setShowAddAdmin(!showAddAdmin)}
                            style={{ fontSize: '12px', padding: '4px 8px' }}
                        >
                            {showAddAdmin ? 'Cancelar' : '+ Agregar Admin'}
                        </button>
                    </div>

                    {showAddAdmin && (
                        <div style={{ marginBottom: 12, padding: 8, backgroundColor: 'white', borderRadius: 4, display: 'flex', gap: 8 }}>
                            <input
                                type="email"
                                placeholder="Email del usuario"
                                value={newAdminEmail}
                                onChange={(e) => setNewAdminEmail(e.target.value)}
                                style={{ flex: 1, padding: '6px 10px', borderRadius: 4, border: '1px solid #ddd' }}
                            />
                            <button className="btn" onClick={addGroupAdmin} style={{ fontSize: '12px', padding: '6px 12px' }}>
                                Agregar
                            </button>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {admins.map(admin => (
                            <div key={admin.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '8px 12px',
                                backgroundColor: 'white',
                                borderRadius: 4,
                                fontSize: '13px'
                            }}>
                                <span style={{ fontWeight: 600 }}>{admin.username}</span>
                                <span className="muted" style={{ fontSize: '11px' }}>({admin.email})</span>
                                {admins.length > 1 && admin.id !== currentUser?.id && (
                                    <button
                                        onClick={() => removeGroupAdmin(admin.id)}
                                        style={{
                                            marginLeft: 4,
                                            padding: '2px 6px',
                                            fontSize: '11px',
                                            backgroundColor: '#fee2e2',
                                            border: '1px solid #fca5a5',
                                            borderRadius: 3,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Access Requests Section */}
            {isAdmin && (
                <div style={{ marginTop: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 style={{ margin: 0 }}>📝 Solicitudes de acceso ({accessRequests.filter(r => r.status === 'pending').length})</h3>
                        <button className="btn secondary" onClick={() => setShowAccessRequests(!showAccessRequests)}>
                            {showAccessRequests ? 'Ocultar' : 'Mostrar'}
                        </button>
                    </div>

                    {showAccessRequests && (
                        <>
                            {accessRequests.filter(r => r.status === 'pending').length === 0 ? (
                                <div className="card">No hay solicitudes de acceso pendientes</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {accessRequests.filter(r => r.status === 'pending').map(req => {
                                        const avatarUrl = req.user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.user?.username || 'Usuario')}&background=random&size=80`;

                                        return (
                                            <div className="card" key={req.id} style={{
                                                padding: 12,
                                                backgroundColor: '#f0f9ff',
                                                borderLeft: '4px solid #0ea5e9'
                                            }}>
                                                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                                                    <img
                                                        src={avatarUrl}
                                                        alt={req.user?.username}
                                                        style={{
                                                            width: 60,
                                                            height: 60,
                                                            borderRadius: '50%',
                                                            objectFit: 'cover',
                                                            border: '2px solid #0ea5e9'
                                                        }}
                                                    />
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: 2 }}>
                                                            {req.user?.username}
                                                        </div>
                                                        <div className="muted" style={{ fontSize: '12px', marginBottom: 6 }}>
                                                            {req.user?.email}
                                                        </div>
                                                        {req.message && (
                                                            <div style={{ fontSize: '13px', color: '#475569', padding: '8px', backgroundColor: 'white', borderRadius: 4, marginTop: 6 }}>
                                                                <strong>Mensaje:</strong> {req.message}
                                                            </div>
                                                        )}
                                                        <div className="muted" style={{ fontSize: '11px', marginTop: 6 }}>
                                                            Solicitado: {new Date(req.requested_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button
                                                        className="btn"
                                                        onClick={() => approveAccessRequest(req.id)}
                                                        style={{ flex: 1, fontSize: '12px', padding: '8px', backgroundColor: '#10b981', color: 'white' }}
                                                    >
                                                        ✓ Aprobar
                                                    </button>
                                                    <button
                                                        className="btn secondary"
                                                        onClick={() => rejectAccessRequest(req.id)}
                                                        style={{ flex: 1, fontSize: '12px', padding: '8px', backgroundColor: '#ef4444', color: 'white' }}
                                                    >
                                                        ✕ Rechazar
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Members list */}
            <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0 }}>Miembros del grupo ({members.length})</h3>
                    <button className="btn secondary" onClick={() => setShowMembers(!showMembers)}>
                        {showMembers ? 'Ocultar' : 'Mostrar'}
                    </button>
                </div>

                {showMembers && (
                    <>
                        {members.length === 0 ? (
                            <div className="card">No hay miembros en este grupo</div>
                        ) : (
                            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                                {members.map(member => {
                                    const avatarUrl = member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.username)}&background=random&size=100`;
                                    const isAdminMember = (group.admins || []).includes(member.id);

                                    return (
                                        <div className="card" key={member.id} style={{ textAlign: 'center', padding: 16 }}>
                                            <img
                                                src={avatarUrl}
                                                alt={member.username}
                                                style={{
                                                    width: 80,
                                                    height: 80,
                                                    borderRadius: '50%',
                                                    objectFit: 'cover',
                                                    border: isAdminMember ? '3px solid var(--primary)' : '2px solid var(--muted)',
                                                    marginBottom: 8
                                                }}
                                            />
                                            <div style={{ fontWeight: 600 }}>{member.username}</div>
                                            {(isAdmin || member.id === currentUser?.id) && (
                                                <div className="muted" style={{ fontSize: '0.85em', marginTop: 4 }}>
                                                    {member.email}
                                                </div>
                                            )}
                                            {isAdminMember && (
                                                <div style={{ marginTop: 4, fontSize: '0.8em', color: 'var(--primary)', fontWeight: 600 }}>
                                                    ⭐ Admin
                                                </div>
                                            )}
                                            {(isAdmin || member.id === currentUser?.id) && member.bio && (
                                                <div className="muted" style={{ fontSize: '0.8em', marginTop: 8, fontStyle: 'italic' }}>
                                                    {member.bio.length > 60 ? member.bio.substring(0, 60) + '...' : member.bio}
                                                </div>
                                            )}

                                            {/* Admin controls */}
                                            {isAdmin && member.id !== currentUser?.id && (
                                                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    <button
                                                        onClick={() => toggleAdmin(member.id, isAdminMember)}
                                                        className="btn secondary"
                                                        style={{ fontSize: '11px', padding: '4px 8px', width: '100%' }}
                                                    >
                                                        {isAdminMember ? '👑 Quitar Admin' : '⭐ Dar Admin'}
                                                    </button>
                                                    <button
                                                        onClick={() => removeMemberFromGroup(member.id)}
                                                        style={{
                                                            fontSize: '11px',
                                                            padding: '4px 8px',
                                                            backgroundColor: '#fee2e2',
                                                            border: '1px solid #fca5a5',
                                                            borderRadius: 4,
                                                            cursor: 'pointer',
                                                            width: '100%'
                                                        }}
                                                    >
                                                        🗑️ Eliminar
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Members list - deprecated since we now use invitations */}
            {isAdmin && (
                <div style={{ marginTop: 20 }}>
                    <h3>Miembros del grupo</h3>
                    <div className="card">
                        <p className="muted">Gestión de miembros disponible próximamente</p>
                    </div>
                </div>
            )}
        </div>
    );
}
