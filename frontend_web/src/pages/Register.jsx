import React, { useState } from 'react';
import axios from '../api';

export default function Register({ onRegisterSuccess, onBackToLogin }) {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        phone: '',
        password: '',
        password_confirm: ''
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    function handleChange(e) {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error for this field when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
    }

    function handleSubmit(e) {
        e.preventDefault();
        setErrors({});
        setLoading(true);

        // Client-side validation
        const newErrors = {};
        if (!formData.username.trim()) {
            newErrors.username = 'El nombre de usuario es obligatorio';
        }
        if (!formData.first_name.trim()) {
            newErrors.first_name = 'El nombre es obligatorio';
        }
        if (!formData.last_name.trim()) {
            newErrors.last_name = 'Los apellidos son obligatorios';
        }
        if (!formData.email.trim()) {
            newErrors.email = 'El email es obligatorio';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Email inválido';
        }
        if (!formData.password) {
            newErrors.password = 'La contraseña es obligatoria';
        } else if (formData.password.length < 6) {
            newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
        }
        if (formData.password !== formData.password_confirm) {
            newErrors.password_confirm = 'Las contraseñas no coinciden';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setLoading(false);
            return;
        }

        // Submit to backend (relative to API base)
        const trimmedData = {
            username: formData.username.trim(),
            email: formData.email.trim(),
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            phone: formData.phone.trim(),
            password: formData.password,
            password_confirm: formData.password_confirm
        };

        axios.post('users/register/', trimmedData)
            .then(res => {
                setSuccess(true);
                setTimeout(() => {
                    if (onRegisterSuccess) {
                        onRegisterSuccess();
                    }
                }, 2000);
            })
            .catch(err => {
                if (err.response?.data) {
                    setErrors(err.response.data);
                } else {
                    setErrors({ general: 'Error al registrar usuario' });
                }
            })
            .finally(() => setLoading(false));
    }

    if (success) {
        return (
            <div className="container">
                <div className="card" style={{ maxWidth: 500, margin: '40px auto', borderLeft: '4px solid var(--primary)' }}>
                    <h2 style={{ marginTop: 0 }}>✅ ¡Registro Exitoso!</h2>
                    <p>Tu cuenta ha sido creada exitosamente.</p>
                    <p className="muted">Serás redirigido al inicio de sesión...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <div className="card" style={{ maxWidth: 500, margin: '40px auto' }}>
                <h2 style={{ marginTop: 0 }}>Crear Cuenta</h2>
                <p className="muted">Regístrate para acceder a EventoApp</p>

                {errors.general && (
                    <div style={{ padding: 12, backgroundColor: 'var(--danger)', color: 'white', borderRadius: 'var(--radius)', marginBottom: 16 }}>
                        {errors.general}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-row">
                        <label htmlFor="username">Nombre de Usuario *</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            disabled={loading}
                            style={{ borderColor: errors.username ? 'var(--danger)' : undefined }}
                        />
                        {errors.username && (
                            <div style={{ color: 'var(--danger)', fontSize: '0.85em', marginTop: 4 }}>
                                {Array.isArray(errors.username) ? errors.username[0] : errors.username}
                            </div>
                        )}
                    </div>

                    <div className="form-row">
                        <label htmlFor="first_name">Nombre *</label>
                        <input
                            type="text"
                            id="first_name"
                            name="first_name"
                            value={formData.first_name}
                            onChange={handleChange}
                            disabled={loading}
                            style={{ borderColor: errors.first_name ? 'var(--danger)' : undefined }}
                        />
                        {errors.first_name && (
                            <div style={{ color: 'var(--danger)', fontSize: '0.85em', marginTop: 4 }}>
                                {Array.isArray(errors.first_name) ? errors.first_name[0] : errors.first_name}
                            </div>
                        )}
                    </div>

                    <div className="form-row">
                        <label htmlFor="last_name">Apellidos *</label>
                        <input
                            type="text"
                            id="last_name"
                            name="last_name"
                            value={formData.last_name}
                            onChange={handleChange}
                            disabled={loading}
                            style={{ borderColor: errors.last_name ? 'var(--danger)' : undefined }}
                        />
                        {errors.last_name && (
                            <div style={{ color: 'var(--danger)', fontSize: '0.85em', marginTop: 4 }}>
                                {Array.isArray(errors.last_name) ? errors.last_name[0] : errors.last_name}
                            </div>
                        )}
                    </div>

                    <div className="form-row">
                        <label htmlFor="email">Email *</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            disabled={loading}
                            style={{ borderColor: errors.email ? 'var(--danger)' : undefined }}
                        />
                        {errors.email && (
                            <div style={{ color: 'var(--danger)', fontSize: '0.85em', marginTop: 4 }}>
                                {Array.isArray(errors.email) ? errors.email[0] : errors.email}
                            </div>
                        )}
                    </div>

                    <div className="form-row">
                        <label htmlFor="phone">Teléfono</label>
                        <input
                            type="tel"
                            id="phone"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="+34 123 456 789"
                            style={{ borderColor: errors.phone ? 'var(--danger)' : undefined }}
                        />
                        {errors.phone && (
                            <div style={{ color: 'var(--danger)', fontSize: '0.85em', marginTop: 4 }}>
                                {Array.isArray(errors.phone) ? errors.phone[0] : errors.phone}
                            </div>
                        )}
                    </div>

                    <div className="form-row">
                        <label htmlFor="password">Contraseña *</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            disabled={loading}
                            style={{ borderColor: errors.password ? 'var(--danger)' : undefined }}
                        />
                        {errors.password && (
                            <div style={{ color: 'var(--danger)', fontSize: '0.85em', marginTop: 4 }}>
                                {Array.isArray(errors.password) ? errors.password[0] : errors.password}
                            </div>
                        )}
                        <div className="muted" style={{ fontSize: '0.85em', marginTop: 4 }}>
                            Mínimo 6 caracteres
                        </div>
                    </div>

                    <div className="form-row">
                        <label htmlFor="password_confirm">Confirmar Contraseña *</label>
                        <input
                            type="password"
                            id="password_confirm"
                            name="password_confirm"
                            value={formData.password_confirm}
                            onChange={handleChange}
                            disabled={loading}
                            style={{ borderColor: errors.password_confirm ? 'var(--danger)' : undefined }}
                        />
                        {errors.password_confirm && (
                            <div style={{ color: 'var(--danger)', fontSize: '0.85em', marginTop: 4 }}>
                                {Array.isArray(errors.password_confirm) ? errors.password_confirm[0] : errors.password_confirm}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                        <button type="submit" className="btn" disabled={loading} style={{ flex: 1 }}>
                            {loading ? 'Registrando...' : 'Crear Cuenta'}
                        </button>
                        {onBackToLogin && (
                            <button type="button" className="btn secondary" onClick={onBackToLogin} disabled={loading}>
                                Volver
                            </button>
                        )}
                    </div>
                </form>

                {onBackToLogin && (
                    <div style={{ marginTop: 16, textAlign: 'center', fontSize: '0.9em' }}>
                        <span className="muted">¿Ya tienes cuenta?</span>{' '}
                        <a href="#" onClick={(e) => { e.preventDefault(); onBackToLogin(); }} style={{ color: 'var(--primary)' }}>
                            Iniciar sesión
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
