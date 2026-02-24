import axios from '../api';
import { getBackendUrl } from '../api';
import ProfileSettings from './ProfileSettings';
import ThemePicker from '../components/ThemePicker';

export default function UserProfile({ userId, onBack, showVerificationAlert, onClearAlert }) {
    const [user, setUser] = useState(null);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showVerification, setShowVerification] = useState(false);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        bio: ''
    });
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        loadUser();
    }, [userId]);

    // Mostrar verificación automáticamente si se recibe la alerta
    useEffect(() => {
        if (showVerificationAlert) {
            setShowVerification(true);
        }
    }, [showVerificationAlert]);

    function loadUser() {
        setLoading(true);
        axios.get(`users/${userId}/`)
            .then(res => {
                setUser(res.data);
                setFormData({
                    first_name: res.data.first_name || '',
                    last_name: res.data.last_name || '',
                    email: res.data.email || '',
                    phone: res.data.phone || '',
                    bio: res.data.bio || ''
                });
                // Si faltan datos obligatorios, abrir modo edición
                if (!res.data.first_name || !res.data.last_name) {
                    setEditing(true);
                }
            })
            .catch(err => console.error('Error loading user:', err))
            .finally(() => setLoading(false));
    }

    function handleChange(e) {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
    }

    function handleAvatarChange(e) {
        const file = e.target.files[0];
        if (file) {
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    }

    function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        setErrors({});

        const formDataToSend = new FormData();
        formDataToSend.append('first_name', formData.first_name);
        formDataToSend.append('last_name', formData.last_name);
        formDataToSend.append('email', formData.email);
        formDataToSend.append('phone', formData.phone);
        formDataToSend.append('bio', formData.bio);

        if (avatarFile) {
            formDataToSend.append('avatar', avatarFile);
        }

        axios.patch(`users/${userId}/`, formDataToSend, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        })
            .then(res => {
                setUser(res.data);
                setEditing(false);
                setAvatarFile(null);
                setAvatarPreview(null);
                alert('Perfil actualizado exitosamente');
            })
            .catch(err => {
                if (err.response?.data) {
                    setErrors(err.response.data);
                } else {
                    setErrors({ general: 'Error al actualizar perfil' });
                }
            })
            .finally(() => setSaving(false));
    }

    if (loading) {
        return (
            <div className="container">
                <div className="card">Cargando perfil...</div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="container">
                <div className="card">Usuario no encontrado</div>
            </div>
        );
    }

    const avatarUrl = avatarPreview || user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random&size=200`;
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();

    // Mostrar componente de verificación si está activado
    if (showVerification) {
        return <ProfileSettings onBack={() => {
            setShowVerification(false);
            if (onClearAlert) onClearAlert();
            loadUser(); // Recargar usuario después de verificar
        }} showAlert={showVerificationAlert} />;
    }

    return (
        <div className="container">
            {onBack && (
                <button className="btn secondary" onClick={onBack} style={{ marginBottom: 12 }}>
                    ← Volver
                </button>
            )}

            <div className="card">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
                    {/* Avatar */}
                    <div style={{ textAlign: 'center' }}>
                        <img
                            src={avatarUrl}
                            alt={user.username}
                            onError={(e) => {
                                e.target.onerror = null;
                                if (e.target.src !== user.default_avatar_url) {
                                    e.target.src = user.default_avatar_url;
                                } else {
                                    e.target.src = 'https://via.placeholder.com/150?text=?';
                                }
                            }}
                            style={{
                                width: 150,
                                height: 150,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '3px solid var(--primary)'
                            }}
                        />
                        {editing && (
                            <div style={{ marginTop: 12 }}>
                                <label htmlFor="avatar-upload" className="btn secondary" style={{ cursor: 'pointer', fontSize: '0.9em' }}>
                                    Cambiar foto
                                </label>
                                <input
                                    type="file"
                                    id="avatar-upload"
                                    accept="image/*"
                                    onChange={handleAvatarChange}
                                    style={{ display: 'none' }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1 }}>
                        <h2 style={{ marginTop: 0 }}>
                            {fullName || user.username}
                            {fullName && <span className="muted" style={{ fontSize: '0.6em', marginLeft: 10, fontWeight: 'normal' }}>({user.username})</span>}
                        </h2>
                        <div className="muted" style={{ marginBottom: 8 }}>
                            Rango: {user.role === 'admin' ? 'Administrador' : 'Asistente'}
                        </div>

                        {(!user.first_name || !user.last_name) && !editing && (
                            <div style={{
                                backgroundColor: 'var(--primary-light)',
                                color: 'var(--primary)',
                                padding: '10px',
                                borderRadius: '8px',
                                marginBottom: '16px',
                                fontSize: '0.9em',
                                border: '1px solid var(--primary-light)'
                            }}>
                                ⚠️ <strong>Acción Requerida:</strong> Por favor completa tu Nombre y Apellidos.
                            </div>
                        )}

                        {!editing ? (
                            <>
                                <div style={{ marginTop: 16 }}>
                                    <div style={{ marginBottom: 8 }}>
                                        <strong>Email:</strong> {user.email || 'No especificado'}
                                    </div>
                                    <div style={{ marginBottom: 8 }}>
                                        <strong>Teléfono:</strong> {user.phone || 'No especificado'}
                                    </div>
                                    {user.bio && (
                                        <div style={{ marginTop: 12 }}>
                                            <strong>Biografía:</strong>
                                            <p style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{user.bio}</p>
                                        </div>
                                    )}
                                </div>
                                <button className="btn" onClick={() => setEditing(true)} style={{ marginTop: 16 }}>
                                    Editar Perfil
                                </button>
                            </>
                        ) : (
                            <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
                                {errors.general && (
                                    <div style={{ padding: 12, backgroundColor: 'var(--danger)', color: 'white', borderRadius: 'var(--radius)', marginBottom: 16 }}>
                                        {errors.general}
                                    </div>
                                )}

                                <div className="form-row">
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <div style={{ flex: 1 }}>
                                            <label>Nombre *</label>
                                            <input
                                                type="text"
                                                name="first_name"
                                                value={formData.first_name}
                                                onChange={handleChange}
                                                disabled={saving}
                                                placeholder="Nombre"
                                            />
                                            {errors.first_name && <div style={{ color: 'var(--danger)', fontSize: '0.85em' }}>{errors.first_name}</div>}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label>Apellidos *</label>
                                            <input
                                                type="text"
                                                name="last_name"
                                                value={formData.last_name}
                                                onChange={handleChange}
                                                disabled={saving}
                                                placeholder="Apellidos"
                                            />
                                            {errors.last_name && <div style={{ color: 'var(--danger)', fontSize: '0.85em' }}>{errors.last_name}</div>}
                                        </div>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        disabled={saving}
                                    />
                                    {errors.email && <div style={{ color: 'var(--danger)', fontSize: '0.85em' }}>{errors.email}</div>}
                                </div>

                                <div className="form-row">
                                    <label>Teléfono</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        disabled={saving}
                                    />
                                    {errors.phone && <div style={{ color: 'var(--danger)', fontSize: '0.85em' }}>{errors.phone}</div>}
                                </div>

                                <div className="form-row">
                                    <label>Biografía</label>
                                    <textarea
                                        name="bio"
                                        value={formData.bio}
                                        onChange={handleChange}
                                        disabled={saving}
                                        rows={4}
                                        placeholder="Cuéntanos sobre ti..."
                                    />
                                    {errors.bio && <div style={{ color: 'var(--danger)', fontSize: '0.85em' }}>{errors.bio}</div>}
                                </div>

                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button type="submit" className="btn" disabled={saving}>
                                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn secondary"
                                        onClick={() => {
                                            setEditing(false);
                                            setAvatarFile(null);
                                            setAvatarPreview(null);
                                            setFormData({
                                                first_name: user.first_name || '',
                                                last_name: user.last_name || '',
                                                email: user.email || '',
                                                phone: user.phone || '',
                                                bio: user.bio || ''
                                            });
                                        }}
                                        disabled={saving}
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>

            {/* Theme Selection Section */}
            {!editing && (
                <div style={{ marginTop: 40, borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
                    <ThemePicker />
                </div>
            )}
        </div>
    );
}
