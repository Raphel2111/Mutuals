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

    const handleOAuthLogin = (provider) => {
        // Redirect to backend OAuth URL
        window.location.href = `${backendBase}/auth/login/${provider}/`;
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
            setError(err.response?.data?.detail || err.response?.data?.email?.[0] || 'Error al solicitar el código');
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

            {/* OAuth Login Buttons */}
            <div style={{ marginBottom: 20 }}>
                <button
                    type="button"
                    className="btn"
                    onClick={() => handleOAuthLogin('google-oauth2')}
                    style={{
                        width: '100%',
                        marginBottom: 10,
                        backgroundColor: '#4285F4',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8
                    }}
                >
                    <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                    Continuar con Google
                </button>

                <button
                    type="button"
                    className="btn"
                    onClick={() => handleOAuthLogin('facebook')}
                    style={{
                        width: '100%',
                        backgroundColor: '#1877F2',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8
                    }}
                >
                    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Continuar con Facebook
                </button>
            </div>

            <div style={{
                textAlign: 'center',
                margin: '20px 0',
                color: 'var(--muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 10
            }}>
                <div style={{ flex: 1, height: 1, backgroundColor: 'var(--muted)' }}></div>
                <span>O con usuario y contraseña</span>
                <div style={{ flex: 1, height: 1, backgroundColor: 'var(--muted)' }}></div>
            </div>

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
