import React, { useState, useEffect, useRef } from 'react';
import axios from '../api';
import ClubMembershipModal from '../components/ClubMembershipModal';
import { fetchCurrentUser } from '../auth';
import './ClubDetail.css';

const BADGE_OPTIONS = [
    { value: 'member', label: 'Miembro Nuevo', emoji: '👤' },
    { value: 'loyal', label: 'Asistente Fiel', emoji: '⭐' },
    { value: 'founder', label: 'Miembro Fundador', emoji: '🏛️' },
    { value: 'vip', label: 'Socio VIP', emoji: '🏅' },
];

const POST_TYPE_LABELS = {
    announcement: { icon: '📢', label: 'Anuncio' },
    event_recap: { icon: '📸', label: 'Recap' },
    update: { icon: '📝', label: 'Update' },
};

export default function ClubDetail({ clubId, onBack }) {
    const [club, setClub] = useState(null);
    const [members, setMembers] = useState([]);
    const [pending, setPending] = useState([]);
    const [posts, setPosts] = useState([]);
    const [events, setEvents] = useState([]);
    const [wallPosts, setWallPosts] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [tab, setTab] = useState('feed');
    const [invitations, setInvitations] = useState([]);
    const [myToken, setMyToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showJoin, setShowJoin] = useState(false);
    const [actionMsg, setMsg] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            // 1. Fetch main club info first
            const cRes = await axios.get(`clubs/${clubId}/`);
            setClub(cRes.data);

            // 2. Fetch other resources in parallel, but don't let them crash the whole page
            const fetchSecondary = async () => {
                const tryFetch = (url, setter) => axios.get(url).then(r => setter(r.data)).catch(e => console.warn(`Silent fail for ${url}:`, e));

                await Promise.allSettled([
                    tryFetch(`clubs/${clubId}/members/`, setMembers),
                    tryFetch(`clubs/${clubId}/posts/`, setPosts),
                    tryFetch(`clubs/${clubId}/club_events/`, setEvents),
                    tryFetch(`clubs/${clubId}/wall/`, setWallPosts),
                ]);

                if (cRes.data.is_admin) {
                    tryFetch(`clubs/${clubId}/pending/`, setPending);
                    tryFetch(`clubs/${clubId}/invitations/`, setInvitations);
                }

                if (cRes.data.my_membership_status === 'approved' && currentUser) {
                    axios.get(`club-tokens/?club=${clubId}&user=${currentUser.id}`)
                        .then(tRes => {
                            const items = tRes.data.results || tRes.data;
                            if (items.length > 0) setMyToken(items[0]);
                        })
                        .catch(() => { });
                }
            };

            fetchSecondary();
        } catch (e) {
            console.error('Error loading club:', e);
            if (e.response?.status === 404) {
                setError('Club no encontrado.');
            } else {
                setError('Error al cargar la información del club. Inténtalo de nuevo más tarde.');
            }
            setClub(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        fetchCurrentUser().then(u => setCurrentUser(u)).catch(() => { });
    }, [clubId]);

    const flash = (msg) => { setMsg(msg); setTimeout(() => setMsg(''), 3000); };

    const doAction = async (fn) => {
        try { await fn(); await load(); flash('✓ Cambio guardado'); }
        catch (e) { flash(e.response?.data?.detail || 'Error'); }
    };

    const handleApprove = (id) => doAction(() => axios.post(`club-memberships/${id}/approve/`));
    const handleReject = (id) => doAction(() => axios.post(`club-memberships/${id}/reject/`));
    const handleBadge = (id, badge) => doAction(() => axios.patch(`club-memberships/${id}/set_badge/`, { badge }));
    const handleAddAdmin = (id) => doAction(() => axios.post(`club-memberships/${id}/add_admin/`));
    const handleRemoveAdmin = (id) => doAction(() => axios.post(`club-memberships/${id}/remove_admin/`));
    const handleGenerateToken = () => doAction(async () => {
        const res = await axios.post('club-tokens/', { club: clubId, user: currentUser.id });
        setMyToken(res.data);
    });
    const handleKick = (id) => {
        if (!window.confirm('¿Eliminar miembro del club?')) return;
        doAction(() => axios.post(`club-memberships/${id}/kick/`));
    };
    const handleLeave = () => doAction(async () => { await axios.post(`clubs/${clubId}/leave/`); });

    if (loading) return (
        <div className="cd-page">
            <button className="cd-back" onClick={onBack}>← Clubs</button>
            <div className="skeleton-box" style={{ height: 200, borderRadius: 20, marginBottom: 20 }} />
            <div className="skeleton-box" style={{ height: 40, borderRadius: 10, marginBottom: 10 }} />
        </div>
    );
    if (error || !club) return (
        <div className="cd-page">
            <button className="cd-back" onClick={onBack}>← Clubs</button>
            <div className="cl-empty" style={{ paddingTop: '100px' }}>
                <div style={{ fontSize: 48, marginBottom: 20 }}>{error?.includes('encontrado') ? '🔭' : '⚠️'}</div>
                <h3>{error || 'Club no encontrado.'}</h3>
                <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>ID consultado: {clubId}</p>
                <button className="btn primary" onClick={onBack} style={{ marginTop: 24, width: 'auto' }}>Volver al listado</button>
            </div>
        </div>
    );


    const isPaid = parseFloat(club.monthly_price) > 0 || parseFloat(club.annual_price) > 0;
    const canPost = club.is_admin;
    const canSee = club.is_member || club.is_admin;

    // Tabs visible based on role
    const tabs = [
        { key: 'feed', label: '📢 Anuncios', always: true },
        { key: 'comunidad', label: '💬 Comunidad', always: true },
        { key: 'eventos', label: '📅 Eventos', always: true },
        { key: 'miembros', label: `👥 ${members.length}`, always: true },
        ...(club.is_admin && pending.length > 0 ? [{ key: 'solicitudes', label: `⏳ ${pending.length}` }] : []),
        ...(club.is_admin ? [{ key: 'invitaciones', label: '🎟️' }] : []),
        ...(club.is_admin ? [{ key: 'ajustes', label: '⚙️' }] : []),
    ];

    return (
        <div className="cd-page">
            <button className="cd-back" onClick={onBack}>← Clubs</button>

            {/* Hero */}
            <div className="cd-hero" style={{
                background: club.image_url
                    ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.85)), url(${club.image_url}) center/cover`
                    : 'var(--accent-gradient)'
            }}>
                <div className="cd-hero-body">
                    <div className="cd-avatar">
                        {club.image_url ? <img src={club.image_url} alt={club.name} /> : <span>{club.name.slice(0, 2).toUpperCase()}</span>}
                    </div>
                    <div className="cd-hero-info">
                        <div className="cd-badges-row">
                            {club.is_private && <span className="cd-chip">🔒 Privado</span>}
                            {isPaid && <span className="cd-chip cd-chip-paid">💎 {parseFloat(club.monthly_price) > 0 ? `€${parseFloat(club.monthly_price).toFixed(0)}/mes` : `€${parseFloat(club.annual_price).toFixed(0)}/año`}</span>}
                            {club.my_badge && <span className="cd-chip cd-chip-badge">🏅 {club.my_badge.toUpperCase()}</span>}
                        </div>
                        <h1 className="cd-name">{club.name}</h1>
                        <p className="cd-desc">{club.description}</p>
                        <div className="cd-stats">
                            <span>👥 {club.members_count} miembros</span>
                            <span>📅 {events.length} eventos</span>
                            <span>📰 {posts.length} posts</span>
                        </div>
                    </div>
                </div>

                <div className="cd-cta-row">
                    {!club.is_member && club.my_membership_status !== 'pending' && (
                        <button className="cd-btn-join btn-shimmer" onClick={() => setShowJoin(true)}>
                            {isPaid ? `💎 Suscribirse` : (club.is_private ? '🔒 Solicitar acceso' : '+ Unirse gratis')}
                        </button>
                    )}
                    {club.my_membership_status === 'pending' && (
                        <div className="cd-pending-badge">⏳ Solicitud pendiente de aprobación</div>
                    )}
                    {club.is_member && !club.is_admin && (
                        <button className="cd-btn-leave" onClick={handleLeave}>Abandonar club</button>
                    )}
                    {club.is_admin && <span className="cd-chip cd-chip-admin">⚙️ Administrador</span>}
                </div>
            </div>

            {actionMsg && <div className="cd-msg">{actionMsg}</div>}

            {/* Tabs */}
            <div className="cd-tabs">
                {tabs.map(t => (
                    <button key={t.key} className={`cd-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── FEED / NOTICIAS ── */}
            {tab === 'feed' && (
                <div className="cd-feed">
                    {club.my_membership_status === 'approved' && (
                        <div className="cd-membership-card btn-shimmer" style={{ marginBottom: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>¡Hola, socio! 👋</h3>
                                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.8 }}>Tu pase de acceso está listo.</p>
                                </div>
                                {myToken ? (
                                    <div className="cd-mini-qr-wrap" onClick={() => window.open(myToken.qr_url, '_blank')}>
                                        <img src={myToken.qr_url} alt="QR" style={{ width: 50, height: 50, borderRadius: 4, background: 'var(--bg-card, var(--glass-bg))' }} />
                                    </div>
                                ) : (
                                    <button className="cd-btn-approve" onClick={handleGenerateToken} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                                        Generar QR
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Create post (admin only) */}
                    {canPost && <CreatePostBox clubId={clubId} onCreated={load} />}
                    {/* Gate for non-members */}
                    {!canSee && (
                        <div className="cd-gate">
                            <p>🔒 Únete al club para ver las publicaciones de los organizadores.</p>
                            <button className="cd-btn-join btn-shimmer" onClick={() => setShowJoin(true)}>
                                {club.is_private ? 'Solicitar acceso' : 'Unirse gratis'}
                            </button>
                        </div>
                    )}
                    {canSee && posts.length === 0 && (
                        <div className="cd-empty">
                            <p style={{ fontSize: 36, margin: '0 0 10px' }}>📭</p>
                            <p>Aún no hay posts en este club.</p>
                            {canPost && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sé el primero en publicar algo arriba ↑</p>}
                        </div>
                    )}
                    {canSee && posts.map(post => (
                        <ClubPostCard key={post.id} post={post} isAdmin={club.is_admin} onDelete={async () => {
                            await axios.delete(`club-posts/${post.id}/`);
                            load();
                        }} onPin={async () => {
                            await axios.patch(`club-posts/${post.id}/pin/`);
                            load();
                        }} />
                    ))}
                </div>
            )}

            {/* ── COMUNIDAD (CHAT DINÁMICO) ── */}
            {tab === 'comunidad' && (
                <div className="cd-feed">
                    {!canSee && (
                        <div className="cd-gate">
                            <p>🔒 Únete al club para participar en la comunidad.</p>
                            <button className="cd-btn-join btn-shimmer" onClick={() => setShowJoin(true)}>
                                {club.is_private ? 'Solicitar acceso' : 'Unirse gratis'}
                            </button>
                        </div>
                    )}
                    {canSee && (
                        <CommunityChat
                            clubId={clubId}
                            currentUser={currentUser}
                            isAdmin={club.is_admin}
                            members={members}
                            wallPosts={wallPosts}
                            setWallPosts={setWallPosts}
                        />
                    )}
                </div>
            )}

            {/* ── EVENTOS ── */}
            {tab === 'eventos' && (
                <div className="cd-events-list">
                    {canPost && <CreateClubEventBox clubId={clubId} onCreated={load} />}
                    {events.length === 0 && (
                        <div className="cd-empty">
                            <p style={{ fontSize: 36, margin: '0 0 10px' }}>📅</p>
                            <p>No hay eventos planificados para este club aún.</p>
                        </div>
                    )}
                    {events.map(ev => <ClubEventCard key={ev.id} event={ev} />)}
                </div>
            )}

            {/* ── MEMBERS ── */}
            {tab === 'miembros' && (
                <div className="cd-members-grid">
                    {club.is_admin && (
                        <div className="cd-add-member-bar">
                            <AddMemberAction clubId={clubId} onAdded={load} flash={flash} />
                        </div>
                    )}
                    {members.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>Aún no hay miembros aprobados.</p>}
                    {members.map(m => {
                        const isSelf = m.user_id === currentUser?.id;
                        return (
                            <div key={m.id} className="cd-member-card">
                                <div className="cd-member-avatar">
                                    {m.avatar ? <img src={m.avatar} alt={m.username} /> : <span>{(m.full_name || m.username).slice(0, 2).toUpperCase()}</span>}
                                </div>
                                <div className="cd-member-info">
                                    <p className="cd-member-name">
                                        {m.full_name || m.username}
                                        {club.admins.includes(m.user_id) && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--primary)' }}>[ADMIN]</span>}
                                    </p>
                                    <p className="cd-member-meta">@{m.username} · {m.events_attended} eventos</p>
                                </div>

                                <div className="cd-member-actions">
                                    <span className="cd-member-badge">{BADGE_OPTIONS.find(b => b.value === m.badge)?.emoji} {m.badge_display}</span>
                                    {club.is_admin && (
                                        <div className="cd-admin-controls">
                                            <select className="cd-badge-select" value={m.badge} onChange={e => handleBadge(m.id, e.target.value)}>
                                                {BADGE_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.emoji} {b.label}</option>)}
                                            </select>
                                            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                                                {!club.admins.includes(m.user_id) ? (
                                                    <button className="cd-mini-btn" onClick={() => handleAddAdmin(m.id)} title="Hacer Admin">👑</button>
                                                ) : (
                                                    <button className="cd-mini-btn" onClick={() => handleRemoveAdmin(m.id)} title="Quitar Admin">👤</button>
                                                )}
                                                {!isSelf && <button className="cd-mini-btn cd-del" onClick={() => handleKick(m.id)} title="Expulsar">✕</button>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── SOLICITUDES ── */}
            {tab === 'solicitudes' && club.is_admin && (
                <div className="cd-pending-list">
                    {pending.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>No hay solicitudes pendientes.</p>}
                    {pending.map(p => (
                        <div key={p.id} className="cd-pending-card">
                            <div className="cd-pending-header">
                                <div className="cd-member-avatar" style={{ width: 36, height: 36, fontSize: '0.8rem' }}>
                                    <span>{(p.full_name || p.username).slice(0, 2).toUpperCase()}</span>
                                </div>
                                <div>
                                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>{p.full_name || p.username}</p>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{p.username} · {new Date(p.requested_at).toLocaleDateString('es-ES')}</p>
                                </div>
                                <div className="cd-pending-actions">
                                    <button className="cd-btn-approve" onClick={() => handleApprove(p.id)}>✓ Aprobar</button>
                                    <button className="cd-btn-reject" onClick={() => handleReject(p.id)}>✕ Rechazar</button>
                                </div>
                            </div>
                            {p.message && <p className="cd-pending-msg">"{p.message}"</p>}
                        </div>
                    ))}
                </div>
            )}

            {/* ── INVITACIONES ── */}
            {tab === 'invitaciones' && club.is_admin && (
                <div className="cd-invites-panel">
                    <ManageInvitations clubId={clubId} invitations={invitations} onUpdate={load} flash={flash} />
                </div>
            )}

            {/* ── AJUSTES ── */}
            {tab === 'ajustes' && club.is_admin && (
                <ClubSettings club={club} onSave={async (data) => {
                    await axios.patch(`clubs/${clubId}/update_settings/`, data);
                    await load();
                    flash('✓ Ajustes guardados');
                }} />
            )}

            {showJoin && (
                <ClubMembershipModal club={club} onClose={() => setShowJoin(false)}
                    onJoined={() => { load(); setShowJoin(false); }} />
            )}
        </div>
    );
}

// ── Create Post Box ──────────────────────────────────────────────────────────
function CreatePostBox({ clubId, onCreated }) {
    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [type, setType] = useState('announcement');
    const [pinned, setPinned] = useState(false);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const submit = async () => {
        if (!content.trim()) return;
        setLoading(true);
        try {
            await axios.post('club-posts/', {
                club: clubId, content, title, post_type: type, is_pinned: pinned,
            });
            setContent(''); setTitle(''); setType('announcement'); setPinned(false); setExpanded(false);
            onCreated();
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    return (
        <div className="cd-create-post">
            {!expanded ? (
                <div className="cd-create-placeholder" onClick={() => setExpanded(true)}>
                    <span>📢 Escribe un anuncio o actualización para tu comunidad…</span>
                </div>
            ) : (
                <>
                    <div className="cd-post-type-row">
                        {[['announcement', '📢 Anuncio'], ['event_recap', '📸 Recap'], ['update', '📝 Update']].map(([v, l]) => (
                            <button key={v} className={`cd-tag-btn ${type === v ? 'active' : ''}`} onClick={() => setType(v)}>{l}</button>
                        ))}
                    </div>
                    <input className="cd-input" placeholder="Título (opcional)" value={title} onChange={e => setTitle(e.target.value)} style={{ marginBottom: 8 }} />
                    <textarea className="cd-input cd-textarea" placeholder="Escribe tu mensaje para la comunidad…" rows={4} value={content} onChange={e => setContent(e.target.value)} />
                    <div className="cd-post-footer">
                        <label className="cd-pin-toggle">
                            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} /> 📌 Fijar en lo alto
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="cd-btn-cancel" onClick={() => setExpanded(false)}>Cancelar</button>
                            <button className="cd-btn-save btn-shimmer" disabled={loading || !content.trim()} onClick={submit}>
                                {loading ? 'Publicando…' : 'Publicar →'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ── Post Card ────────────────────────────────────────────────────────────────
function ClubPostCard({ post, isAdmin, onDelete, onPin }) {
    const [liked, setLiked] = useState(post.user_liked);
    const [count, setCount] = useState(post.like_count);

    const toggleLike = async () => {
        try {
            const res = await axios.post(`club-posts/${post.id}/like/`);
            setLiked(res.data.liked);
            setCount(res.data.like_count);
        } catch (e) { console.error(e); }
    };

    const meta = POST_TYPE_LABELS[post.post_type] || { icon: '📝', label: 'Post' };
    const timeAgo = (dateStr) => {
        const diff = (Date.now() - new Date(dateStr)) / 1000;
        if (diff < 60) return 'Ahora mismo';
        if (diff < 3600) return `${Math.round(diff / 60)}m`;
        if (diff < 86400) return `${Math.round(diff / 3600)}h`;
        return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    };

    return (
        <div className={`cd-post-card ${post.is_pinned ? 'pinned' : ''}`}>
            {post.is_pinned && <div className="cd-pin-label">📌 Fijado</div>}
            <div className="cd-post-header">
                <div className="cd-member-avatar" style={{ width: 36, height: 36, fontSize: '0.82rem' }}>
                    {post.author_avatar ? <img src={post.author_avatar} alt={post.author_name} /> : <span>{(post.author_name || 'A').slice(0, 2).toUpperCase()}</span>}
                </div>
                <div>
                    <p className="cd-post-author">{post.author_name} <span className="cd-post-type-tag">{meta.icon} {meta.label}</span></p>
                    <p className="cd-post-time">{timeAgo(post.created_at)}</p>
                </div>
                {isAdmin && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        <button className="cd-post-action-btn" onClick={onPin} title="Fijar/Desfijar">📌</button>
                        <button className="cd-post-action-btn cd-post-del" onClick={onDelete} title="Eliminar">✕</button>
                    </div>
                )}
            </div>
            {post.title && <h4 className="cd-post-title">{post.title}</h4>}
            <p className="cd-post-content">{post.content}</p>
            {post.image_url && <img src={post.image_url} alt="post" className="cd-post-img" />}
            <div className="cd-post-footer-row">
                <button className={`cd-like-btn ${liked ? 'liked' : ''}`} onClick={toggleLike}>
                    {liked ? '❤️' : '🤍'} {count}
                </button>
            </div>
        </div>
    );
}

// ── Event Card ───────────────────────────────────────────────────────────────
function ClubEventCard({ event }) {
    const d = new Date(event.date);
    const upcoming = d > new Date();
    const dateStr = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className={`cd-event-card ${upcoming ? '' : 'past'}`}>
            <div className="cd-event-date-block">
                <span className="cd-event-day">{d.getDate()}</span>
                <span className="cd-event-mon">{d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()}</span>
            </div>
            <div className="cd-event-info">
                <p className="cd-event-name">{event.name}</p>
                <p className="cd-event-meta">{timeStr} · {event.location || 'Lugar por confirmar'}</p>
                {event.price > 0
                    ? <span className="cd-event-price-tag">€{parseFloat(event.price).toFixed(0)}</span>
                    : <span className="cd-event-free-tag">Gratis</span>
                }
            </div>
            {upcoming && (
                <span className="cd-event-upcoming">Próximo</span>
            )}
        </div>
    );
}

// ── Club Settings ────────────────────────────────────────────────────────────
function ClubSettings({ club, onSave }) {
    const [f, setF] = useState({
        description: club.description || '',
        is_private: club.is_private,
        monthly_price: club.monthly_price || 0,
        annual_price: club.annual_price || 0,
        membership_benefits: club.membership_benefits || '',
    });
    const [saving, setSaving] = useState(false);
    const [allTags, setAllTags] = useState([]);
    const [selectedTagIds, setSelectedTagIds] = useState(
        new Set((club.tags || []).map(t => typeof t === 'object' ? t.id : t))
    );
    const [tagSearch, setTagSearch] = useState('');
    const [newTagName, setNewTagName] = useState('');
    const [creatingTag, setCreatingTag] = useState(false);

    useEffect(() => {
        axios.get('interest-tags/').then(res => {
            setAllTags(res.data?.results || res.data || []);
        }).catch(() => { });
    }, []);

    const toggleTag = (id) => {
        setSelectedTagIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleCreateTag = async () => {
        const name = newTagName.trim();
        if (!name) return;
        setCreatingTag(true);
        try {
            const res = await axios.post('interest-tags/', { name, category: 'General' });
            const newTag = res.data;
            setAllTags(prev => prev.find(t => t.id === newTag.id) ? prev : [...prev, newTag]);
            setSelectedTagIds(prev => new Set([...prev, newTag.id]));
            setNewTagName('');
        } catch (err) { console.error(err); } finally { setCreatingTag(false); }
    };

    const save = async () => { setSaving(true); try { await onSave({ ...f, tags: [...selectedTagIds] }); } finally { setSaving(false); } };

    const categories = [...new Set(allTags.map(t => t.category).filter(Boolean))];
    const filteredClubTags = allTags.filter(t => !tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase()));
    const noTagResults = tagSearch && filteredClubTags.length === 0;

    return (
        <div className="cd-settings">
            <h3 className="cd-settings-title">⚙️ Configuración del Club</h3>
            <label className="cd-label">Descripción</label>
            <textarea className="cd-input cd-textarea" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} rows={3} />
            <label className="cd-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={f.is_private} onChange={e => setF({ ...f, is_private: e.target.checked })} />
                Club privado
            </label>

            {/* Tags picker */}
            <label className="cd-label" style={{ marginTop: 16 }}>🏷️ Intereses del Club (para Radar)</label>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 10px' }}>
                Selecciona los intereses que representan a este club.
            </p>

            {/* Tag search */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
                <input className="cd-input" type="text" placeholder="🔍 Buscar intereses..."
                    value={tagSearch} onChange={e => setTagSearch(e.target.value)}
                    style={{ paddingRight: 30 }} />
                {tagSearch && (
                    <button onClick={() => setTagSearch('')}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                )}
            </div>

            {allTags.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 8 }}>
                    {(tagSearch ? [{ cat: 'Resultados', tags: filteredClubTags }] : categories.map(cat => ({ cat, tags: allTags.filter(t => t.category === cat) })))
                        .filter(g => g.tags.length > 0)
                        .map(g => (
                            <div key={g.cat}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{g.cat}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {g.tags.map(tag => (
                                        <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                                            style={{
                                                padding: '5px 12px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                                border: selectedTagIds.has(tag.id) ? '1px solid transparent' : '1px solid var(--border-color)',
                                                background: selectedTagIds.has(tag.id) ? 'var(--accent-gradient)' : 'var(--glass-bg)',
                                                color: selectedTagIds.has(tag.id) ? 'white' : 'var(--text-main)',
                                                transition: 'all 0.15s',
                                            }}>
                                            {tag.name} {selectedTagIds.has(tag.id) && '✓'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                </div>
            ) : (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Cargando intereses...</p>
            )}

            {/* No results + Create */}
            {noTagResults && (
                <div style={{ textAlign: 'center', padding: 16, background: 'var(--glass-bg)', border: '1px dashed var(--border-color)', borderRadius: 12, marginBottom: 8 }}>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>No se encontró "<strong style={{ color: 'var(--text-main)' }}>{tagSearch}</strong>"</p>
                    <button onClick={() => { setNewTagName(tagSearch); setTagSearch(''); }}
                        style={{ padding: '6px 16px', background: 'var(--accent-gradient)', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                        ➕ Crear "{tagSearch}"
                    </button>
                </div>
            )}

            {/* Create new tag */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input className="cd-input" type="text" placeholder="✏️ Crear nuevo interés..."
                    value={newTagName} onChange={e => setNewTagName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
                    maxLength={50} style={{ flex: 1 }} />
                <button onClick={handleCreateTag} disabled={creatingTag || !newTagName.trim()}
                    style={{ padding: '8px 16px', background: 'var(--accent-gradient)', color: 'white', border: 'none', borderRadius: 12, fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', opacity: (creatingTag || !newTagName.trim()) ? 0.4 : 1 }}>
                    {creatingTag ? '...' : '➕'}
                </button>
            </div>

            <div className="cd-price-row">
                <div>
                    <label className="cd-label">Cuota mensual (€)</label>
                    <input className="cd-input" type="number" min="0" step="0.50" value={f.monthly_price} onChange={e => setF({ ...f, monthly_price: e.target.value })} />
                </div>
                <div>
                    <label className="cd-label">Cuota anual (€)</label>
                    <input className="cd-input" type="number" min="0" step="1" value={f.annual_price} onChange={e => setF({ ...f, annual_price: e.target.value })} />
                </div>
            </div>
            <label className="cd-label">Beneficios (uno por línea)</label>
            <textarea className="cd-input cd-textarea" value={f.membership_benefits} onChange={e => setF({ ...f, membership_benefits: e.target.value })} rows={4} placeholder="Acceso a eventos privados&#10;Canal exclusivo&#10;Descuentos" />
            <button className="cd-btn-save btn-shimmer" onClick={save} disabled={saving}>{saving ? 'Guardando…' : '💾 Guardar cambios'}</button>
        </div>
    );
}

// ── Create Club Event Box ────────────────────────────────────────────────────
function CreateClubEventBox({ clubId, onCreated }) {
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [f, setF] = useState({ name: '', date: '', location: '', description: '', price: 0 });

    const submit = async () => {
        if (!f.name || !f.date) return alert('Nombre y Fecha son obligatorios.');
        setLoading(true);
        try {
            await axios.post('events/', {
                ...f, club: clubId, capacity: 100, is_public: false,
            });
            setF({ name: '', date: '', location: '', description: '', price: 0 });
            setExpanded(false);
            onCreated();
        } catch (e) {
            alert('Error al crear evento: ' + (e.response?.data?.detail || e.message));
        } finally {
            setLoading(false);
        }
    };

    if (!expanded) {
        return (
            <div className="cd-create-post" style={{ marginBottom: 14 }}>
                <div className="cd-create-placeholder" onClick={() => setExpanded(true)}>
                    <span>📅 Planificar un nuevo evento exclusivo para el club…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="cd-create-post" style={{ marginBottom: 14 }}>
            <h4 style={{ margin: '0 0 12px', color: 'var(--text-main)', fontSize: '0.95rem' }}>📅 Planificar Evento Exclusivo</h4>
            <input className="cd-input" placeholder="Nombre del evento *" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} style={{ marginBottom: 8 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input className="cd-input" type="datetime-local" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
                <input className="cd-input" placeholder="Ubicación" value={f.location} onChange={e => setF({ ...f, location: e.target.value })} />
            </div>
            <textarea className="cd-input cd-textarea" placeholder="Descripción del evento…" rows={3} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} style={{ marginBottom: 8 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <label className="cd-label" style={{ margin: 0 }}>Precio (€):</label>
                <input className="cd-input" type="number" min="0" step="0.5" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} style={{ width: 100 }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>0 = Gratis</span>
            </div>
            <div className="cd-post-footer" style={{ marginTop: 0 }}>
                <span />
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="cd-btn-cancel" onClick={() => setExpanded(false)}>Cancelar</button>
                    <button className="cd-btn-save btn-shimmer" disabled={loading || !f.name || !f.date} onClick={submit}>
                        {loading ? 'Creando…' : 'Crear Evento →'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Community Chat (dynamic, with replies + @mentions) ───────────────────────
function CommunityChat({ clubId, currentUser, isAdmin, members, wallPosts, setWallPosts }) {
    const [content, setContent] = useState('');
    const [replyTo, setReplyTo] = useState(null);   // post object
    const [loading, setLoading] = useState(false);
    const [mentionQuery, setMentionQuery] = useState(null); // string | null
    const [mentionIdx, setMentionIdx] = useState(0);
    const chatEndRef = useRef(null);
    const inputRef = useRef(null);
    const pollingRef = useRef(null);

    // ── Auto-polling every 5s ──
    useEffect(() => {
        pollingRef.current = setInterval(async () => {
            try {
                const lastId = wallPosts.length > 0 ? Math.max(...wallPosts.map(p => p.id)) : 0;
                const res = await axios.get(`clubs/${clubId}/wall/?since=${lastId}`);
                const newPosts = res.data || [];
                if (newPosts.length > 0) {
                    setWallPosts(prev => {
                        const existingIds = new Set(prev.map(p => p.id));
                        const unique = newPosts.filter(p => !existingIds.has(p.id));
                        if (unique.length === 0) return prev;
                        return [...unique, ...prev];
                    });
                }
            } catch (e) { /* silent */ }
        }, 5000);
        return () => clearInterval(pollingRef.current);
    }, [clubId, wallPosts]);

    // ── Auto-scroll when new messages added ──
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [wallPosts.length]);

    // ── Submit message ──
    const submit = async () => {
        if (!content.trim()) return;
        setLoading(true);
        try {
            const payload = { club: clubId, content };
            if (replyTo) payload.reply_to_id = replyTo.id;
            const res = await axios.post('club-wall-posts/', payload);
            setWallPosts(prev => [res.data, ...prev]);
            setContent('');
            setReplyTo(null);
        } catch (e) {
            alert('Error: ' + (e.response?.data?.detail || e.message));
        } finally {
            setLoading(false);
        }
    };

    // ── Delete message ──
    const handleDelete = async (postId) => {
        try {
            await axios.delete(`club-wall-posts/${postId}/`);
            setWallPosts(prev => prev.filter(p => p.id !== postId));
        } catch (e) { console.error(e); }
    };

    // ── @mention handling ──
    const memberList = (members || []).map(m => ({
        id: m.user_id || m.id,
        username: m.username || m.user_name || '',
        name: m.display_name || m.user_name || m.username || '',
    })).filter(m => m.username);

    const mentionCandidates = mentionQuery !== null
        ? memberList.filter(m =>
            m.username.toLowerCase().includes(mentionQuery.toLowerCase()) ||
            m.name.toLowerCase().includes(mentionQuery.toLowerCase())
        ).slice(0, 6)
        : [];

    const handleInput = (e) => {
        const val = e.target.value;
        setContent(val);

        // Detect @mention trigger
        const cursor = e.target.selectionStart;
        const textBefore = val.slice(0, cursor);
        const atMatch = textBefore.match(/@(\w*)$/);
        if (atMatch) {
            setMentionQuery(atMatch[1]);
            setMentionIdx(0);
        } else {
            setMentionQuery(null);
        }
    };

    const insertMention = (username) => {
        const cursor = inputRef.current?.selectionStart || content.length;
        const textBefore = content.slice(0, cursor);
        const textAfter = content.slice(cursor);
        const newBefore = textBefore.replace(/@\w*$/, `@${username} `);
        setContent(newBefore + textAfter);
        setMentionQuery(null);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (mentionQuery !== null && mentionCandidates.length > 0) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, mentionCandidates.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertMention(mentionCandidates[mentionIdx].username);
                return;
            }
            if (e.key === 'Escape') { setMentionQuery(null); return; }
        }
        if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) {
            e.preventDefault();
            submit();
        }
    };

    // ── Render content with @mentions highlighted ──
    const renderContent = (text) => {
        if (!text) return null;
        const parts = text.split(/(@\w+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@')) {
                return <span key={i} className="chat-mention">{part}</span>;
            }
            return part;
        });
    };

    const timeAgo = (dateStr) => {
        const diff = (Date.now() - new Date(dateStr)) / 1000;
        if (diff < 60) return 'Ahora';
        if (diff < 3600) return `${Math.round(diff / 60)}m`;
        if (diff < 86400) return `${Math.round(diff / 3600)}h`;
        return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    };

    // Show messages in chronological order (oldest first)
    const sortedPosts = [...wallPosts].reverse();

    return (
        <div className="chat-container">
            {/* Messages */}
            <div className="chat-messages">
                {sortedPosts.length === 0 && (
                    <div className="cd-empty">
                        <p style={{ fontSize: 36, margin: '0 0 10px' }}>💬</p>
                        <p>Aún no hay mensajes en la comunidad.</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sé el primero en saludar ↓</p>
                    </div>
                )}
                {sortedPosts.map(post => {
                    const isOwn = post.author_id === currentUser?.id;
                    const canDelete = isOwn || isAdmin;
                    return (
                        <div key={post.id} className={`chat-message ${isOwn ? 'own' : ''}`}>
                            <div className="chat-msg-avatar">
                                {post.author_avatar
                                    ? <img src={post.author_avatar} alt={post.author_name} />
                                    : <span>{(post.author_name || 'A').slice(0, 2).toUpperCase()}</span>}
                            </div>
                            <div className="chat-msg-body">
                                <div className="chat-msg-header">
                                    <span className="chat-msg-author">{post.author_name}</span>
                                    <span className="chat-msg-time">{timeAgo(post.created_at)}</span>
                                </div>
                                {/* Reply preview */}
                                {post.reply_preview && (
                                    <div className="chat-reply-preview">
                                        <span className="chat-reply-bar" />
                                        <div>
                                            <span className="chat-reply-author">{post.reply_preview.author_name}</span>
                                            <span className="chat-reply-text">{post.reply_preview.content}</span>
                                        </div>
                                    </div>
                                )}
                                <p className="chat-msg-content">{renderContent(post.content)}</p>
                                <div className="chat-msg-actions">
                                    <ChatLikeBtn post={post} />
                                    <button className="chat-action-btn" onClick={() => { setReplyTo(post); inputRef.current?.focus(); }}>
                                        ↩️ Responder
                                    </button>
                                    {canDelete && (
                                        <button className="chat-action-btn chat-del-btn" onClick={() => handleDelete(post.id)}>
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={chatEndRef} />
            </div>

            {/* Reply banner */}
            {replyTo && (
                <div className="chat-reply-banner">
                    <div className="chat-reply-banner-content">
                        <span>↩️ Respondiendo a <strong>{replyTo.author_name}</strong></span>
                        <span className="chat-reply-banner-text">"{(replyTo.content || '').slice(0, 50)}{(replyTo.content || '').length > 50 ? '…' : ''}"</span>
                    </div>
                    <button className="chat-reply-banner-close" onClick={() => setReplyTo(null)}>✕</button>
                </div>
            )}

            {/* Compose area */}
            <div className="chat-compose">
                {/* @mention dropdown */}
                {mentionQuery !== null && mentionCandidates.length > 0 && (
                    <div className="chat-mention-dropdown">
                        {mentionCandidates.map((m, i) => (
                            <div key={m.id}
                                className={`chat-mention-item ${i === mentionIdx ? 'active' : ''}`}
                                onMouseDown={(e) => { e.preventDefault(); insertMention(m.username); }}>
                                <span className="chat-mention-name">@{m.username}</span>
                                {m.name !== m.username && <span className="chat-mention-full">{m.name}</span>}
                            </div>
                        ))}
                    </div>
                )}
                <textarea
                    ref={inputRef}
                    className="chat-input"
                    placeholder="Escribe un mensaje... (@ para mencionar)"
                    value={content}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    rows={1}
                />
                <button className="chat-send-btn" onClick={submit} disabled={loading || !content.trim()}>
                    {loading ? '…' : '➤'}
                </button>
            </div>
        </div>
    );
}

// ── Like button sub-component ────────────────────────────────────────────────
function ChatLikeBtn({ post }) {
    const [liked, setLiked] = useState(post.user_liked);
    const [count, setCount] = useState(post.like_count);
    const toggle = async () => {
        try {
            const res = await axios.post(`club-wall-posts/${post.id}/like/`);
            setLiked(res.data.liked);
            setCount(res.data.like_count);
        } catch (e) { console.error(e); }
    };
    return (
        <button className={`chat-action-btn ${liked ? 'liked' : ''}`} onClick={toggle}>
            {liked ? '❤️' : '🤍'} {count > 0 ? count : ''}
        </button>
    );
}

// ── Manage Invitations ───────────────────────────────────────────────────────
function ManageInvitations({ clubId, invitations, onUpdate, flash }) {
    const [loading, setLoading] = useState(false);
    const [days, setDays] = useState(7);
    const [maxUses, setMaxUses] = useState('');

    const createInvite = async () => {
        setLoading(true);
        try {
            await axios.post(`clubs/${clubId}/create_invitation/`, {
                expires_in_days: days,
                max_uses: maxUses ? parseInt(maxUses) : null
            });
            onUpdate();
            flash('✓ Invitación creada');
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const copyToClipboard = (url) => {
        navigator.clipboard.writeText(url);
        flash('📋 Copiado al portapapeles');
    };

    return (
        <div className="cd-invites">
            <h3 className="cd-settings-title">🎟️ Gestión de Invitaciones</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                Crea enlaces únicos para que otros se unan al club saltándose la aprobación manual.
            </p>

            <div className="cd-create-invite-box" style={{ background: 'var(--glass-bg)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Días de validez</label>
                        <input className="cd-input" type="number" value={days} onChange={e => setDays(e.target.value)} min="1" max="365" />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Usos máx.</label>
                        <input className="cd-input" type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="∞ ilimitado" />
                    </div>
                </div>
                <button className="cd-btn-save btn-shimmer" style={{ width: '100%' }} onClick={createInvite} disabled={loading}>
                    {loading ? 'Generando...' : '➕ Generar enlace de invitación'}
                </button>
            </div>

            <div className="cd-invites-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {invitations.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>No hay enlaces activos.</p>}
                {invitations.map(inv => (
                    <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--glass-bg)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                        <div className="cd-invite-info">
                            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Token: {inv.token.slice(0, 6)}...{inv.token.slice(-4)}</p>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {inv.use_count} usos {inv.max_uses ? `/ ${inv.max_uses}` : ''} · Expira {new Date(inv.expires_at).toLocaleDateString()}
                            </p>
                        </div>
                        <button className="cd-mini-btn" onClick={() => copyToClipboard(inv.url)} title="Copiar Link" style={{ fontSize: '1rem', padding: 8 }}>📋</button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Add Member Component ─────────────────────────────────────────────────────
function AddMemberAction({ clubId, onAdded, flash }) {
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!username.trim()) return;
        setLoading(true);
        try {
            await axios.post(`clubs/${clubId}/add_member/`, { username: username.trim() });
            setUsername('');
            onAdded();
            flash(`✓ ${username} añadido al club`);
        } catch (e) {
            flash(`❌ Error: ${e.response?.data?.detail || 'No se pudo añadir'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleAdd} className="cd-add-member-form" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input
                className="cd-input"
                placeholder="Añadir miembro por username..."
                value={username}
                onChange={e => setUsername(e.target.value)}
                style={{ flex: 1, padding: '0 12px', background: 'var(--glass-bg)', borderRadius: 8, border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.9rem' }}
            />
            <button className="cd-btn-save" type="submit" disabled={loading} style={{ width: 'auto', padding: '0 20px', fontSize: '0.85rem' }}>
                {loading ? '...' : 'Añadir'}
            </button>
        </form>
    );
}
