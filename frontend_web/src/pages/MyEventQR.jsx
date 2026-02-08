import React, { useEffect, useState } from 'react';
import axios from '../api';
import { fetchCurrentUser } from '../auth';

export default function MyEventQR({ eventId, onBack, isMember, embedded = false }) {
    const [event, setEvent] = useState(null);
    const [registrations, setRegistrations] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

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

        const payload = {
            event: eventId,
            user: currentUser.id,
            status: status
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

        setCreating(true);
        axios.post('registrations/', payload)
            .then(res => {
                const msg = status === 'declined' ? 'Has registrado que NO asistirás.' : 'Registro exitoso.';
                alert(msg);
                setRegistrations(prev => [...prev, res.data]);
                setShowGuestForm(false);
                setGuestData({ first_name: '', last_name: '', alias: '', type: 'guest' });
            })
            .catch(err => {
                console.error(err);
                alert('Error: ' + (err.response?.data?.detail || err.message));
            })
            .finally(() => setCreating(false));
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
            <div className="card" style={{ marginTop: 20, marginBottom: 20, textAlign: 'center', padding: '30px 20px' }}>
                <h3 style={{ fontSize: '20px', marginBottom: '24px' }}>¿Asistirás al evento?</h3>

                {!myPersonalReg ? (
                    isDeadlinePassed && !event.is_admin ? (
                        <div style={{ padding: 20, backgroundColor: '#fff7ed', borderRadius: 12, color: '#c2410c', border: '1px solid #fdba74' }}>
                            <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
                            <strong>El plazo de inscripción ha finalizado.</strong>
                        </div>
                    ) : (
                        <div>
                            {isDeadlinePassed && event.is_admin && (
                                <div style={{ marginBottom: 16, color: '#f59e0b', fontWeight: 'bold' }}>⚠️ Modo Admin: Plazo finalizado pero tienes acceso.</div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '400px', margin: '0 auto' }}>
                                <button
                                    className="btn btn-lg"
                                    style={{
                                        backgroundColor: '#10b981',
                                        borderColor: '#059669',
                                        color: 'white',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
                                    }}
                                    disabled={creating}
                                    onClick={() => handleCreateRegistration(false, 'confirmed')}
                                >
                                    <span style={{ fontSize: '24px' }}>👍</span>
                                    <span>{creating ? 'Procesando...' : 'Sí, Asistiré'}</span>
                                </button>
                                <button
                                    className="btn btn-lg secondary"
                                    style={{
                                        borderColor: '#ef4444',
                                        color: '#dc2626',
                                        backgroundColor: '#fef2f2',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                        opacity: creating ? 0.6 : 1
                                    }}
                                    disabled={creating}
                                    onClick={() => handleCreateRegistration(false, 'declined')}
                                >
                                    <span style={{ fontSize: '24px' }}>👎</span>
                                    <span>No Asistiré</span>
                                </button>
                            </div>
                        </div>
                    )
                ) : (
                    <div style={{ marginTop: 10 }}>
                        {myPersonalReg.status === 'declined' ? (
                            <div style={{ padding: 24, backgroundColor: '#fef2f2', borderRadius: 16, border: '1px dashed #fca5a5' }}>
                                <div style={{ fontSize: '32px', marginBottom: '12px' }}>👋</div>
                                <h4 style={{ margin: '0 0 8px 0', color: '#991b1b' }}>No asistirás</h4>
                                <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#7f1d1d' }}>
                                    Has indicado que no vendrás a este evento.
                                </p>
                                <button className="btn small secondary" onClick={() => {
                                    axios.delete(`registrations/${myPersonalReg.id}/`)
                                        .then(() => setRegistrations(prev => prev.filter(r => r.id !== myPersonalReg.id)));
                                }}>
                                    Cambiar respuesta
                                </button>
                            </div>
                        ) : (
                            <div style={{ padding: 16, backgroundColor: '#dcfce7', borderRadius: 12, color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '20px' }}>🎉</span>
                                <strong>¡Todo listo! Tienes tu entrada abajo.</strong>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* GUEST INVITATIONS */}
            {myPersonalReg && myPersonalReg.status === 'confirmed' && isMember && (
                <div style={{ marginBottom: 24 }}>
                    <button
                        className="btn secondary btn-lg btn-full"
                        onClick={() => setShowGuestForm(!showGuestForm)}
                        style={{ borderColor: '#8b5cf6', color: '#7c3aed', backgroundColor: '#f5f3ff', fontWeight: '600' }}
                    >
                        {showGuestForm ? 'Cerrar Formulario' : '➕ Invitar a Acompañante'}
                    </button>
                </div>
            )}

            {/* GUEST FORM */}
            {showGuestForm && (
                <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid #8b5cf6', padding: '24px' }}>
                    <h3 style={{ marginTop: 0 }}>Nueva Invitación</h3>
                    <div style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600' }}>Nombre *</label>
                            <input className="search-input" style={{ paddingLeft: '16px' }} type="text" value={guestData.first_name} onChange={e => setGuestData({ ...guestData, first_name: e.target.value })} placeholder="Ej: Pepito" />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600' }}>Apellidos *</label>
                            <input className="search-input" style={{ paddingLeft: '16px' }} type="text" value={guestData.last_name} onChange={e => setGuestData({ ...guestData, last_name: e.target.value })} placeholder="Ej: Grillo" />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600' }}>Alias / Etiqueta</label>
                            <input className="search-input" style={{ paddingLeft: '16px' }} type="text" value={guestData.alias} onChange={e => setGuestData({ ...guestData, alias: e.target.value })} placeholder="Ej: Amigo del Insti" />
                        </div>
                    </div>
                    <button className="btn btn-full" style={{ backgroundColor: '#7c3aed', borderColor: '#6d28d9' }} onClick={() => handleCreateRegistration(true, 'confirmed')}>
                        Generar Invitación
                    </button>
                </div>
            )}

            {/* QR LIST - TICKET STYLE */}
            {registrations.filter(r => r.status !== 'declined').length > 0 && (
                <>
                    <h3 style={{ marginBottom: '16px' }}>Mis Entradas ({registrations.filter(r => r.status !== 'declined').length})</h3>
                    <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                        {registrations.filter(r => r.status !== 'declined').map(reg => (
                            <div key={reg.id} className="ticket-card">
                                <div className="ticket-header">
                                    <h3 style={{ margin: 0, fontSize: '18px' }}>{event.name}</h3>
                                    <span style={{ fontSize: '13px', opacity: 0.9 }}>
                                        {event.date ? new Date(event.date).toLocaleDateString() : ''}
                                    </span>
                                </div>

                                <div className="ticket-cutout left"></div>
                                <div className="ticket-cutout right"></div>

                                <div className="ticket-body">
                                    <span className={`badge ${reg.used ? 'private' : 'confirmed'}`}>
                                        {reg.used ? 'USADO / VALIDADO' : 'ENTRADA ACTIVA'}
                                    </span>

                                    <h2 style={{ margin: '8px 0', fontSize: '22px', color: 'var(--text)' }}>
                                        {reg.alias || (reg.attendee_first_name ? `${reg.attendee_first_name}` : currentUser.username.split('@')[0])}
                                    </h2>
                                    <p className="muted" style={{ margin: 0 }}>
                                        {reg.attendee_first_name ? 'Invitado' : 'Entrada Personal'}
                                    </p>

                                    <div style={{ background: 'white', padding: '10px', borderRadius: '12px', border: '2px solid #f1f5f9' }}>
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(reg.entry_code)}&bgcolor=ffffff`}
                                            alt={`QR Código: ${reg.entry_code}`}
                                            title="Tu código de entrada único"
                                            loading="lazy"
                                            style={{ width: '100%', height: 'auto', maxWidth: 140, display: 'block', margin: '0 auto' }}
                                        />
                                    </div>

                                    <div style={{ textAlign: 'center' }}>
                                        <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>CÓDIGO DE ENTRADA</p>
                                        <code style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text)' }}>{reg.entry_code}</code>
                                    </div>

                                    <div className="ticket-dashed"></div>

                                    <button
                                        className="btn small"
                                        onClick={() => handleDelete(reg.id, reg.used)}
                                        style={{
                                            backgroundColor: 'transparent',
                                            color: '#ef4444',
                                            border: 'none',
                                            textDecoration: 'underline',
                                            fontSize: '13px'
                                        }}
                                    >
                                        ❌ Cancelar Entrada
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
