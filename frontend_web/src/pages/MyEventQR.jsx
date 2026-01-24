import React, { useEffect, useState } from 'react';
import axios from '../api';
import { fetchCurrentUser } from '../auth';

export default function MyEventQR({ eventId, onBack }) {
    const [event, setEvent] = useState(null);
    const [myRegistration, setMyRegistration] = useState(null);
    const [hasDeclined, setHasDeclined] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCurrentUser().then(u => setCurrentUser(u));
    }, []);

    useEffect(() => {
        if (!eventId || !currentUser) return;
        loadData();
    }, [eventId, currentUser]);

    function loadData() {
        setLoading(true);

        // Primero cargar evento y registros (siempre funciona)
        Promise.all([
            axios.get(`events/${eventId}/`),
            axios.get(`registrations/?event=${eventId}&user=${currentUser.id}`)
        ])
            .then(([eventRes, regsRes]) => {
                setEvent(eventRes.data);

                const payload = regsRes.data;
                const items = Array.isArray(payload) ? payload : (payload.results || []);
                const confirmedReg = items.find(r => r.status === 'confirmed') || null;
                setMyRegistration(confirmedReg);

                // Intentar cargar estado de decline (puede fallar si deploy no está listo)
                return axios.get(`events/${eventId}/check_decline/`)
                    .then(declineRes => {
                        setHasDeclined(declineRes.data.declined === true);
                    })
                    .catch(err => {
                        console.warn('check_decline not available yet:', err.message);
                        setHasDeclined(false);
                    });
            })
            .catch(err => console.error('Error loading data:', err))
            .finally(() => setLoading(false));
    }


    function confirmAttendance() {
        if (!currentUser) {
            alert('No se pudo obtener el usuario actual');
            return;
        }

        // Si había declinado, primero eliminar el decline
        const confirmPromise = hasDeclined
            ? axios.post(`events/${eventId}/undo_decline/`).then(() => axios.post('registrations/', { event: eventId, user: currentUser.id }))
            : axios.post('registrations/', { event: eventId, user: currentUser.id });

        confirmPromise
            .then(res => {
                setMyRegistration(res.data);
                setHasDeclined(false);
                alert('Tu QR ha sido generado exitosamente.');
            })
            .catch(err => {
                console.error('Error creating registration:', err.response?.data || err.message);
                alert('Error: ' + (err.response?.data?.detail || JSON.stringify(err.response?.data) || err.message));
            });
    }

    function declineAttendance() {
        axios.post(`events/${eventId}/decline/`)
            .then(res => {
                setHasDeclined(true);
                setMyRegistration(null);
                alert('Has indicado que NO asistirás a este evento.');
            })
            .catch(err => {
                console.error('Error declining:', err.response?.data || err.message);
                alert('Error: ' + (err.response?.data?.detail || err.message));
            });
    }

    function undoDecline() {
        if (!window.confirm('¿Cambiar tu respuesta?')) return;

        axios.post(`events/${eventId}/undo_decline/`)
            .then(() => {
                setHasDeclined(false);
                alert('Puedes volver a elegir.');
            })
            .catch(err => {
                console.error('Error:', err);
                alert('Error: ' + (err.response?.data?.detail || err.message));
            });
    }

    function deleteRegistration() {
        if (!myRegistration) return;

        if (!window.confirm('¿Cancelar tu registro? El QR dejará de funcionar.')) return;

        axios.delete(`registrations/${myRegistration.id}/`)
            .then(() => {
                setMyRegistration(null);
                alert('Registro eliminado.');
            })
            .catch(err => {
                console.error('Error deleting registration:', err);
                alert('Error al eliminar: ' + (err.response?.data?.detail || err.message));
            });
    }

    if (loading) return <div className="container"><p>Cargando...</p></div>;
    if (!event) return <div className="container"><p>Evento no encontrado</p></div>;

    return (
        <div className="container">
            <button className="btn secondary" onClick={onBack} style={{ marginBottom: 12 }}>← Volver</button>

            <div className="card">
                <h2 style={{ marginTop: 0 }}>Mi QR para: {event.name}</h2>
                <div className="muted">{event.date ? new Date(event.date).toLocaleString() : 'Fecha desconocida'}</div>
                <div style={{ marginTop: 10 }}>
                    <strong>Ubicación:</strong> {event.location || 'No especificada'}
                </div>
            </div>

            {/* Estado: Ha declinado */}
            {hasDeclined && !myRegistration && (
                <div className="card" style={{ marginTop: 20, textAlign: 'center' }}>
                    <div style={{ padding: 20, backgroundColor: '#fee2e2', borderRadius: 8, color: '#991b1b' }}>
                        <h3 style={{ marginTop: 0 }}>❌ No Asistirás</h3>
                        <p>Has indicado que NO asistirás a este evento.</p>
                        <button
                            className="btn"
                            style={{ marginTop: 15 }}
                            onClick={undoDecline}
                        >
                            Cambiar Respuesta
                        </button>
                    </div>
                </div>
            )}

            {/* Estado: Sin respuesta */}
            {!hasDeclined && !myRegistration && (
                <div className="card" style={{ marginTop: 20, textAlign: 'center' }}>
                    <h3>¿Asistirás al evento?</h3>
                    <p className="muted">Indica tu respuesta para este evento</p>
                    <div style={{ display: 'flex', gap: 15, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
                        <button
                            className="btn primary"
                            style={{ backgroundColor: '#10b981', borderColor: '#059669', fontSize: '1.1em', padding: '12px 24px' }}
                            onClick={confirmAttendance}
                        >
                            👍 Sí, Asistiré
                        </button>
                        <button
                            className="btn secondary"
                            style={{ borderColor: '#ef4444', color: '#dc2626', fontSize: '1.1em', padding: '12px 24px' }}
                            onClick={declineAttendance}
                        >
                            👎 No Asistiré
                        </button>
                    </div>
                </div>
            )}

            {/* Estado: Confirmado con QR */}
            {myRegistration && (
                <div className="card" style={{ marginTop: 20 }}>
                    <h3>Tu código QR personal</h3>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginTop: 12 }}>
                        <div style={{ flex: 1 }}>
                            <div><strong>Código:</strong> <code>{myRegistration.entry_code}</code></div>
                            <div style={{ marginTop: 8 }}>
                                <strong>Estado:</strong> {myRegistration.used ?
                                    <span style={{ color: 'var(--danger)' }}>✓ Usado</span> :
                                    <span style={{ color: 'green' }}>✓ Activo</span>
                                }
                            </div>
                            {myRegistration.used && (
                                <div className="muted" style={{ marginTop: 8 }}>
                                    Este QR ya ha sido escaneado y validado.
                                </div>
                            )}
                        </div>
                        {myRegistration.qr_url && (
                            <div style={{ textAlign: 'center' }}>
                                <img
                                    src={myRegistration.qr_url}
                                    alt="Mi QR"
                                    style={{
                                        width: 200,
                                        height: 200,
                                        border: '2px solid #ddd',
                                        borderRadius: 8,
                                        padding: 10,
                                        background: 'white'
                                    }}
                                />
                                <div style={{ marginTop: 10 }}>
                                    <a
                                        href={myRegistration.qr_url}
                                        download
                                        className="btn secondary"
                                        style={{ fontSize: '0.9em' }}
                                    >
                                        Descargar QR
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                    <div style={{ marginTop: 20, padding: 12, background: '#f3f4f6', borderRadius: 8 }}>
                        <strong>Instrucciones:</strong>
                        <ul style={{ marginTop: 8, marginBottom: 0 }}>
                            <li>Presenta este QR al administrador del evento</li>
                            <li>El admin escaneará tu código para validar tu entrada</li>
                            <li>Una vez escaneado, el QR quedará marcado como usado</li>
                        </ul>
                    </div>
                    <div style={{ marginTop: 15, textAlign: 'center' }}>
                        <button
                            className="btn secondary"
                            style={{ fontSize: '0.9em' }}
                            onClick={deleteRegistration}
                        >
                            Cancelar mi Registro
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
