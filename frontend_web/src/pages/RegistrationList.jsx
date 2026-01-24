import React, { useEffect, useState } from 'react';
import axios, { getBackendUrl } from '../api';
import { fetchCurrentUser } from '../auth'; // Import auth to get current user ID

export default function RegistrationList() {
    const [regs, setRegs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        setLoading(true);
        fetchCurrentUser().then(user => {
            setCurrentUser(user);
            // Filter by current user to avoid seeing all tickets if I'm an admin of many events
            const endpoint = user ? `registrations/?user=${user.id}` : 'registrations/';
            return axios.get(endpoint);
        })
            .then(res => {
                const payload = res.data;
                const items = Array.isArray(payload) ? payload : (payload.results || []);

                // Filter to show ONLY confirmed registrations (exclude declined)
                const confirmedItems = items.filter(item => item.status === 'confirmed');

                // Sort by event date descending
                confirmedItems.sort((a, b) => {
                    const dateA = a.event?.date ? new Date(a.event.date) : new Date(0);
                    const dateB = b.event?.date ? new Date(b.event.date) : new Date(0);
                    return dateB - dateA;
                });
                setRegs(confirmedItems);
            })
            .catch(err => console.error('Failed loading registrations', err))
            .finally(() => setLoading(false));
    }, []);

    function deleteRegistration(regId) {
        if (!window.confirm('¿Estás seguro de eliminar esta inscripción? Esta acción no se puede deshacer.')) {
            return;
        }

        axios.delete(`registrations/${regId}/`)
            .then(() => {
                setRegs(prev => prev.filter(r => r.id !== regId));
                alert('Inscripción eliminada correctamente.');
            })
            .catch(err => {
                console.error('Error deleting registration:', err.response?.data || err.message);
                alert('Error al eliminar inscripción: ' + (err.response?.data?.detail || err.message));
            });
    }

    if (loading) {
        return (
            <div className="container">
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                    <p style={{ color: 'var(--muted)' }}>Cargando inscripciones...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700' }}>Mis Inscripciones</h1>
                <p style={{ margin: 0, color: 'var(--muted)' }}>Visualiza y gestiona tus inscripciones a eventos</p>
            </div>

            {regs.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
                    <h3 style={{ margin: '0 0 8px 0', color: 'var(--muted)' }}>No hay inscripciones</h3>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>Aún no te has inscrito a ningún evento. Ve a la sección de eventos para inscribirte.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(350px,1fr))', gap: '20px' }}>
                    {regs.map(r => {
                        // Determine if it's a guest ticket
                        const isGuest = !!r.attendee_first_name;
                        const displayName = r.alias || (isGuest ? `${r.attendee_first_name} ${r.attendee_last_name}` : (currentUser?.username || 'Mi Entrada'));
                        const typeLabel = isGuest ? 'Invitado' : 'Personal';

                        return (
                            <div key={r.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderTop: isGuest ? '4px solid #8b5cf6' : '4px solid #3b82f6' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
                                                {r.event && r.event.name ? r.event.name : 'Evento desconocido'}
                                            </h3>
                                            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>
                                                {r.event && r.event.date ? new Date(r.event.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Fecha no disponible'}
                                            </p>
                                        </div>
                                        <div style={{
                                            padding: '6px 12px',
                                            backgroundColor: r.used ? '#fecaca' : '#dbeafe',
                                            color: r.used ? '#991b1b' : '#0c4a6e',
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {r.used ? '✓ Usado' : '⊙ Pendiente'}
                                        </div>
                                    </div>

                                    {/* ATTENDEE INFO */}
                                    <div style={{ marginBottom: 15, padding: '8px', backgroundColor: isGuest ? '#f5f3ff' : '#eff6ff', borderRadius: 6, border: isGuest ? '1px solid #ddd6fe' : '1px solid #bfdbfe' }}>
                                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: isGuest ? '#6d28d9' : '#1e40af', fontWeight: 'bold' }}>
                                            {typeLabel}
                                        </div>
                                        <div style={{ fontWeight: 600, fontSize: '15px' }}>
                                            {displayName}
                                        </div>
                                    </div>

                                    {/* QR Code */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        padding: '16px',
                                        backgroundColor: '#ffffff',
                                        borderRadius: '8px',
                                        marginBottom: '16px',
                                        border: '2px solid #e2e8f0'
                                    }}>
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(r.entry_code)}`}
                                            alt={`QR Code para ${r.entry_code}`}
                                            style={{ width: '200px', height: '200px', display: 'block' }}
                                        />
                                    </div>

                                    <div style={{ backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                                        <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--muted)', fontWeight: '500' }}>CÓDIGO DE ENTRADA</p>
                                        <p style={{ margin: 0, fontSize: '20px', fontWeight: '700', fontFamily: 'monospace', color: 'var(--primary)', textAlign: 'center', letterSpacing: '2px' }}>{r.entry_code}</p>
                                    </div>
                                    {r.event && r.event.location && (
                                        <div style={{ marginBottom: '12px' }}>
                                            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--muted)', fontWeight: '500' }}>UBICACIÓN</p>
                                            <p style={{ margin: 0, fontSize: '14px' }}>{r.event.location}</p>
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: '12px' }}>
                                    <button onClick={() => deleteRegistration(r.id)} className="btn" style={{ backgroundColor: '#ef4444', borderColor: '#dc2626', flex: 1 }}>
                                        🗑️ Eliminar Inscripción
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
}
