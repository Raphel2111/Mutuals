import React, { useEffect, useState } from 'react';
import axios from '../api';
import EventDetail from './EventDetail';
import GroupDetail from './GroupDetail';
import { fetchCurrentUser } from '../auth';

export default function EventList() {
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState(null);
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);

    // Filtros
    const [searchText, setSearchText] = useState('');
    const [visibilityFilter, setVisibilityFilter] = useState('all'); // 'all', 'public', 'private'
    const [isFreeFilter, setIsFreeFilter] = useState(false);
    const [orderBy, setOrderBy] = useState('-date'); // '-date', 'date', 'name', '-name'
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState('');

    useEffect(() => {
        fetchCurrentUser().then(u => setCurrentUser(u));
        // Cargar grupos disponibles para el filtro
        axios.get('groups/')
            .then(res => {
                const payload = res.data;
                const items = Array.isArray(payload) ? payload : (payload.results || []);
                setGroups(items);
            })
            .catch(err => console.error('Error loading groups:', err));
    }, []);

    useEffect(() => {
        loadEvents();
    }, [searchText, visibilityFilter, isFreeFilter, orderBy, selectedGroup]);

    function loadEvents() {
        setLoading(true);
        const params = {};
        if (searchText) params.search = searchText;
        if (visibilityFilter !== 'all') params.visibility = visibilityFilter;
        if (isFreeFilter) params.is_free = 'true';
        if (orderBy) params.order_by = orderBy;
        if (selectedGroup) params.group = selectedGroup;

        axios.get('events/', { params })
            .then(res => {
                const payload = res.data;
                const items = Array.isArray(payload) ? payload : (payload.results || []);
                setEvents(items);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }

    function deleteEvent(eventId, eventName) {
        if (!window.confirm(`¿Estás seguro de eliminar el evento "${eventName}"? Esta acción no se puede deshacer y eliminará todas las inscripciones asociadas.`)) {
            return;
        }

        axios.delete(`events/${eventId}/`)
            .then(() => {
                setEvents(prev => prev.filter(e => e.id !== eventId));
                alert('Evento eliminado correctamente.');
            })
            .catch(err => {
                console.error('Error deleting event:', err.response?.data || err.message);
                alert('Error al eliminar evento: ' + (err.response?.data?.detail || err.message));
            });
    }

    function isEventAdmin(event) {
        if (!currentUser) return false;
        if (currentUser.is_staff) return true;
        return event.admins && event.admins.some(admin => admin.id === currentUser.id);
    }

    if (selectedGroupId) {
        return <GroupDetail groupId={selectedGroupId} onBack={() => setSelectedGroupId(null)} />;
    }

    if (selectedEventId) {
        return <EventDetail
            eventId={selectedEventId}
            onBack={() => setSelectedEventId(null)}
            onViewGroup={(groupId) => {
                setSelectedEventId(null);
                setSelectedGroupId(groupId);
            }}
        />;
    }

    if (loading) {
        return (
            <div className="container" style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ marginBottom: '20px' }}>
                    <div className="skeleton" style={{ height: '40px', marginBottom: '20px', borderRadius: '12px' }}></div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div className="skeleton" style={{ height: '36px', width: '100px', borderRadius: '10px' }}></div>
                        <div className="skeleton" style={{ height: '36px', width: '100px', borderRadius: '10px' }}></div>
                        <div className="skeleton" style={{ height: '36px', width: '100px', borderRadius: '10px' }}></div>
                    </div>
                </div>
                {[1, 2, 3].map(i => (
                    <div className="card" key={i} style={{ marginBottom: '16px', padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div className="skeleton" style={{ height: '24px', width: '60%' }}></div>
                            <div className="skeleton" style={{ height: '24px', width: '20%' }}></div>
                        </div>
                        <div className="skeleton" style={{ height: '16px', width: '40%', marginBottom: '8px' }}></div>
                        <div className="skeleton" style={{ height: '16px', width: '100%', marginBottom: '8px' }}></div>
                        <div className="skeleton" style={{ height: '16px', width: '80%' }}></div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="container" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '80px' }}>
            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text)', marginBottom: '4px', letterSpacing: '-0.5px' }}>
                    Explora la Terreta 🍊
                </h1>
                <p style={{ color: 'var(--muted)', fontSize: '15px' }}>
                    {events.length} {events.length === 1 ? 'plan disponible' : 'planes disponibles'}
                </p>
            </div>

            {/* Search & Filters */}
            <div style={{ marginBottom: '24px' }}>
                <div className="search-container">
                    <span className="search-icon">🔍</span>
                    <input
                        className="search-input"
                        type="text"
                        placeholder="Buscar eventos..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                    />
                </div>

                <div className="filter-group">
                    <select
                        className="filter-select"
                        value={visibilityFilter}
                        onChange={(e) => setVisibilityFilter(e.target.value)}
                    >
                        <option value="all">👁️ Todos</option>
                        <option value="public">🌍 Públicos</option>
                        <option value="private">🔒 Privados</option>
                    </select>

                    <select
                        className="filter-select"
                        value={selectedGroup}
                        onChange={(e) => setSelectedGroup(e.target.value)}
                    >
                        <option value="">📂 Todos los grupos</option>
                        {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>

                    <select
                        className="filter-select"
                        value={orderBy}
                        onChange={(e) => setOrderBy(e.target.value)}
                    >
                        <option value="-date">📅 Más recientes</option>
                        <option value="date">⏳ Próximos</option>
                        <option value="name">🔤 Nombre (A-Z)</option>
                    </select>
                </div>
            </div>

            {events.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: 'var(--surface)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🪁</div>
                    <h3 style={{ margin: '0 0 8px 0', color: 'var(--text)', fontWeight: '700' }}>No hay planes por aquí</h3>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '15px', lineHeight: '1.5' }}>
                        No hemos encontrado eventos con estos filtros.<br />Prueba a buscar otra cosa.
                    </p>
                    <button
                        className="btn small secondary"
                        style={{ marginTop: '20px' }}
                        onClick={() => { setSearchText(''); setVisibilityFilter('all'); setSelectedGroup(''); }}
                    >
                        Limpiar filtros
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {events.map(ev => (
                        <div className="card event-card" key={ev.id} onClick={() => setSelectedEventId(ev.id)} style={{ cursor: 'pointer', transition: 'transform 0.2s', padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'var(--text)', lineHeight: '1.3' }}>{ev.name}</h3>
                                <span className={`badge ${ev.is_public ? 'public' : 'private'}`}>
                                    {ev.is_public ? 'Público' : 'Privado'}
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted)', fontSize: '14px' }}>
                                    <span>📅</span>
                                    <span style={{ fontWeight: '500' }}>
                                        {ev.date ? new Date(ev.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long' }) : 'Fecha por determinar'}
                                    </span>
                                    <span>•</span>
                                    <span>
                                        {ev.date ? new Date(ev.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </span>
                                </div>

                                {ev.location && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted)', fontSize: '14px' }}>
                                        <span>📍</span>
                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.location}</span>
                                    </div>
                                )}
                            </div>

                            {ev.description && (
                                <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 16px 0', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {ev.description}
                                </p>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {ev.group_name && (
                                        <span style={{ fontSize: '12px', color: '#7c3aed', background: '#f5f3ff', padding: '4px 8px', borderRadius: '6px', fontWeight: '600' }}>
                                            {ev.group_name}
                                        </span>
                                    )}
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    Ver info <span>→</span>
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
