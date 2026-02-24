import React, { useState, useEffect } from 'react';
import axios from '../api';
import './OrganizerDashboard.css';

// Simple CSS Gauge ring — no external lib needed
function NpsGauge({ love, neutral, sad }) {
    const total = love + neutral + sad || 1;
    const lovePct = Math.round((love / total) * 100);
    const loveEnd = (love / total) * 360;
    const neutralEnd = loveEnd + (neutral / total) * 360;
    return (
        <div className="gauge-wrap">
            <div className="gauge-ring" style={{ background: `conic-gradient(#22c55e 0deg ${loveEnd}deg, #f59e0b ${loveEnd}deg ${neutralEnd}deg, #ef4444 ${neutralEnd}deg 360deg)` }}>
                <div className="gauge-inner">
                    <span className="gauge-pct">{lovePct}%</span>
                    <span className="gauge-label">😍 Fans</span>
                </div>
            </div>
            <div className="gauge-legend">
                <span className="legend-dot" style={{ background: '#22c55e' }} />😍 {love}
                <span className="legend-dot" style={{ background: '#f59e0b' }} />😐 {neutral}
                <span className="legend-dot" style={{ background: '#ef4444' }} />😞 {sad}
            </div>
        </div>
    );
}

// ── Monetization tab ────────────────────────────────────────────────────────
function MonetizationTab({ event }) {
    const [connectStatus, setConnectStatus] = useState(null);
    const [onboarding, setOnboarding] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        axios.get('stripe/connect/status/')
            .then(res => setConnectStatus(res.data))
            .catch(() => { });
    }, []);

    const handleOnboard = async (clubId) => {
        setOnboarding(true); setError('');
        try {
            const res = await axios.post('stripe/connect/onboard/', { club_id: clubId });
            if (res.data.url) window.open(res.data.url, '_blank');
        } catch (err) {
            setError(err.response?.data?.error || 'Error al conectar con Stripe.');
        } finally {
            setOnboarding(false);
        }
    };

    const ticketRevenue = event?.price ? parseFloat(event.price) * (event.registration_count || 0) : 0;
    const platformFee = ticketRevenue * (parseFloat(event?.platform_fee_percentage || 5) / 100);
    const netRevenue = ticketRevenue - platformFee;
    const statusColor = { active: '#22c55e', pending: '#f59e0b', restricted: '#ef4444' };

    return (
        <div className="org-dash-grid">
            {/* Revenue Summary */}
            <div className="org-card">
                <h3 className="org-card-title">💶 Ingresos del Evento</h3>
                <p className="org-card-sub">Basado en {event?.registration_count || 0} entradas vendidas</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                    {[
                        { label: 'Bruto', value: `€${ticketRevenue.toFixed(2)}` },
                        { label: `Comisión MUTUALS (${event?.platform_fee_percentage || 5}%)`, value: `-€${platformFee.toFixed(2)}`, color: '#f87171' },
                        { label: '💰 Neto estimado', value: `€${netRevenue.toFixed(2)}`, color: '#86efac', big: true },
                    ].map(row => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.83rem', color: '#64748b' }}>{row.label}</span>
                            <span style={{ fontWeight: row.big ? 800 : 600, fontSize: row.big ? '1.1rem' : '0.9rem', color: row.color || '#e2e8f0' }}>{row.value}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Stripe Connect Status */}
            <div className="org-card">
                <h3 className="org-card-title">⚡ Stripe Connect</h3>
                <p className="org-card-sub">Recibe pagos directo en tu cuenta bancaria</p>

                {connectStatus?.length > 0 ? (
                    connectStatus.map(acct => (
                        <div key={acct.club_id} style={{ marginTop: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor[acct.status] || '#64748b', display: 'inline-block' }} />
                                <span style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>{acct.club_name}</span>
                                <span style={{ fontSize: '0.72rem', color: statusColor[acct.status] || '#94a3b8', marginLeft: 'auto' }}>
                                    {acct.status === 'active' ? '✅ Activo' : '⏳ Pendiente'}
                                </span>
                            </div>
                            {acct.status !== 'active' && (
                                <button className="org-btn-stripe btn-shimmer" onClick={() => handleOnboard(acct.club_id)} disabled={onboarding}>
                                    {onboarding ? 'Redirigiendo…' : 'Completar verificación →'}
                                </button>
                            )}
                        </div>
                    ))
                ) : (
                    <div style={{ marginTop: 14 }}>
                        <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 12 }}>
                            Conecta tu cuenta de Stripe para recibir los ingresos de tickets directamente.
                        </p>
                        {event?.club_id ? (
                            <button className="org-btn-stripe btn-shimmer" onClick={() => handleOnboard(event.club_id)} disabled={onboarding}>
                                {onboarding ? 'Conectando…' : '🔗 Conectar con Stripe →'}
                            </button>
                        ) : (
                            <p style={{ fontSize: '0.78rem', color: '#475569' }}>Asocia este evento a un Club para activar Stripe Connect.</p>
                        )}
                    </div>
                )}

                {error && <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: 8 }}>{error}</p>}

                <div style={{ marginTop: 16, padding: '10px 12px', background: 'rgba(34,197,94,0.07)', borderRadius: 10, border: '1px solid rgba(34,197,94,0.15)' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#86efac' }}>
                        💡 Los pagos se depositan en tu cuenta en 2–5 días laborables tras el evento.
                    </p>
                </div>
            </div>

            {/* Membership Revenue Estimator */}
            <div className="org-card org-card-full">
                <h3 className="org-card-title">🔑 Membresías de Club de Pago</h3>
                <p className="org-card-sub">Configura cuotas mensuales/anuales para tus clubs</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                    {['Mensual', 'Anual'].map(plan => (
                        <div key={plan} style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                            <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '0.85rem', color: '#d8b4fe' }}>{plan}</p>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                                Establece el precio desde el{' '}
                                <a href="/admin/events/club/" target="_blank" rel="noreferrer" style={{ color: '#c084fc' }}>Django Admin</a>
                                {' '}→ Club → monthly_price / annual_price
                            </p>
                        </div>
                    ))}
                </div>
                <p style={{ margin: '14px 0 0', fontSize: '0.78rem', color: '#475569' }}>
                    📬 Cuando un usuario paga su membresía recibirás el dinero automáticamente en tu cuenta Stripe Connect.
                    El badge de los miembros de pago se eleva a <span style={{ color: '#d8b4fe' }}>🏅 Socio VIP</span>.
                </p>
            </div>
        </div>
    );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function OrganizerDashboard({ event }) {
    const [tab, setTab] = useState('analytics');
    const [stats, setStats] = useState(null);
    const [connections, setConnections] = useState(0);
    const [photos, setPhotos] = useState([]);
    const [loadingStats, setLoadingStats] = useState(true);

    useEffect(() => {
        if (!event?.id) return;
        Promise.all([
            axios.get(`event-ratings/stats/?event=${event.id}`),
            axios.get(`connections/?event=${event.id}&status=confirmed`),
            axios.get(`event-photos/?event=${event.id}&include_hidden=true`),
        ]).then(([ratingRes, connRes, photoRes]) => {
            setStats(ratingRes.data);
            const connList = connRes.data.results || connRes.data;
            setConnections(Array.isArray(connList) ? connList.length : 0);
            const photoList = photoRes.data.results || photoRes.data;
            setPhotos(Array.isArray(photoList) ? photoList : []);
        }).catch(console.error).finally(() => setLoadingStats(false));
    }, [event?.id]);

    const toggleHide = async (photoId) => {
        try {
            const res = await axios.post(`event-photos/${photoId}/hide/`);
            setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, is_hidden: res.data.is_hidden } : p));
        } catch (err) { console.error(err); }
    };

    if (!event?.id) return null;

    return (
        <div className="org-dash">
            <h2 className="org-dash-title">Dashboard del Organizador</h2>
            <p className="org-dash-event">{event.name}</p>

            {/* Tab bar */}
            <div className="org-tabs">
                {[
                    { key: 'analytics', label: '📊 Analytics' },
                    { key: 'monetization', label: '💰 Monetización' },
                ].map(t => (
                    <button key={t.key} className={`org-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'monetization' && <MonetizationTab event={event} />}

            {tab === 'analytics' && (
                loadingStats
                    ? <div className="org-dash-skeleton" />
                    : (
                        <div className="org-dash-grid">
                            <div className="org-card">
                                <h3 className="org-card-title">🎯 NPS Emocional</h3>
                                <p className="org-card-sub">Basado en {stats?.total || 0} encuestas</p>
                                {stats?.total > 0
                                    ? <NpsGauge love={stats.breakdown.love} neutral={stats.breakdown.neutral} sad={stats.breakdown.sad} />
                                    : <p className="org-empty">Sin encuestas aún.</p>}
                            </div>

                            <div className="org-card">
                                <h3 className="org-card-title">🤝 Conexiones Reales</h3>
                                <p className="org-card-sub">Doble opt-in confirmado</p>
                                <div className="org-connections-counter">
                                    <span className="org-counter-num">{connections}</span>
                                    <span className="org-counter-label">personas conectadas<br />gracias a tu evento</span>
                                </div>
                                <p className="org-card-insight">
                                    {connections > 10
                                        ? '🔥 Excelente networking — tu evento supera la media.'
                                        : connections > 0
                                            ? '✨ ¡Ya hay conexiones reales!'
                                            : '📡 Anima a los asistentes a activar el Radar Social.'}
                                </p>
                            </div>

                            <div className="org-card org-card-full">
                                <h3 className="org-card-title">📸 Moderación de Fotos</h3>
                                <p className="org-card-sub">{photos.length} fotos en el Muro</p>
                                {photos.length === 0 ? (
                                    <p className="org-empty">Sin fotos subidas aún.</p>
                                ) : (
                                    <div className="mod-grid">
                                        {photos.map(photo => (
                                            <div key={photo.id} className={`mod-photo ${photo.is_hidden ? 'hidden' : ''}`}>
                                                <img src={photo.image_url || photo.image} alt={photo.caption || ''} className="mod-photo-img" />
                                                <div className="mod-photo-overlay">
                                                    <div className="mod-photo-meta">
                                                        <span className="mod-author">{photo.user?.username}</span>
                                                        <span className="mod-likes">❤️ {photo.likes_count} 🔥 {photo.fire_likes_count}</span>
                                                    </div>
                                                    <button className={`mod-btn ${photo.is_hidden ? 'mod-btn-show' : 'mod-btn-hide'}`} onClick={() => toggleHide(photo.id)}>
                                                        {photo.is_hidden ? '👁 Mostrar' : '🚫 Ocultar'}
                                                    </button>
                                                </div>
                                                {photo.is_hidden && <div className="mod-hidden-badge">OCULTA</div>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
            )}
        </div>
    );
}
