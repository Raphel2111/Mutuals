import React, { useEffect, useState, useCallback } from 'react';
import axios, { apiBase, backendBase } from '../api';
import { fetchCurrentUser } from '../auth';
import PostEventSurvey from '../components/PostEventSurvey';
import '../components/PostEventSurvey.css';

// ─── Dynamic QR Component ───────────────────────────────────────────────────
function DynamicQR({ registrationId, entryCode }) {
    const [qrToken, setQrToken] = useState(null);
    const [countdown, setCountdown] = useState(30);

    const refreshToken = useCallback(async () => {
        try {
            const res = await axios.get(`registrations/${registrationId}/qr_token/`);
            setQrToken(res.data.qr_token);
            setCountdown(res.data.expires_in || 30);
        } catch {
            // Fallback to static entry code if endpoint fails
            setQrToken(entryCode);
        }
    }, [registrationId, entryCode]);

    useEffect(() => {
        refreshToken();
        const tokenInterval = setInterval(refreshToken, 30_000);
        const countInterval = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 30), 1_000);
        return () => { clearInterval(tokenInterval); clearInterval(countInterval); };
    }, [refreshToken]);

    const qrData = qrToken || entryCode;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{
                background: 'var(--bg-card, var(--glass-bg))', borderRadius: 16, padding: 20,
                boxShadow: '0 4px 20px rgba(0,0,0,0.5) inset'
            }}>
                <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`}
                    alt="QR Code dinámico"
                    style={{ width: 200, height: 200, display: 'block', pointerEvents: 'none' }}
                />
            </div>
            <div style={{
                fontSize: '0.72rem', color: countdown < 8 ? 'var(--warning, #f59e0b)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 5
            }}>
                <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: 'var(--success, #22c55e)',
                    boxShadow: '0 0 6px var(--success, #22c55e)', display: 'inline-block'
                }} />
                QR dinámico — se renueva en <strong style={{ color: 'var(--text-main)' }}>{countdown}s</strong>
            </div>
        </div>
    );
}

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

                // Filter out declined registrations (user said "No asistiré")
                const activeItems = items.filter(r => r.status !== 'declined');

                // Sort by event date descending
                activeItems.sort((a, b) => {
                    const dateA = a.event?.date ? new Date(a.event.date) : new Date(0);
                    const dateB = b.event?.date ? new Date(b.event.date) : new Date(0);
                    return dateB - dateA;
                });
                setRegs(activeItems);
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

    async function shareTicket(reg) {
        const shareText = `🎟️ ¡Ya tengo mi entrada para ${reg.event?.name} en MUTUALS!\n📍 ${reg.event?.location || 'Por confirmar'}\n📅 ${reg.event?.date ? new Date(reg.event.date).toLocaleDateString() : 'Avisaremos pronto'}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Entrada para ${reg.event?.name}`,
                    text: shareText,
                    url: window.location.origin // O el magic link directo si lo tuviéramos en el frontend
                });
            } catch (err) {
                console.error('Share failed:', err);
            }
        } else {
            navigator.clipboard.writeText(shareText);
            alert('¡Texto de la entrada copiado al portapapeles!');
        }
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
                            <div key={r.id} className="card glassmorphism" style={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                border: '1px solid rgba(255,255,255,0.05)',
                                padding: '24px',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                {/* Neon Strip */}
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '4px',
                                    background: isGuest ? 'var(--primary)' : 'var(--accent-gradient)'
                                }} />

                                <div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '800', color: 'var(--text)', lineHeight: 1.2 }}>
                                                {r.event && r.event.name ? r.event.name : 'Evento desconocido'}
                                            </h3>
                                            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px', fontWeight: '500' }}>
                                                {r.event && r.event.date ? new Date(r.event.date).toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).toUpperCase() : 'Fecha no disponible'}
                                            </p>
                                        </div>
                                        <div style={{
                                            padding: '4px 10px',
                                            backgroundColor: r.used ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                            color: r.used ? 'var(--danger)' : 'var(--success)',
                                            borderRadius: '8px',
                                            border: `1px solid ${r.used ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {r.used ? 'Usado' : 'Pendiente'}
                                        </div>
                                    </div>

                                    {/* ATTENDEE INFO */}
                                    <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--surface-light)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: '700', letterSpacing: '1px', marginBottom: 2 }}>
                                            {typeLabel}
                                        </div>
                                        <div style={{ fontWeight: 800, fontSize: '18px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {isGuest ? '👱🏼' : '🧑🏽'} {displayName}
                                        </div>
                                    </div>

                                    {/* Dynamic QR */}
                                    <DynamicQR
                                        registrationId={r.id}
                                        entryCode={r.entry_code}
                                    />

                                    <div style={{ background: 'var(--surface-light)', padding: '16px', borderRadius: '12px', marginBottom: '16px', textAlign: 'center' }}>
                                        <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: 'var(--muted)', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>Código de Entrada</p>
                                        <p style={{ margin: 0, fontSize: '24px', fontWeight: '900', fontFamily: 'monospace', color: 'var(--text)', letterSpacing: '3px' }}>{r.entry_code}</p>
                                    </div>
                                    {r.event && r.event.location && (
                                        <div style={{ marginBottom: '12px' }}>
                                            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--muted)', fontWeight: '500' }}>UBICACIÓN</p>
                                            <p style={{ margin: 0, fontSize: '14px' }}>{r.event.location}</p>
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: '12px' }}>
                                    <button onClick={() => shareTicket(r)} className="btn" style={{ background: 'var(--accent-gradient)', color: 'white', border: 'none', boxShadow: 'var(--shadow-glow)', flex: 1 }}>
                                        📲 Compartir / IG
                                    </button>
                                    <button onClick={() => deleteRegistration(r.id)} className="btn secondary" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: '#ef4444', borderStyle: 'solid', borderWidth: '1px', flex: 1 }}>
                                        Cancelar
                                    </button>
                                </div>

                                {/* Post-Event Survey: show for past events only */}
                                {r.event?.date && new Date(r.event.date) < new Date() && (
                                    <div style={{ marginTop: 16 }}>
                                        <PostEventSurvey
                                            event={r.event}
                                            onRate={async (eventId, rating) => {
                                                await axios.post('event-ratings/', { event: eventId, rating });
                                            }}
                                            onShare={(event) => shareTicket(r)}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
