import React, { useEffect, useState } from 'react';
import axios from '../api';
import { fetchCurrentUser } from '../auth';

export default function MyEventQR({ eventId, onBack, isMember, embedded = false }) {
    const [event, setEvent] = useState(null);
    const [registrations, setRegistrations] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Guest Form State
    const [showGuestForm, setShowGuestForm] = useState(false);
    const [guestData, setGuestData] = useState({
        first_name: '',
        last_name: '',
        alias: '',
        type: 'guest'
    });

    useEffect(() => {
        fetchCurrentUser().then(u => setCurrentUser(u));
    }, []);

    useEffect(() => {
        if (!eventId || !currentUser) return;
        loadData();
    }, [eventId, currentUser]);

    function loadData() {
        setLoading(true);
        // FORCE Filtering by event to prevent duplicates from other events where I am admin
        Promise.all([
            axios.get(`events/${eventId}/`),
            axios.get(`registrations/?event=${eventId}&user=${currentUser.id}`)
        ])
            .then(([eventRes, regsRes]) => {
                setEvent(eventRes.data);
                const items = Array.isArray(regsRes.data) ? regsRes.data : (regsRes.data.results || []);
                setRegistrations(items);
            })
            .catch(err => console.error('Error loading data:', err))
            .finally(() => setLoading(false));
    }

    function handleDelete(regId, isUsed) {
        const msg = isUsed
            ? '¿Eliminar este ticket del historial? Se perderá el registro de asistencia.'
            : '¿Cancelar esta inscripción? El código QR dejará de funcionar.';

        if (!window.confirm(msg)) return;

        axios.delete(`registrations/${regId}/`)
            .then(() => {
                setRegistrations(prev => prev.filter(r => r.id !== regId));
            })
            .catch(err => alert('Error al eliminar: ' + (err.response?.data?.detail || err.message)));
    }

    function handleCreateRegistration(isGuest = false, status = 'confirmed') {
        if (isGuest && (!guestData.first_name || !guestData.last_name)) {
            alert('Nombre y apellido requeridos para invitado.');
            return;
        }

        // NEW LOGIC: Use dedicated endpoint for declining to ensure robustness
        if (status === 'declined' && !isGuest) {
            axios.post(`events/${eventId}/decline_attendance/`)
                .then(res => {
                    alert('Has registrado que NO asistirás.');
                    // CRITICAL FIX: User requested page reload to ensure no ghost state.
                    // This creates a fresh start.
                    window.location.reload();
                })
                .catch(err => {
                    console.error(err);
                    alert('Error: ' + (err.response?.data?.detail || err.message));
                });
            return;
        }

        const payload = {
            event: eventId,
            user: currentUser.id,
            status: status, // Keep original for consistency if needed by other things?
            rsvp_status: status // New explicit field
        };

        if (isGuest) {
            payload.attendee_first_name = guestData.first_name;
            payload.attendee_last_name = guestData.last_name;
            payload.attendee_type = guestData.type;
            if (guestData.alias) payload.alias = guestData.alias;
        }

        // Check limits locally if possible (optional, backend handles it)
        if (status === 'confirmed' && event.max_qr_codes && registrations.filter(r => r.status !== 'declined').length >= event.max_qr_codes) {
            alert(`Límite alcanzado (${event.max_qr_codes}). No puedes generar más QRs.`);
            return;
        }

        axios.post('registrations/', payload)
            .then(res => {
                const msg = status === 'declined' ? 'Has registrado que NO asistirás.' : 'Registro exitoso.';
                alert(msg);

                // CRITICAL FIX: Same logic for standard registration (if updating)
                // If it's a guest (has name), ID matching is fine (or we just append/refresh).
                // If it's me (no name), we replace my old one.
                const isPersonal = !payload.attendee_first_name;

                setRegistrations(prev => {
                    if (isPersonal) {
                        const others = prev.filter(r => r.attendee_first_name);
                        return [...others, res.data];
                    } else {
                        // Guests: just append (or replace by ID if duplicate logic handled elsewhere)
                        // Ideally we should replace by ID if it exists (update scenario)
                        const filtered = prev.filter(r => r.id !== res.data.id);
                        return [...filtered, res.data];
                    }
                });

                setShowGuestForm(false);
                setGuestData({ first_name: '', last_name: '', alias: '', type: 'guest' });
            })
            .catch(err => {
                console.error(err);
                alert('Error: ' + (err.response?.data?.detail || err.message));
            });
    }

    if (loading) return <div className="container"><p>Cargando...</p></div>;
    if (!event) return <div className="container"><p>Evento no encontrado</p></div>;

    const myPersonalReg = registrations.find(r => !r.attendee_first_name);
    const isDeadlinePassed = event.registration_deadline && new Date() > new Date(event.registration_deadline);

    return (
        <div className="container" style={embedded ? { padding: 0 } : {}}>
            {!embedded && <button className="btn secondary" onClick={onBack} style={{ marginBottom: 12 }}>← Volver al Grupo</button>}

            {!embedded && (
                <div className="card">
                    <h2 style={{ marginTop: 0 }}>{event.name}</h2>
                    <div className="muted">{event.date ? new Date(event.date).toLocaleString() : 'Fecha desconocida'}</div>
                    {event.registration_deadline && (
                        <div style={{ marginTop: 4, color: '#ea580c', fontWeight: 600, fontSize: '0.9em' }}>
                            ⏳ Cierre inscripción: {new Date(event.registration_deadline).toLocaleString()}
                        </div>
                    )}
                    <p>Gestiona tus entradas y accesos para este evento.</p>
                </div>
            )}

            {/* RSVP SECTION */}
            <div className="card" style={{ marginTop: 20, marginBottom: 20, textAlign: 'center' }}>
                <h3>¿Asistirás al evento?</h3>

                {!myPersonalReg ? (
                    isDeadlinePassed && !event.is_admin ? (
                        <div style={{ padding: 15, backgroundColor: '#fff7ed', borderRadius: 8, color: '#c2410c', border: '1px solid #fdba74' }}>
                            <strong>⌛ El plazo de inscripción ha finalizado.</strong>
                        </div>
                    ) : (
                        <div>
                            {isDeadlinePassed && event.is_admin && (
                                <div style={{ marginBottom: 10, color: '#f59e0b', fontWeight: 'bold' }}>⚠️ Modo Admin: Plazo finalizado pero tienes acceso.</div>
                            )}
                            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 20 }}>
                                <button
                                    className="btn primary"
                                    style={{ backgroundColor: '#10b981', borderColor: '#059669', fontSize: '1.2em', padding: '12px 24px' }}
                                    onClick={() => handleCreateRegistration(false, 'confirmed')}
                                >
                                    👍 Sí, Asistiré
                                </button>
                                <button
                                    className="btn secondary"
                                    style={{ borderColor: '#ef4444', color: '#dc2626', fontSize: '1.2em', padding: '12px 24px' }}
                                    onClick={() => handleCreateRegistration(false, 'declined')}
                                >
                                    👎 No Asistiré (Final)
                                </button>
                            </div>
                        </div>
                    )
                ) : (
                    <div style={{ marginTop: 20 }}>
                        {myPersonalReg.status === 'declined' ? (
                            <div style={{ padding: 15, backgroundColor: '#fee2e2', borderRadius: 8, color: '#991b1b' }}>
                                <strong>Has indicado que NO asistirás.</strong>
                                <div style={{ marginTop: 10 }}>
                                    <button className="btn small" onClick={() => {
                                        // Delete registration to reset choice
                                        axios.delete(`registrations/${myPersonalReg.id}/`)
                                            .then(() => setRegistrations(prev => prev.filter(r => r.id !== myPersonalReg.id)));
                                    }}>Cambiar respuesta</button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: 15, backgroundColor: '#dcfce7', borderRadius: 8, color: '#166534' }}>
                                <strong>✅ Confirmado: Asistirás al evento.</strong>
                                <div style={{ marginTop: 5, fontSize: '0.9em' }}>Tienes tu entrada generada abajo.</div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* GUEST INVITATIONS */}
            {myPersonalReg && myPersonalReg.status === 'confirmed' && isMember && (
                <div style={{ marginBottom: 20 }}>
                    <button
                        className="btn secondary"
                        onClick={() => setShowGuestForm(!showGuestForm)}
                        style={{ width: '100%', borderColor: '#8b5cf6', color: '#7c3aed', backgroundColor: '#f5f3ff' }}
                    >
                        ➕ Invitar / Generar QR para otro
                    </button>
                </div>
            )}

            {/* GUEST FORM */}
            {showGuestForm && (
                <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #8b5cf6' }}>
                    <h3>Nueva Invitación</h3>
                    <div className="form-row">
                        <label>Nombre *</label>
                        <input type="text" value={guestData.first_name} onChange={e => setGuestData({ ...guestData, first_name: e.target.value })} />
                    </div>
                    <div className="form-row">
                        <label>Apellidos *</label>
                        <input type="text" value={guestData.last_name} onChange={e => setGuestData({ ...guestData, last_name: e.target.value })} />
                    </div>
                    <div className="form-row">
                        <label>Alias / Etiqueta (Ej: Tío Juan)</label>
                        <input type="text" value={guestData.alias} onChange={e => setGuestData({ ...guestData, alias: e.target.value })} />
                    </div>
                    <button className="btn" onClick={() => handleCreateRegistration(true, 'confirmed')}>Generar Invitación</button>
                </div>
            )}

            {/* QR LIST - Only show CONFIRMED registrations */}
            {registrations.filter(r => r.status !== 'declined').length > 0 && (
                <>
                    <h3>Mis Entradas ({registrations.filter(r => r.status !== 'declined').length})</h3>
                    <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                        {registrations.filter(r => r.status !== 'declined').map(reg => (
                            <div key={reg.id} className="card" style={{ position: 'relative', borderTop: reg.attendee_first_name ? '4px solid #8b5cf6' : '4px solid #3b82f6' }}>
                                <div style={{ position: 'absolute', top: 10, right: 10 }}>
                                    <span style={{
                                        padding: '4px 8px', borderRadius: 4, fontSize: '12px', fontWeight: 'bold',
                                        backgroundColor: reg.used ? '#fee2e2' : '#dcfce7',
                                        color: reg.used ? '#dc2626' : '#166534'
                                    }}>
                                        {reg.used ? 'USADO' : 'ACTIVO'}
                                    </span>
                                </div>

                                <h4 style={{ marginTop: 0, marginBottom: 5 }}>
                                    {reg.alias || (reg.attendee_first_name ? `${reg.attendee_first_name} ${reg.attendee_last_name}` : currentUser.username)}
                                </h4>
                                <div className="muted" style={{ fontSize: '13px', marginBottom: 10 }}>
                                    {reg.attendee_first_name ? 'Invitado' : 'Entrada Personal'}
                                </div>

                                {/* QR IMAGE - Check if exists (declined won't have it, but we filtered them out) */}
                                <div style={{ display: 'flex', justifyContent: 'center', margin: '15px 0' }}>
                                    <img
                                        src={reg.qr_url || `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(reg.entry_code)}`}
                                        alt="QR"
                                        style={{ width: 150, height: 150 }}
                                    />
                                </div>

                                <div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '16px', fontWeight: 'bold' }}>
                                    {reg.entry_code}
                                </div>

                                <div style={{ marginTop: 15, display: 'flex', justifyContent: 'center' }}>
                                    <button
                                        className="btn small"
                                        onClick={() => handleDelete(reg.id, reg.used)}
                                        style={{
                                            backgroundColor: 'transparent',
                                            color: '#ef4444',
                                            border: '1px solid #fee2e2',
                                            fontSize: '12px'
                                        }}
                                    >
                                        🗑️ {reg.used ? 'Eliminar del historial' : 'Cancelar / Eliminar'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
