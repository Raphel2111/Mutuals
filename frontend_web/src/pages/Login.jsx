import React, { useState } from 'react';
import axios from '../api';
import { backendBase } from '../api';

export default function Login({ onLogin, onShowRegister }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [view, setView] = useState('login'); // login, reset_request, reset_confirm
    const [loading, setLoading] = useState(false);

    // Password reset states
    const [resetEmail, setResetEmail] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            console.log('Intentando login con:', { username, password });
            const res = await axios.post(backendBase + '/api/token/', { username, password });
            console.log('Login exitoso, tokens recibidos');
            localStorage.setItem('access_token', res.data.access);
            localStorage.setItem('refresh_token', res.data.refresh);
            console.log('Tokens guardados, llamando onLogin callback');
            if (onLogin) {
                onLogin();
            }
        } catch (err) {
            console.error('Login error:', err.response?.data || err.message);
            if (err.response?.status === 401) {
                setError('Usuario o contraseña incorrectos');
            } else if (err.response?.data?.detail) {
                setError(err.response.data.detail);
            } else if (err.response?.data?.username) {
                setError(Array.isArray(err.response.data.username) ? err.response.data.username[0] : err.response.data.username);
            } else if (err.response?.status === 0) {
                setError('No se puede conectar al servidor backend.');
            } else {
                setError(err.response?.data?.message || 'Error al iniciar sesión: ' + err.message);
            }
        }
    };


    const handleResetRequest = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await axios.post('/users/password-reset-request/', { email: resetEmail });
            setSuccess('Código enviado. Revisa tu email.');
            setView('reset_confirm');
        } catch (err) {
            console.error('Reset request error:', err.response?.data);
            const backendError = err.response?.data?.detail || err.response?.data?.email?.[0];
            setError(backendError || 'Error al solicitar el código (comprueba la consola)');
        } finally {
            setLoading(false);
        }
    };

    const handleResetConfirm = async (e) => {
        e.preventDefault();
        setError(null);
        if (newPassword !== newPasswordConfirm) {
            setError('Las contraseñas no coinciden');
            return;
        }
        setLoading(true);
        try {
            await axios.post('/users/password-reset-confirm/', {
                email: resetEmail,
                code: resetCode,
                password: newPassword,
                password_confirm: newPasswordConfirm
            });
            setSuccess('Contraseña actualizada correctamente. Ya puedes iniciar sesión.');
            setView('login');
            setResetEmail('');
            setResetCode('');
            setNewPassword('');
            setNewPasswordConfirm('');
        } catch (err) {
            setError(err.response?.data?.detail || 'Error al restablecer la contraseña. Verifica el código.');
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        if (onLogin) onLogin();
    };

    const token = localStorage.getItem('access_token');

    if (token) return (
        <div className="card" style={{ display: 'inline-block' }}>
            <p>Autenticado</p>
            <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => { if (onLogin) onLogin(); }}>Refrescar</button>
                <button className="btn secondary" onClick={logout}>Logout</button>
            </div>
        </div>
    );

    if (view === 'reset_request') return (
        <form className="card" onSubmit={handleResetRequest} style={{ maxWidth: 420 }}>
            <h3 style={{ marginTop: 0 }}>Restablecer contraseña</h3>
            <p className="muted" style={{ fontSize: '0.9rem', marginBottom: 20 }}>
                Introduce tu email y te enviaremos un código para recuperar el acceso a tu cuenta.
            </p>
            <div className="form-row">
                <label>Email</label>
                <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required placeholder="ejemplo@email.com" />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn" type="submit" disabled={loading}>
                    {loading ? 'Enviando...' : 'Enviar código'}
                </button>
                <button type="button" className="btn secondary" onClick={() => { setView('login'); setError(null); }}>Volver</button>
            </div>
            {error && <div style={{ color: 'var(--danger)', marginTop: 10, fontSize: '0.9rem' }}>{error}</div>}
        </form>
    );

    if (view === 'reset_confirm') return (
        <form className="card" onSubmit={handleResetConfirm} style={{ maxWidth: 420 }}>
            <h3 style={{ marginTop: 0 }}>Nueva contraseña</h3>
            <p className="muted" style={{ fontSize: '0.9rem', marginBottom: 20 }}>
                Hemos enviado un código a <strong>{resetEmail}</strong>. Introdúcelo junto a tu nueva contraseña.
            </p>
            <div className="form-row">
                <label>Código de 6 dígitos</label>
                <input type="text" value={resetCode} onChange={e => setResetCode(e.target.value)} required placeholder="123456" maxLength="6" style={{ textAlign: 'center', letterSpacing: 4, fontWeight: 'bold' }} />
            </div>
            <div className="form-row">
                <label>Nueva contraseña</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength="8" />
            </div>
            <div className="form-row">
                <label>Confirmar nueva contraseña</label>
                <input type="password" value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)} required minLength="8" />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn" type="submit" disabled={loading}>
                    {loading ? 'Restableciendo...' : 'Cambiar contraseña'}
                </button>
                <button type="button" className="btn secondary" onClick={() => { setView('reset_request'); setError(null); }}>Atrás</button>
            </div>
            {error && <div style={{ color: 'var(--danger)', marginTop: 10, fontSize: '0.9rem' }}>{error}</div>}
        </form>
    );

    return (
        <form className="card" onSubmit={submit} style={{ maxWidth: 420 }}>
            <h3 style={{ marginTop: 0 }}>Iniciar sesión</h3>


            <div className="form-row">
                <label>Usuario</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
            </div>
            <div className="form-row">
                <label>Contraseña</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                <div style={{ textAlign: 'right', marginTop: 4 }}>
                    <a href="#" onClick={(e) => { e.preventDefault(); setView('reset_request'); setError(null); setSuccess(null); }} style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>
                        ¿Olvidaste tu contraseña?
                    </a>
                </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn" type="submit" disabled={loading}>
                    {loading ? 'Entrando...' : 'Entrar'}
                </button>
                <button type="button" className="btn secondary" onClick={() => { setUsername(''); setPassword(''); setError(null); }}>Limpiar</button>
            </div>
            {error && <div style={{ color: 'var(--danger)', marginTop: 10, fontSize: '0.9rem' }}>{error}</div>}
            {success && <div style={{ color: 'var(--success)', marginTop: 10, fontSize: '0.9rem' }}>{success}</div>}

            {onShowRegister && (
                <div style={{ marginTop: 16, textAlign: 'center', paddingTop: 16, borderTop: '1px solid var(--muted)' }}>
                    <span className="muted">¿No tienes cuenta?</span>{' '}
                    <a href="#" onClick={(e) => { e.preventDefault(); onShowRegister(); }} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        Crear cuenta
                    </a>
                </div>
            )}
        </form>
    );
}
