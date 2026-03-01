import React, { useEffect, useState } from 'react';
import EventAccessManager from '../components/EventAccessManager';
import MyEventQR from './MyEventQR';
import EventCapsule from './EventCapsule';
import OrganizerDashboard from './OrganizerDashboard';
import GuestCheckoutModal from '../components/GuestCheckoutModal';
import '../components/GuestCheckoutModal.css';
import { fetchCurrentUser } from '../auth';
import axios from '../api';

export default function EventDetail({ eventId, onBack, onViewClub, onJoinLobby }) {
    const [event, setEvent] = useState(null);
    const [registrations, setRegistrations] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [showAddAdmin, setShowAddAdmin] = useState(false);
    const [isEventAdmin, setIsEventAdmin] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [showGuestModal, setShowGuestModal] = useState(false);

    function startEditing() {
        setEditForm({
            name: event.name,
            date: event.date ? event.date.substring(0, 16) : '',
            location: event.location || '',
            capacity: event.capacity || '',
            max_qr_codes: event.max_qr_codes || '',
            description: event.description || '',
            is_public: event.is_public,
            registration_deadline: event.registration_deadline ? event.registration_deadline.substring(0, 16) : ''
        });
        setIsEditing(true);
    }

    function handleUpdateEvent(e) {
        e.preventDefault();
        axios.patch(`events/${eventId}/`, {
            ...editForm,
            max_qr_codes: editForm.max_qr_codes || null,
            registration_deadline: editForm.registration_deadline || null
        })
            .then(res => {
                setEvent(res.data);
                setIsEditing(false);
                alert('Evento actualizado correctamente');
            })
            .catch(err => alert('Error al actualizar: ' + (err.response?.data?.detail || JSON.stringify(err.response?.data))));
    }

    function handleDeleteEvent() {
        if (!window.confirm('¿Estás seguro de que quieres borrar este evento? Esta acción no se puede deshacer.')) return;
        axios.delete(`events/${eventId}/`)
            .then(() => {
                alert('Evento borrado exitosamente');
                onBack(); // Go back to the previous list
            })
            .catch(err => alert('Error al borrar: ' + (err.response?.data?.detail || err.message)));
    }

    useEffect(() => {
        fetchCurrentUser()
            .then(u => setCurrentUser(u))
            .catch(() => setCurrentUser(null));
    }, []);

    useEffect(() => {
        if (!eventId) return; // Allow currentUser to be null for Guest state
        setLoading(true);

        const requests = [axios.get(`events/${eventId}/`)];
        if (currentUser) {
            requests.push(axios.get(`registrations/?event=${eventId}&user=${currentUser.id}`));
        }

        Promise.all(requests)
            .then(([eventRes, regsRes]) => {
                setEvent(eventRes.data);
                if (regsRes) {
                    const payload = regsRes.data;
                    const items = Array.isArray(payload) ? payload : (payload.results || []);
                    setRegistrations(items);
                }
                // Use the backend-provided 'is_admin' flag
                setIsEventAdmin(eventRes.data.is_admin);
            })
            .catch(err => console.error('Error loading event details:', err))
            .finally(() => setLoading(false));
    }, [eventId, currentUser]);

    // createRegistration function removed - managed by MyEventQR

    function deleteRegistration(regId) {
        if (!window.confirm('¿Estás seguro de eliminar esta inscripción? Esta acción no se puede deshacer.')) {
            return;
        }

        axios.delete(`registrations/${regId}/`)
            .then(() => {
                setRegistrations(prev => prev.filter(r => r.id !== regId));
                alert('Inscripción eliminada correctamente.');
            })
            .catch(err => {
                console.error('Error deleting registration:', err.response?.data || err.message);
                alert('Error al eliminar inscripción: ' + (err.response?.data?.detail || err.message));
            });
    }

    function addAdmin() {
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

                // Add user as admin to event
                return axios.post(`events/${eventId}/add_admin/`, { user_id: user.id });
            })
            .then(res => {
                // Update local event state with new admins list from backend
                setEvent(prev => ({ ...prev, admins: res.data.admins }));
                setNewAdminEmail('');
                setShowAddAdmin(false);
                alert('Admin agregado exitosamente');
            })
            .catch(err => {
                console.error('Error adding admin:', err.response?.data || err.message);
                alert('Error al agregar admin: ' + (err.response?.data?.detail || err.message));
            });
    }

    function removeAdmin(userId) {
        if (!window.confirm('¿Estás seguro de remover este admin?')) {
            return;
        }

        axios.post(`events/${eventId}/remove_admin/`, { user_id: userId })
            .then(res => {
                // Update local event state with new admins list from backend
                setEvent(prev => ({ ...prev, admins: res.data.admins }));
                alert('Admin removido exitosamente');
            })
            .catch(err => {
                console.error('Error removing admin:', err.response?.data || err.message);
                alert('Error al remover admin: ' + (err.response?.data?.detail || err.message));
            });
    }

    // loadParticipants and removeParticipant functions removed - managed by EventAccessManager



    const isValidId = (id) => {
        return id !== null && id !== undefined;
    };

    if (loading) return <div className="container"><p>Cargando...</p></div>;
    if (!event) return <div className="container"><p>Evento no encontrado</p></div>;

    return (
        <div className="container">
            <button className="btn secondary" onClick={onBack} style={{ marginBottom: 12 }}>← Volver a eventos</button>

            <div className="card glassmorphism" style={{ borderTop: '4px solid var(--primary)', padding: '32px' }}>
                {isEventAdmin && (
                    <div style={{
                        display: 'flex',
                        gap: 12,
                        padding: '16px',
                        background: 'rgba(192, 132, 252, 0.1)',
                        border: '1px solid rgba(192, 132, 252, 0.2)',
                        borderRadius: 12,
                        marginBottom: 24,
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--primary)' }}>🛠️ Gestión de Administrador:</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {!isEditing ? (
                                <>
                                    <button className="btn primary" onClick={startEditing} style={{ padding: '8px 16px', fontSize: '13px' }}>✏️ Editar Evento</button>
                                    <button className="btn secondary" onClick={handleDeleteEvent} style={{ padding: '8px 16px', fontSize: '13px', borderColor: 'var(--danger)', color: 'var(--danger)' }}>🗑️ Borrar</button>
                                </>
                            ) : (
                                <button className="btn secondary" onClick={() => setIsEditing(false)} style={{ padding: '8px 16px', fontSize: '13px' }}>Cancelar Edición</button>
                            )}
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ marginTop: 0, fontSize: '32px', fontWeight: '900', letterSpacing: '-1px' }}>{event.name}</h2>
                        <div style={{ color: 'var(--muted)', fontSize: '16px', fontWeight: '500' }}>{event.date ? new Date(event.date).toLocaleString([], { weekday: 'short', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Fecha desconocida'}</div>
                        {event.registration_deadline && (
                            <div style={{ marginTop: 8, color: 'var(--warning)', fontWeight: 600, fontSize: '0.9em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                ⏳ <span>Cierre inscripción: {new Date(event.registration_deadline).toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {event.club && onViewClub && (
                            <button
                                className="btn secondary"
                                onClick={() => onViewClub(event.club)}
                                style={{ fontSize: '14px', padding: '8px 16px', border: '1px solid rgba(255,255,255,0.1)' }}
                            >
                                🏛️ Ver Club
                            </button>
                        )}
                        {registrations.length > 0 && onJoinLobby && (
                            <button
                                className="btn btn-shimmer"
                                onClick={() => onJoinLobby({ id: event.id, name: event.name })}
                                style={{
                                    fontSize: '14px',
                                    padding: '8px 16px',
                                    background: 'var(--accent-gradient)',
                                    color: 'white',
                                    border: 'none',
                                    boxShadow: 'var(--shadow-glow)'
                                }}
                            >
                                🏛️ Entrar al Social Lobby
                            </button>
                        )}
                        {!currentUser && (
                            <button
                                className="btn btn-shimmer"
                                onClick={() => setShowGuestModal(true)}
                                style={{
                                    fontSize: '14px',
                                    padding: '8px 16px',
                                    background: 'var(--accent-gradient)',
                                    color: 'white',
                                    border: 'none',
                                    boxShadow: 'var(--shadow-glow)'
                                }}
                            >
                                🎟️ Compra Instantánea
                            </button>
                        )}
                    </div>
                </div>

                <GuestCheckoutModal
                    isOpen={showGuestModal}
                    onClose={() => setShowGuestModal(false)}
                    eventId={eventId}
                />

                {isEditing && (
                    <form className="card" onSubmit={handleUpdateEvent} style={{ marginBottom: 24, border: '1px solid var(--primary)', backgroundColor: 'var(--surface)' }}>
                        <h4 style={{ marginTop: 0 }}>✏️ Editando Evento</h4>
                        <div className="form-row" style={{ marginBottom: 12 }}>
                            <label style={{ display: 'block', marginBottom: 4 }}>Nombre *</label>
                            <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required style={{ width: '100%', padding: '8px' }} />
                        </div>
                        <div className="form-row" style={{ marginBottom: 12 }}>
                            <label style={{ display: 'block', marginBottom: 4 }}>Fecha *</label>
                            <input type="datetime-local" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} required style={{ width: '100%', padding: '8px' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div className="form-row">
                                <label style={{ display: 'block', marginBottom: 4 }}>Ubicación</label>
                                <input type="text" value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                            </div>
                            <div className="form-row">
                                <label style={{ display: 'block', marginBottom: 4 }}>Capacidad</label>
                                <input type="number" value={editForm.capacity} onChange={e => setEditForm({ ...editForm, capacity: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div className="form-row">
                                <label style={{ display: 'block', marginBottom: 4 }}>Límite QR</label>
                                <input type="number" value={editForm.max_qr_codes} onChange={e => setEditForm({ ...editForm, max_qr_codes: e.target.value })} placeholder="Vacío = Ilimitado" style={{ width: '100%', padding: '8px' }} />
                            </div>
                            <div className="form-row">
                                <label style={{ display: 'block', marginBottom: 4 }}>Límite Inscripción (opcional)</label>
                                <input type="datetime-local" value={editForm.registration_deadline} onChange={e => setEditForm({ ...editForm, registration_deadline: e.target.value })} style={{ width: '100%', padding: '8px' }} />
                            </div>
                        </div>
                        <div className="form-row" style={{ marginBottom: 12 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input type="checkbox" checked={editForm.is_public} onChange={e => setEditForm({ ...editForm, is_public: e.target.checked })} />
                                Evento público (visible para todos)
                            </label>
                        </div>
                        <div className="form-row" style={{ marginBottom: 12 }}>
                            <label style={{ display: 'block', marginBottom: 4 }}>Descripción</label>
                            <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={3} style={{ width: '100%', padding: '8px' }}></textarea>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button type="submit" className="btn" style={{ flex: 1 }}>Guardar Cambios</button>
                            <button type="button" className="btn secondary" onClick={() => setIsEditing(false)} style={{ flex: 1 }}>Cancelar</button>
                        </div>
                    </form>
                )}

                {event.club_name && (
                    <div style={{ marginBottom: 16, padding: '12px', background: 'rgba(192, 132, 252, 0.05)', borderRadius: 8, border: '1px solid rgba(192, 132, 252, 0.2)' }}>
                        <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>🏛️ Club:</span> {event.club_name}
                    </div>
                )}
                {event.description && <p style={{ lineHeight: 1.6, color: 'var(--text)', marginBottom: 24 }}>{event.description}</p>}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: 24 }}>
                    <div style={{ background: 'var(--surface-light)', padding: 16, borderRadius: 12 }}>
                        <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Ubicación</div>
                        <div style={{ fontWeight: 600 }}>{event.location || 'No especificada'}</div>
                    </div>
                    <div style={{ background: 'var(--surface-light)', padding: 16, borderRadius: 12 }}>
                        <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Capacidad</div>
                        <div style={{ fontWeight: 600 }}>{event.capacity || 'Ilimitada'}</div>
                    </div>
                    <div style={{ background: 'var(--surface-light)', padding: 16, borderRadius: 12 }}>
                        <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Visibilidad</div>
                        <div style={{ fontWeight: 600 }}>{event.is_public ? '🌍 Público' : '🔒 Privado'}</div>
                    </div>
                    {event.registration_deadline && (
                        <div style={{ background: 'rgba(249, 115, 22, 0.1)', padding: 16, borderRadius: 12, border: '1px solid rgba(249, 115, 22, 0.3)' }}>
                            <div style={{ fontSize: 12, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Cierre Inscripción</div>
                            <div style={{ fontWeight: 600, color: new Date() > new Date(event.registration_deadline) ? 'var(--danger)' : 'var(--text)' }}>
                                {new Date(event.registration_deadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Mostrar admins del evento */}
                {event.admins && event.admins.length > 0 && (
                    <div style={{ marginTop: 24, padding: 16, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}>👑 Administradores del evento</strong>
                            {isEventAdmin && (
                                <button
                                    className="btn secondary"
                                    onClick={() => setShowAddAdmin(!showAddAdmin)}
                                    style={{ fontSize: '12px', padding: '4px 8px' }}
                                >
                                    {showAddAdmin ? 'Cancelar' : '+ Agregar Admin'}
                                </button>
                            )}
                        </div>

                        {showAddAdmin && (
                            <div style={{ marginBottom: 12, padding: 8, backgroundColor: 'var(--bg-card, var(--glass-bg))', borderRadius: 4 }}>
                                <input
                                    type="email"
                                    placeholder="Email del usuario"
                                    value={newAdminEmail}
                                    onChange={(e) => setNewAdminEmail(e.target.value)}
                                    style={{ marginRight: 8, padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color)', flex: 1 }}
                                />
                                <button className="btn" onClick={addAdmin} style={{ fontSize: '12px', padding: '6px 12px' }}>
                                    Agregar
                                </button>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {event.admins.map(admin => (
                                <div key={admin.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '6px 12px',
                                    backgroundColor: 'var(--bg-card, var(--glass-bg))',
                                    borderRadius: 4,
                                    fontSize: '13px'
                                }}>
                                    <span>{admin.username}</span>
                                    <span className="muted" style={{ fontSize: '11px' }}>({admin.email})</span>
                                    {isEventAdmin && event.admins.length > 1 && admin.id !== currentUser?.id && (
                                        <button
                                            onClick={() => removeAdmin(admin.id)}
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

                {/* Mostrar participantes del evento (solo para admins) */}
                {isEventAdmin && (
                    <EventAccessManager event={event} currentUser={currentUser} />
                )}

                <div style={{ flex: 1 }} />

                {/* ─ Mutual Memories (EventCapsule FOMO integration) ─ */}
                {event && (() => {
                    const eventDate = event.date ? new Date(event.date) : null;
                    const unlockTime = eventDate ? new Date(eventDate.getTime() + 2 * 60 * 60 * 1000) : null;
                    const now = new Date();
                    const isUnlocked = unlockTime && now >= unlockTime;
                    const isPast = eventDate && now >= eventDate;

                    // Pre-event teaser
                    if (!isPast) {
                        return (
                            <div style={{
                                margin: '24px 0', padding: '20px 24px',
                                background: 'rgba(217,70,239,0.06)',
                                border: '1px dashed rgba(217,70,239,0.25)',
                                borderRadius: 18, textAlign: 'center'
                            }}>
                                <p style={{ fontSize: '2rem', margin: '0 0 8px' }}>📸</p>
                                <p style={{ color: '#d946ef', fontWeight: 700, fontSize: '1rem', margin: '0 0 4px' }}>
                                    Mutual Memories — El muro de recuerdos
                                </p>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
                                    Se abre automáticamente 2 horas después del evento. ¡Prepara tu cámara!
                                </p>
                            </div>
                        );
                    }

                    // Post-event: preview or full gallery
                    return <EventCapsule event={event} />;
                })()}

                {/* ─ Organizer Dashboard (admins only) ─ */}
                {isEventAdmin && event && (
                    <div style={{ marginTop: 32 }}>
                        <OrganizerDashboard event={event} />
                    </div>
                )}

            </div>
        </div>
    );
}
