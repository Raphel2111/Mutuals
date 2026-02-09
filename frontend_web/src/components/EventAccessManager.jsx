import React, { useState, useEffect } from 'react';
import axios, { getBackendUrl } from '../api';
import QRScanner from './QRScanner';

export default function EventAccessManager({ event, currentUser }) {
    const [activeTab, setActiveTab] = useState('list'); // 'list', 'manual', 'attended', 'scan'
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(false);

    // Manual Creation State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [ticketAlias, setTicketAlias] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        loadRegistrations();
    }, [event.id]);

    const loadRegistrations = () => {
        setLoading(true);
        axios.get(`events/${event.id}/participants/`)
            .then(res => {
                // The endpoint returns Users, but we need Registrations to see QRCode, alias, attended_at.
                // Wait, the 'participants' endpoint returns Users.
                // We need the raw registrations list for this management view.
                // Let's use the export_registrations logic but as JSON? 
                // Or maybe existing 'registrations/?event={id}' endpoint.
                return axios.get(`registrations/?event=${event.id}`);
            })
            .then(res => {
                const data = Array.isArray(res.data) ? res.data : res.data.results;
                setRegistrations(data || []);
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    };

    const handleSearchUser = (e) => {
        const term = e.target.value;
        setSearchTerm(term);
        if (term.length > 2) {
            axios.get(`users/?search=${term}`)
                .then(res => {
                    setSearchResults(res.data.results || res.data || []);
                })
                .catch(err => console.error(err));
        } else {
            setSearchResults([]);
        }
    };

    const selectUser = (user) => {
        setSelectedUser(user);
        setSearchTerm(user.username);
        setSearchResults([]); // Hide dropdown
    };

    const handleCreateTicket = () => {
        if (!selectedUser) return alert('Selecciona un usuario.');

        setCreating(true);
        axios.post(`events/${event.id}/create_manual_ticket/`, {
            event_id: event.id,
            user_id: selectedUser.id,
            alias: ticketAlias
        })
            .then(res => {
                alert('Ticket creado exitosamente');
                setTicketAlias('');
                setSelectedUser(null);
                setSearchTerm('');
                loadRegistrations(); // Refresh list
                setActiveTab('list');
            })
            .catch(err => {
                console.error(err);
                alert('Error al crear ticket: ' + (err.response?.data?.detail || err.message));
            })
            .finally(() => setCreating(false));
    };

    const handleExcelExport = () => {
        if (!confirm('¿Descargar listado de participantes en Excel?')) return;

        setLoading(true);
        axios.get(`events/${event.id}/export_csv/`, { responseType: 'blob' })
            .then((response) => {
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `${event.name || 'evento'}_asistentes.csv`);
                document.body.appendChild(link);
                link.click();
                link.remove();
            })
            .catch((error) => {
                console.error('Export error:', error);
                alert('Error al exportar: ' + (error.response?.data?.detail || 'No tienes permisos o ha ocurrido un error.'));
            })
            .finally(() => setLoading(false));
    };

    // Filter Lists
    const attendedList = registrations.filter(r => r.attended_at);

    return (
        <div style={{ marginTop: 20, padding: 20, backgroundColor: 'white', borderRadius: 8, boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0 }}>🛡️ Gestión de Accesos y QR</h3>

            {/* TABS */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid #eee', paddingBottom: 10, flexWrap: 'wrap' }}>
                <button
                    className={`btn ${activeTab === 'list' ? 'primary' : 'secondary'}`}
                    onClick={() => setActiveTab('list')}
                >
                    📋 Todos los QR ({registrations.filter(r => r.status === 'confirmed').length})
                </button>
                <button
                    className={`btn ${activeTab === 'attended' ? 'primary' : 'secondary'}`}
                    onClick={() => setActiveTab('attended')}
                >
                    ✅ Asistentes ({attendedList.length})
                </button>
                <button
                    className={`btn ${activeTab === 'scan' ? 'primary' : 'secondary'}`}
                    onClick={() => setActiveTab('scan')}
                    style={{ backgroundColor: '#e0f2fe', color: '#0369a1', borderColor: '#0ea5e9' }}
                >
                    📷 Escanear QR
                </button>
                <button
                    className={`btn ${activeTab === 'manual' ? 'primary' : 'secondary'}`}
                    onClick={() => setActiveTab('manual')}
                    style={{ backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#f59e0b' }}
                >
                    ➕ Generar QR Manual
                </button>
                <button
                    className="btn secondary"
                    onClick={handleExcelExport}
                    disabled={loading}
                    style={{ marginLeft: 'auto', fontSize: '12px', borderColor: '#86efac', color: '#166534', backgroundColor: loading ? '#f0fdf4' : '#dcfce7' }}
                >
                    {loading ? '⏳...' : '📊 Exportar Excel'}
                </button>
            </div>

            {/* TAB: SCANNER */}
            {activeTab === 'scan' && (
                <div style={{ marginTop: 20 }}>
                    <QRScanner eventId={event.id} onBack={() => setActiveTab('list')} />
                </div>
            )}

            {/* TAB: MANUAL GENERATION */}
            {activeTab === 'manual' && (
                <div style={{ maxWidth: 500 }}>
                    <h4>Asignar QR Manualmente</h4>
                    <p className="muted" style={{ fontSize: '14px' }}>Genera una entrada manualmente para cualquier usuario (Staff, VIP, Prensa...).</p>

                    <div style={{ marginBottom: 15 }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 5 }}>Buscar Usuario</label>
                        <input
                            type="text"
                            placeholder="Buscar por nombre o email..."
                            value={searchTerm}
                            onChange={handleSearchUser}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: 4 }}
                        />
                        {searchResults.length > 0 && (
                            <ul style={{
                                listStyle: 'none', padding: 0, margin: 0, border: '1px solid #ddd',
                                maxHeight: 150, overflowY: 'auto', backgroundColor: 'white', position: 'absolute', width: '300px', zIndex: 10
                            }}>
                                {searchResults.map(u => (
                                    <li key={u.id}
                                        onClick={() => selectUser(u)}
                                        style={{ padding: '8px', borderBottom: '1px solid #eee', cursor: 'pointer', fontSize: '13px' }}
                                    >
                                        <strong>{u.username}</strong> <br />
                                        <span className="muted" style={{ fontSize: '11px' }}>{u.email}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {selectedUser && (
                            <div style={{ marginTop: 5, fontSize: '13px', color: 'green' }}>
                                ✅ Seleccionado: <strong>{selectedUser.username}</strong> ({selectedUser.email})
                            </div>
                        )}
                    </div>

                    <div style={{ marginBottom: 15 }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: 5 }}>Alias / Etiqueta (Opcional)</label>
                        <input
                            type="text"
                            placeholder="Ej: Invitado Especial, Prensa..."
                            value={ticketAlias}
                            onChange={(e) => setTicketAlias(e.target.value)}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: 4 }}
                        />
                    </div>

                    <button
                        className="btn primary"
                        disabled={!selectedUser || creating}
                        onClick={handleCreateTicket}
                    >
                        {creating ? 'Generando...' : 'Generar QR'}
                    </button>
                </div>
            )}

            {/* TAB: LISTS */}
            {(activeTab === 'list' || activeTab === 'attended') && (
                <div>
                    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                <tr>
                                    <th style={{ padding: 10, textAlign: 'left' }}>Usuario / Asistente</th>
                                    <th style={{ padding: 10, textAlign: 'left' }}>Alias</th>
                                    <th style={{ padding: 10, textAlign: 'left' }}>QR Code</th>
                                    <th style={{ padding: 10, textAlign: 'left' }}>Estado</th>
                                    {activeTab === 'attended' && <th style={{ padding: 10, textAlign: 'left' }}>Hora Entrada</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {(activeTab === 'list' ? registrations.filter(r => r.status === 'confirmed') : attendedList).map(reg => {
                                    // Determine display name
                                    let displayName = reg.attendee_first_name
                                        ? `${reg.attendee_first_name} ${reg.attendee_last_name} (${reg.attendee_type})`
                                        : (reg.user?.username || 'Usuario');

                                    return (
                                        <tr key={reg.id} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: 10 }}>
                                                {displayName}
                                                <div className="muted" style={{ fontSize: '11px' }}>{reg.user?.email}</div>
                                            </td>
                                            <td style={{ padding: 10 }}>
                                                {reg.alias ? <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4, fontSize: '11px' }}>{reg.alias}</span> : '-'}
                                            </td>
                                            <td style={{ padding: 10, fontFamily: 'monospace' }}>
                                                {reg.entry_code?.substring(0, 8)}...
                                            </td>
                                            <td style={{ padding: 10 }}>
                                                {reg.used ? <span style={{ color: 'green', fontWeight: 'bold' }}>Validado</span> : <span style={{ color: '#9ca3af' }}>No usado</span>}
                                            </td>
                                            {activeTab === 'attended' && (
                                                <td style={{ padding: 10 }}>
                                                    {reg.attended_at ? new Date(reg.attended_at).toLocaleString() : '-'}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                                {(activeTab === 'list' ? registrations.filter(r => r.status === 'confirmed') : attendedList).length === 0 && (
                                    <tr>
                                        <td colSpan="5" style={{ padding: 20, textAlign: 'center', color: '#666' }}>No hay registros para mostrar.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
