import React, { useEffect, useState } from 'react';
import axios from '../api';
import Select from 'react-select';

export default function GroupForm({ groupId, onSaved }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [logo, setLogo] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [members, setMembers] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [events, setEvents] = useState([]);

    const [allUsers, setAllUsers] = useState([]);
    const [allEvents, setAllEvents] = useState([]);

    useEffect(() => {
        axios.get('users/for_select/').then(res => {
            const payload = res.data;
            const arr = Array.isArray(payload) ? payload : (payload.results || payload || []);
            const opts = arr.map(u => ({ value: u.id, label: `${u.username}${u.email ? ' (' + u.email + ')' : ''}` }));
            setAllUsers(opts);
        }).catch(() => { });

        axios.get('events/').then(res => {
            const payload = res.data;
            const arr = Array.isArray(payload) ? payload : (payload.results || []);
            const opts = arr.map(ev => ({ value: ev.id, label: ev.name }));
            setAllEvents(opts);
        }).catch(() => { });

        if (groupId) {
            axios.get(`groups/${groupId}/`).then(res => {
                setName(res.data.name || '');
                setDescription(res.data.description || '');
                setIsPublic(res.data.is_public !== false);
                if (res.data.logo) setLogoPreview(res.data.logo);
                setMembers((res.data.members || []).map(id => ({ value: id, label: String(id) })));
                setAdmins((res.data.admins || []).map(id => ({ value: id, label: String(id) })));
                setEvents((res.data.events || []).map(id => ({ value: id, label: String(id) })));
            }).catch(() => { });
        }
    }, [groupId]);

    function handleLogoChange(e) {
        const file = e.target.files[0];
        if (file) {
            setLogo(file);
            const reader = new FileReader();
            reader.onload = (event) => {
                setLogoPreview(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    }

    function handleSubmit(e) {
        e.preventDefault();
        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        formData.append('is_public', isPublic);
        if (logo) formData.append('logo', logo);

        members.forEach(m => formData.append('members', m.value));
        admins.forEach(a => formData.append('admins', a.value));
        events.forEach(ev => formData.append('events', ev.value));

        if (groupId) {
            axios.put(`groups/${groupId}/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
                .then(() => onSaved && onSaved())
                .catch(err => {
                    console.error('Error updating group:', err.response?.data || err.message);
                    alert('Error updating: ' + (err.response?.data?.detail || JSON.stringify(err.response?.data) || err.message));
                });
        } else {
            axios.post('groups/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
                .then(() => onSaved && onSaved())
                .catch(err => {
                    console.error('Error creating group:', err.response?.data || err.message);
                    alert('Error creating: ' + (err.response?.data?.detail || JSON.stringify(err.response?.data) || err.message));
                });
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
                <label className="group-form-label">
                    📝 Nombre del Grupo *
                </label>
                <input
                    className="group-form-input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    placeholder="Ej: Equipo Marketing 2025"
                />
            </div>

            <div>
                <label className="group-form-label">
                    📄 Descripción
                </label>
                <textarea
                    className="group-form-input"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe el propósito del grupo..."
                    rows="3"
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
            </div>

            <div>
                <label className="group-form-label">
                    🖼️ Logo del Grupo
                </label>
                <div style={{
                    marginBottom: '12px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                    aspectRatio: '1',
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #f1f5f9 100%)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '2px dashed #cbd5e1'
                }}>
                    {logoPreview ? (
                        <img
                            src={logoPreview}
                            alt="logo preview"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                            <div style={{ fontSize: '40px', marginBottom: '8px' }}>📸</div>
                            <div style={{ fontSize: '12px' }}>Sin imagen</div>
                        </div>
                    )}
                </div>
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    style={{
                        width: '100%',
                        padding: '10px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}
                />
                <small className="group-form-help">
                    Sube una imagen para el logo del grupo (PNG, JPG, etc.)
                </small>
            </div>

            <div>
                <label className="group-form-label">
                    🔓 Visibilidad del Grupo
                </label>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        background: isPublic ? '#dcfce7' : '#f1f5f9',
                        border: isPublic ? '2px solid #10b981' : '2px solid #e2e8f0',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        flex: 1
                    }}>
                        <input
                            type="radio"
                            checked={isPublic}
                            onChange={() => setIsPublic(true)}
                            style={{ cursor: 'pointer' }}
                        />
                        <span style={{ fontWeight: '600', color: isPublic ? '#166534' : '#64748b' }}>
                            🌐 Público
                        </span>
                    </label>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        background: !isPublic ? '#fef3c7' : '#f1f5f9',
                        border: !isPublic ? '2px solid #f59e0b' : '2px solid #e2e8f0',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        flex: 1
                    }}>
                        <input
                            type="radio"
                            checked={!isPublic}
                            onChange={() => setIsPublic(false)}
                            style={{ cursor: 'pointer' }}
                        />
                        <span style={{ fontWeight: '600', color: !isPublic ? '#92400e' : '#64748b' }}>
                            🔒 Privado
                        </span>
                    </label>
                </div>
                <small className="group-form-help">
                    {isPublic ? 'Cualquiera puede unirse automáticamente' : 'Requiere aprobación para unirse'}
                </small>
            </div>

            <div>
                <label className="group-form-label">
                    👥 Miembros
                </label>
                <Select
                    isMulti
                    options={allUsers}
                    value={members}
                    onChange={setMembers}
                    placeholder="Selecciona usuarios para el grupo..."
                    styles={{
                        control: (base) => ({
                            ...base,
                            padding: '4px',
                            borderRadius: '10px',
                            border: '2px solid #e2e8f0',
                            fontSize: '14px',
                            '&:hover': { borderColor: '#cbd5e1' }
                        }),
                        multiValue: (base) => ({
                            ...base,
                            backgroundColor: '#dbeafe',
                            borderRadius: '6px'
                        }),
                        multiValueLabel: (base) => ({
                            ...base,
                            color: '#1e40af',
                            fontWeight: '500'
                        })
                    }}
                />
                <small className="group-form-help">
                    Los miembros podrán ver los eventos del grupo
                </small>
            </div>

            <div>
                <label className="group-form-label">
                    👑 Administradores
                </label>
                <Select
                    isMulti
                    options={allUsers}
                    value={admins}
                    onChange={setAdmins}
                    placeholder="Selecciona administradores..."
                    styles={{
                        control: (base) => ({
                            ...base,
                            padding: '4px',
                            borderRadius: '10px',
                            border: '2px solid #e2e8f0',
                            fontSize: '14px',
                            '&:hover': { borderColor: '#cbd5e1' }
                        }),
                        multiValue: (base) => ({
                            ...base,
                            backgroundColor: '#fef3c7',
                            borderRadius: '6px'
                        }),
                        multiValueLabel: (base) => ({
                            ...base,
                            color: '#92400e',
                            fontWeight: '500'
                        })
                    }}
                />
                <small className="group-form-help">
                    Los administradores pueden gestionar miembros y eventos
                </small>
            </div>

            <div>
                <label className="group-form-label">
                    🎫 Eventos Asociados
                </label>
                <Select
                    isMulti
                    options={allEvents}
                    value={events}
                    onChange={setEvents}
                    placeholder="Asocia eventos al grupo..."
                    styles={{
                        control: (base) => ({
                            ...base,
                            padding: '4px',
                            borderRadius: '10px',
                            border: '2px solid #e2e8f0',
                            fontSize: '14px',
                            '&:hover': { borderColor: '#cbd5e1' }
                        }),
                        multiValue: (base) => ({
                            ...base,
                            backgroundColor: '#dcfce7',
                            borderRadius: '6px'
                        }),
                        multiValueLabel: (base) => ({
                            ...base,
                            color: '#166534',
                            fontWeight: '500'
                        })
                    }}
                />
                <small className="group-form-help">
                    Vincula eventos existentes a este grupo
                </small>
            </div>

            <button type="submit" className="group-form-submit">
                💾 {groupId ? 'Actualizar Grupo' : 'Crear Grupo'}
            </button>
        </form>
    );
}
