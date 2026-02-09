import React, { useEffect, useState } from 'react';
import EventAccessManager from '../components/EventAccessManager';
import MyEventQR from './MyEventQR';
import { fetchCurrentUser } from '../auth';
import axios from '../api'; // Keep axios for admin functions

export default function EventDetail({ eventId, onBack, onViewGroup }) {
    const [event, setEvent] = useState(null);
    const [registrations, setRegistrations] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [showAddAdmin, setShowAddAdmin] = useState(false);
    const [isEventAdmin, setIsEventAdmin] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});

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
        fetchCurrentUser().then(u => setCurrentUser(u));
    }, []);

    useEffect(() => {
        if (!eventId || !currentUser) return;
        setLoading(true);

        Promise.all([
            axios.get(`events/${eventId}/`),
            axios.get(`registrations/?event=${eventId}&user=${currentUser.id}`)
        ])
            .then(([eventRes, regsRes]) => {
                setEvent(eventRes.data);
                const payload = regsRes.data;
                const items = Array.isArray(payload) ? payload : (payload.results || []);
                setRegistrations(items);

                // Use the backend-provided 'is_admin' flag which correctly includes Group Admins/Creators
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

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ marginTop: 0 }}>{event.name}</h2>
                        <div className="muted">{event.date ? new Date(event.date).toLocaleString() : 'Fecha desconocida'}</div>
                        {event.registration_deadline && (
                            <div style={{ marginTop: 4, color: '#ea580c', fontWeight: 600, fontSize: '0.9em' }}>
                                ⏳ Cierre inscripción: {new Date(event.registration_deadline).toLocaleString()}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {event.group && onViewGroup && (
                            <button
                                className="btn secondary"
                                onClick={() => onViewGroup(event.group)}
                                style={{ fontSize: '14px', padding: '8px 16px' }}
                            >
                                👥 Ver Grupo
                            </button>
                        )}
                        {isEventAdmin && !isEditing && (
                            <>
                                <button className="btn secondary" onClick={startEditing} style={{ fontSize: '14px', padding: '8px 12px' }}>✏️ Editar</button>
                                <button className="btn secondary" onClick={handleDeleteEvent} style={{ fontSize: '14px', padding: '8px 12px', borderColor: 'var(--danger)', color: 'var(--danger)' }}>🗑️ Borrar</button>
                            </>
                        )}
                    </div>
                </div>

                {isEditing && (
                    <form className="card" onSubmit={handleUpdateEvent} style={{ marginBottom: 20, border: '2px solid var(--primary)', backgroundColor: '#f8fafc' }}>
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

                {event.group_name && (
                    <div style={{ marginBottom: 12, padding: 8, backgroundColor: '#f0f9ff', borderRadius: 4, border: '1px solid #bae6fd' }}>
                        <strong>📂 Grupo:</strong> {event.group_name}
                    </div>
                )}
                {event.description && <p>{event.description}</p>}
                <div style={{ marginTop: 10 }}>
                    <strong>Ubicación:</strong> {event.location || 'No especificada'}
                </div>
                <div>
                    <strong>Capacidad:</strong> {event.capacity || 'Ilimitada'}
                </div>
                <div>
                    <strong>Visibilidad:</strong> {event.is_public ? '🌍 Público' : '🔒 Privado (solo miembros del grupo)'}
                </div>
                {event.registration_deadline && (
                    <div style={{ color: new Date() > new Date(event.registration_deadline) ? '#dc2626' : '#d97706', fontWeight: 600 }}>
                        <strong>⏳ Cierre inscripción:</strong> {new Date(event.registration_deadline).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                )}

                {/* Mostrar admins del evento */}
                {event.admins && event.admins.length > 0 && (
                    <div style={{ marginTop: 16, padding: 12, backgroundColor: '#fef3c7', borderRadius: 6, border: '1px solid #fbbf24' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <strong>👑 Administradores del evento:</strong>
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
                            <div style={{ marginBottom: 12, padding: 8, backgroundColor: 'white', borderRadius: 4 }}>
                                <input
                                    type="email"
                                    placeholder="Email del usuario"
                                    value={newAdminEmail}
                                    onChange={(e) => setNewAdminEmail(e.target.value)}
                                    style={{ marginRight: 8, padding: '6px 10px', borderRadius: 4, border: '1px solid #ddd', flex: 1 }}
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
                                    backgroundColor: 'white',
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

            </div>

            {/* Embedded MyEventQR for Registration/RSVP */}
            {event && isValidId(eventId) && (
                <MyEventQR eventId={eventId} embedded={true} isMember={true} onBack={() => { }} />
            )}

        </div >
    );
}
