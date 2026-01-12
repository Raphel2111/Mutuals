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
            <div className="container">
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                    <p style={{ color: 'var(--muted)' }}>Cargando eventos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700' }}>Explora la Terreta 🍊</h1>
                <p style={{ margin: 0, color: 'var(--muted)' }}>
                    Descubre {events.length} {events.length === 1 ? 'plan' : 'planes'} cerca de ti
                </p>
            </div>

            {/* Barra de búsqueda y filtros */}
            <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                    <input
                        type="text"
                        placeholder="🔍 Buscar eventos por nombre, descripción o ubicación..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            fontSize: '14px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            outline: 'none',
                            transition: 'border-color 0.2s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                        onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    {/* Filtro de visibilidad */}
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#64748b' }}>
                            Visibilidad
                        </label>
                        <select
                            value={visibilityFilter}
                            onChange={(e) => setVisibilityFilter(e.target.value)}
                            style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                        >
                            <option value="all">Todos</option>
                            <option value="public">Públicos</option>
                            <option value="private">Privados</option>
                        </select>
                    </div>

                    {/* Filtro de grupo */}
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#64748b' }}>
                            Grupo
                        </label>
                        <select
                            value={selectedGroup}
                            onChange={(e) => setSelectedGroup(e.target.value)}
                            style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                        >
                            <option value="">Todos los grupos</option>
                            {groups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>



                    {/* Ordenamiento */}
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#64748b' }}>
                            Ordenar por
                        </label>
                        <select
                            value={orderBy}
                            onChange={(e) => setOrderBy(e.target.value)}
                            style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                        >
                            <option value="-date">Más recientes</option>
                            <option value="date">Más próximos</option>
                            <option value="name">Nombre (A-Z)</option>
                            <option value="-name">Nombre (Z-A)</option>
                        </select>
                    </div>
                </div>
            </div>

            {events.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
                    <h3 style={{ margin: '0 0 8px 0', color: 'var(--muted)' }}>Sin eventos disponibles</h3>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>Por el momento no hay eventos disponibles. Vuelve más tarde.</p>
                </div>
            ) : (
                <div className="grid">
                    {events.map(ev => (
                        <div className="card event-card" key={ev.id}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>{ev.name}</h3>
                                    <span style={{
                                        fontSize: '11px',
                                        padding: '4px 8px',
                                        borderRadius: '12px',
                                        fontWeight: '600',
                                        backgroundColor: ev.is_public ? '#dbeafe' : '#fee2e2',
                                        color: ev.is_public ? '#1e40af' : '#991b1b'
                                    }}>
                                        {ev.is_public ? '🌍 Público' : '🔒 Privado'}
                                    </span>
                                </div>
                                <p className="muted" style={{ marginBottom: '12px' }}>
                                    📅 {ev.date ? new Date(ev.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Fecha desconocida'}
                                </p>
                                {ev.registration_deadline && (
                                    <p style={{ marginBottom: '12px', fontSize: '13px', color: '#d97706', fontWeight: 500 }}>
                                        🗓️ Cierre inscripción: {new Date(ev.registration_deadline).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}
                                {ev.location && (
                                    <p className="muted" style={{ marginBottom: '12px', fontSize: '14px' }}>
                                        📍 {ev.location}
                                    </p>
                                )}
                                {ev.group_name && (
                                    <p style={{ marginBottom: '12px', fontSize: '14px', color: '#7c3aed', fontWeight: 600 }}>
                                        📂 {ev.group_name}
                                    </p>
                                )}
                                {ev.description && (
                                    <p style={{
                                        marginTop: 0,
                                        marginBottom: '16px',
                                        fontSize: '14px',
                                        lineHeight: '1.5',
                                        color: '#334155'
                                    }}>
                                        {ev.description.substring(0, 120)}
                                        {ev.description.length > 120 ? '...' : ''}
                                    </p>
                                )}
                                {ev.capacity && (
                                    <p className="muted" style={{ fontSize: '12px' }}>
                                        👥 Capacidad: {ev.capacity}
                                    </p>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: '12px' }}>
                                <button className="btn" onClick={() => setSelectedEventId(ev.id)} style={{ flex: 1 }}>
                                    Ver Detalles
                                </button>
                                {isEventAdmin(ev) && (
                                    <button onClick={() => deleteEvent(ev.id, ev.name)} className="btn" style={{ backgroundColor: '#ef4444', borderColor: '#dc2626', padding: '8px 16px' }}>
                                        🗑️
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
