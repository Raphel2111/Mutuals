import React, { useEffect, useState } from 'react';
import axios from '../api';
import GroupForm from './GroupForm';
import GroupDetail from './GroupDetail';
import { fetchCurrentUser } from '../auth';

export default function GroupList() {
    const [groups, setGroups] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [joiningGroups, setJoiningGroups] = useState({});
    const [showAccessMessageDialog, setShowAccessMessageDialog] = useState(null);
    const [accessMessage, setAccessMessage] = useState('');
    const [requestingAccess, setRequestingAccess] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        load();
        fetchCurrentUser().then(u => setCurrentUser(u));
    }, []);

    function load() {
        axios.get('groups/')
            .then(res => {
                const payload = res.data;
                const items = Array.isArray(payload) ? payload : (payload.results || []);
                setGroups(items);
            })
            .catch(err => console.error('Failed to load groups', err));
    }

    function deleteGroup(id, name) {
        if (!window.confirm(`¿Eliminar el grupo "${name}"? Esta acción no se puede deshacer.`)) return;
        axios.delete(`groups/${id}/`)
            .then(() => {
                load();
                if (editingId === id) setEditingId(null);
            })
            .catch(err => {
                console.error('Error deleting group:', err.response?.data || err.message);
                alert('Error al eliminar: ' + (err.response?.data?.detail || err.message));
            });
    }

    function joinGroup(groupId, isPublic) {
        if (!isPublic) {
            // Para grupos privados, mostrar diálogo de mensaje
            setShowAccessMessageDialog(groupId);
            setAccessMessage('');
            return;
        }

        // Para grupos públicos, unirse directamente
        setJoiningGroups(prev => ({ ...prev, [groupId]: true }));
        axios.post(`groups/${groupId}/join/`)
            .then(res => {
                if (res.data.is_member) {
                    alert('¡Te has unido al grupo exitosamente!');
                }
                load();
            })
            .catch(err => {
                console.error('Error joining group:', err);
                alert('Error al unirse: ' + (err.response?.data?.detail || err.message));
            })
            .finally(() => {
                setJoiningGroups(prev => ({ ...prev, [groupId]: false }));
            });
    }

    function submitAccessRequest(groupId) {
        setRequestingAccess(true);
        axios.post(`groups/${groupId}/request_access/`, {
            message: accessMessage
        })
            .then(() => {
                alert('Solicitud de acceso enviada a los administradores');
                setShowAccessMessageDialog(null);
                setAccessMessage('');
                load();
            })
            .catch(err => {
                console.error('Error requesting access:', err);
                alert('Error al solicitar acceso: ' + (err.response?.data?.detail || err.message));
            })
            .finally(() => {
                setRequestingAccess(false);
            });
    }

    function leaveGroup(groupId, groupName) {
        if (!window.confirm(`¿Salir del grupo "${groupName}"?`)) return;
        axios.post(`groups/${groupId}/leave/`)
            .then(() => {
                alert('Has salido del grupo');
                load();
            })
            .catch(err => {
                console.error('Error leaving group:', err);
                alert('Error al salir: ' + (err.response?.data?.detail || err.message));
            });
    }

    if (selectedGroupId) {
        return <GroupDetail groupId={selectedGroupId} onBack={() => setSelectedGroupId(null)} />;
    }

    // Diálogo para solicitar acceso con mensaje
    if (showAccessMessageDialog) {
        return (
            <div className="container">
                <div className="card" style={{ maxWidth: '500px', margin: '40px auto' }}>
                    <h2 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>Solicitar acceso al grupo</h2>
                    <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>
                        Este es un grupo privado. Los administradores revisarán tu solicitud.
                    </p>

                    <div className="form-row">
                        <label style={{ marginBottom: '8px' }}>
                            Mensaje opcional (máx 300 caracteres)
                        </label>
                        <textarea
                            value={accessMessage}
                            onChange={(e) => setAccessMessage(e.target.value.slice(0, 300))}
                            placeholder="Cuéntales por qué quieres unirte a este grupo..."
                            rows={4}
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '4px',
                                border: '1px solid var(--border)',
                                fontFamily: 'inherit',
                                resize: 'vertical'
                            }}
                        />
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', textAlign: 'right' }}>
                            {accessMessage.length}/300
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                        <button
                            className="btn secondary"
                            onClick={() => {
                                setShowAccessMessageDialog(null);
                                setAccessMessage('');
                            }}
                            style={{ flex: 1 }}
                        >
                            Cancelar
                        </button>
                        <button
                            className="btn"
                            onClick={() => submitAccessRequest(showAccessMessageDialog)}
                            disabled={requestingAccess}
                            style={{ flex: 1 }}
                        >
                            {requestingAccess ? 'Enviando...' : '📩 Enviar Solicitud'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700' }}>👥 Grupos Disponibles</h1>
                <p style={{ margin: '0 0 20px 0', color: 'var(--muted)' }}>Descubre y únete a grupos de tu interés, o crea tu propio grupo.</p>
                {currentUser && currentUser.is_staff && (
                    <button
                        className="btn"
                        onClick={() => { setShowCreate(!showCreate); setEditingId(null); }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 20px',
                            fontSize: '15px',
                            fontWeight: '600'
                        }}
                    >
                        {showCreate ? '✕ Cancelar' : '+ Crear Nuevo Grupo'}
                    </button>
                )}
            </div>

            {/* Formulario de creación */}
            {showCreate && currentUser && currentUser.is_staff && (
                <div className="group-form-wrapper">
                    <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700', color: 'white' }}>✨ Crear Nuevo Grupo</h2>
                    <p style={{ margin: '0 0 24px 0', opacity: 0.95, fontSize: '14px' }}>
                        Crea un grupo para organizar eventos y gestionar miembros
                    </p>
                    <div className="group-form-content">
                        <GroupForm onSaved={() => { setShowCreate(false); load(); }} />
                    </div>
                </div>
            )}

            {/* Formulario de edición */}
            {editingId && (
                <div className="group-form-wrapper edit-mode">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: 'white' }}>✏️ Editar Grupo</h2>
                        <button
                            onClick={() => setEditingId(null)}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                border: 'none',
                                color: 'white',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '14px'
                            }}
                        >
                            ✕ Cancelar
                        </button>
                    </div>
                    <p style={{ margin: '0 0 24px 0', opacity: 0.95, fontSize: '14px' }}>
                        Modifica la información del grupo
                    </p>
                    <div className="group-form-content">
                        <GroupForm groupId={editingId} onSaved={() => { setEditingId(null); load(); }} />
                    </div>
                </div>
            )}

            {/* Lista de grupos */}
            {groups.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
                    <h3 style={{ margin: '0 0 8px 0', color: 'var(--muted)' }}>No hay grupos disponibles</h3>
                    <p style={{ margin: '0 0 20px 0', color: 'var(--muted)', fontSize: '14px' }}>
                        {currentUser && currentUser.is_staff ? 'Sé el primero en crear un grupo.' : 'No hay grupos públicos visibles.'}
                    </p>
                    {currentUser && currentUser.is_staff && (
                        <button
                            className="btn"
                            onClick={() => setShowCreate(true)}
                            style={{ padding: '12px 24px' }}
                        >
                            Crear Primer Grupo
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid">
                    {groups.map(g => {
                        const isMember = g.is_member;
                        const isPublic = g.is_public;
                        const memberCount = g.member_count || 0;

                        return (
                            <div className="card" key={g.id} style={{
                                position: 'relative',
                                transition: 'all 0.3s ease',
                                border: isMember ? '2px solid #10b981' : '1px solid #e2e8f0',
                                cursor: 'pointer',
                                overflow: 'hidden'
                            }} onClick={() => setSelectedGroupId(g.id)}>
                                {/* Logo del grupo */}
                                <div style={{
                                    width: '100%',
                                    aspectRatio: '1',
                                    background: 'linear-gradient(135deg, #f0f9ff 0%, #f1f5f9 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '12px',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    border: '1px solid #e2e8f0'
                                }}>
                                    <img
                                        src={g.logo_url || g.default_logo_url}
                                        alt={g.name}
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            if (e.target.src !== g.default_logo_url) {
                                                e.target.src = g.default_logo_url;
                                            } else {
                                                e.target.src = 'https://via.placeholder.com/150?text=' + g.name.charAt(0);
                                            }
                                        }}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                                        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>
                                            {g.name}
                                        </h3>
                                        {/* Badge de tipo de grupo */}
                                        <div style={{
                                            padding: '4px 10px',
                                            background: isPublic ? '#dcfce7' : '#fef3c7',
                                            color: isPublic ? '#166534' : '#92400e',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            fontWeight: '600'
                                        }}>
                                            {isPublic ? '🌐 Público' : '🔒 Privado'}
                                        </div>
                                    </div>

                                    {/* Descripción */}
                                    {g.description && (
                                        <p style={{
                                            margin: '0 0 12px 0',
                                            color: '#64748b',
                                            fontSize: '14px',
                                            lineHeight: '1.5'
                                        }}>
                                            {g.description}
                                        </p>
                                    )}

                                    {/* Badges info */}
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <div style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 12px',
                                            background: '#f0f9ff',
                                            borderRadius: '12px',
                                            fontSize: '13px',
                                            color: '#0369a1',
                                            fontWeight: '600'
                                        }}>
                                            <span>👤</span>
                                            <span>{memberCount} miembro{memberCount !== 1 ? 's' : ''}</span>
                                        </div>

                                        {isMember && (
                                            <div style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '4px 12px',
                                                background: '#dcfce7',
                                                borderRadius: '12px',
                                                fontSize: '13px',
                                                color: '#166534',
                                                fontWeight: '600'
                                            }}>
                                                <span>✓</span>
                                                <span>Miembro</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Botones de acción */}
                                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                    {isMember ? (
                                        <>
                                            <button
                                                className="btn"
                                                onClick={(e) => { e.stopPropagation(); setSelectedGroupId(g.id); }}
                                                style={{ flex: 1, fontSize: '14px', padding: '10px' }}
                                            >
                                                🎯 Gestionar
                                            </button>
                                            <button
                                                className="btn secondary"
                                                onClick={() => leaveGroup(g.id, g.name)}
                                                style={{
                                                    fontSize: '14px',
                                                    padding: '10px',
                                                    background: '#fee2e2',
                                                    color: '#991b1b'
                                                }}
                                            >
                                                Salir
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            className="btn"
                                            onClick={() => joinGroup(g.id, isPublic)}
                                            disabled={joiningGroups[g.id]}
                                            style={{
                                                flex: 1,
                                                fontSize: '14px',
                                                padding: '10px',
                                                background: isPublic ? '#10b981' : '#f59e0b',
                                                opacity: joiningGroups[g.id] ? 0.6 : 1
                                            }}
                                        >
                                            {joiningGroups[g.id] ?
                                                '⏳ Procesando...' :
                                                (isPublic ? '✓ Unirse' : '📩 Solicitar Acceso')
                                            }
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
