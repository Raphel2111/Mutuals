import React, { useState, useEffect } from 'react';
import axios from '../api';
import { fetchCurrentUser } from '../auth';
import { toast } from '../components/Toast';

export default function ProfileSettings({ onBack, showAlert = false }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [emailCode, setEmailCode] = useState('');
    const [phoneCode, setPhoneCode] = useState('');
    const [sendingEmailCode, setSendingEmailCode] = useState(false);
    const [sendingPhoneCode, setSendingPhoneCode] = useState(false);
    const [verifyingEmail, setVerifyingEmail] = useState(false);
    const [verifyingPhone, setVerifyingPhone] = useState(false);
    const [showEmailVerification, setShowEmailVerification] = useState(false);
    const [showPhoneVerification, setShowPhoneVerification] = useState(false);
    const [devPhoneCode, setDevPhoneCode] = useState(null);

    useEffect(() => {
        loadUser();
    }, []);

    function loadUser() {
        setLoading(true);
        fetchCurrentUser()
            .then(u => setUser(u))
            .catch(err => console.error('Error loading user:', err))
            .finally(() => setLoading(false));
    }

    function sendEmailVerification() {
        setSendingEmailCode(true);
        axios.post('users/send-email-verification/')
            .then(res => {
                toast.success('Código enviado a tu email. Revisa tu bandeja de entrada.');
                setShowEmailVerification(true);
            })
            .catch(err => {
                toast.error('Error: ' + (err.response?.data?.detail || err.message));
            })
            .finally(() => setSendingEmailCode(false));
    }

    function verifyEmail() {
        if (!emailCode.trim()) {
            toast.info('Ingresa el código de verificación');
            return;
        }

        setVerifyingEmail(true);
        axios.post('users/verify-email/', { code: emailCode })
            .then(res => {
                toast.success('¡Email verificado exitosamente!');
                setEmailCode('');
                setShowEmailVerification(false);
                loadUser();
            })
            .catch(err => {
                toast.error('Error: ' + (err.response?.data?.detail || err.message));
            })
            .finally(() => setVerifyingEmail(false));
    }

    function sendPhoneVerification() {
        setSendingPhoneCode(true);
        axios.post('users/send-phone-verification/')
            .then(res => {
                toast.success('Código enviado por SMS a tu teléfono');
                setShowPhoneVerification(true);
                // En modo desarrollo, mostrar el código
                if (res.data.dev_code) {
                    setDevPhoneCode(res.data.dev_code);
                }
            })
            .catch(err => {
                toast.error('Error: ' + (err.response?.data?.detail || err.message));
            })
            .finally(() => setSendingPhoneCode(false));
    }

    function verifyPhone() {
        if (!phoneCode.trim()) {
            toast.info('Ingresa el código de verificación');
            return;
        }

        setVerifyingPhone(true);
        axios.post('users/verify-phone/', { code: phoneCode })
            .then(res => {
                toast.success('¡Teléfono verificado exitosamente!');
                setPhoneCode('');
                setShowPhoneVerification(false);
                setDevPhoneCode(null);
                loadUser();
            })
            .catch(err => {
                toast.error('Error: ' + (err.response?.data?.detail || err.message));
            })
            .finally(() => setVerifyingPhone(false));
    }

    if (loading) return <div className="container"><p>Cargando...</p></div>;
    if (!user) return <div className="container"><p>No se pudo cargar el perfil</p></div>;

    return (
        <div className="container">
            {onBack && (
                <button className="btn secondary" onClick={onBack} style={{marginBottom:20}}>
                    ← Volver
                </button>
            )}

            <h2 style={{marginBottom:20}}>⚙️ Configuración del Perfil</h2>

            {showAlert && !user.email_verified && (
                <div style={{
                    backgroundColor:'#fee2e2',
                    border:'2px solid #ef4444',
                    borderRadius:8,
                    padding:20,
                    marginBottom:20
                }}>
                    <h3 style={{margin:0,marginBottom:10,color:'#dc2626'}}>⚠️ Verificación Requerida</h3>
                    <p style={{margin:0,color:'#7f1d1d'}}>
                        Debes verificar tu correo electrónico antes de poder acceder a los servicios de EventoApp.
                        Por favor, completa la verificación a continuación.
                    </p>
                </div>
            )}

            <div className="card" style={{marginBottom:20}}>
                <h3 style={{marginTop:0}}>Información Personal</h3>
                <div style={{display:'grid',gap:12}}>
                    <div>
                        <strong>Usuario:</strong> {user.username}
                    </div>
                    <div>
                        <strong>Email:</strong> {user.email}
                        {user.email_verified ? (
                            <span style={{marginLeft:8,color:'var(--success)',fontSize:'14px'}}>
                                ✓ Verificado
                            </span>
                        ) : (
                            <span style={{marginLeft:8,color:'var(--muted)',fontSize:'14px'}}>
                                ⚠ Sin verificar
                            </span>
                        )}
                    </div>
                    <div>
                        <strong>Teléfono:</strong> {user.phone || 'No configurado'}
                        {user.phone && (
                            user.phone_verified ? (
                                <span style={{marginLeft:8,color:'var(--success)',fontSize:'14px'}}>
                                    ✓ Verificado
                                </span>
                            ) : (
                                <span style={{marginLeft:8,color:'var(--muted)',fontSize:'14px'}}>
                                    ⚠ Sin verificar
                                </span>
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* Email Verification */}
            {!user.email_verified && user.email && (
                <div className="card" style={{marginBottom:20,backgroundColor:'#fef3c7',borderColor:'#fbbf24'}}>
                    <h3 style={{marginTop:0}}>📧 Verificar Email</h3>
                    <p className="muted">Verifica tu email para tener acceso completo a todas las funciones.</p>
                    
                    {!showEmailVerification ? (
                        <button 
                            className="btn" 
                            onClick={sendEmailVerification}
                            disabled={sendingEmailCode}
                        >
                            {sendingEmailCode ? 'Enviando...' : 'Enviar código de verificación'}
                        </button>
                    ) : (
                        <div style={{marginTop:12}}>
                            <p style={{marginBottom:12,fontSize:'14px'}}>
                                Ingresa el código de 6 dígitos que enviamos a <strong>{user.email}</strong>
                            </p>
                            <div style={{display:'flex',gap:8,alignItems:'center'}}>
                                <input
                                    type="text"
                                    placeholder="000000"
                                    value={emailCode}
                                    onChange={(e) => setEmailCode(e.target.value)}
                                    maxLength={6}
                                    style={{
                                        flex:1,
                                        padding:'10px',
                                        fontSize:'16px',
                                        letterSpacing:'4px',
                                        textAlign:'center',
                                        borderRadius:4,
                                        border:'1px solid #ddd'
                                    }}
                                />
                                <button 
                                    className="btn"
                                    onClick={verifyEmail}
                                    disabled={verifyingEmail || emailCode.length !== 6}
                                >
                                    {verifyingEmail ? 'Verificando...' : 'Verificar'}
                                </button>
                            </div>
                            <button 
                                className="btn secondary"
                                onClick={sendEmailVerification}
                                disabled={sendingEmailCode}
                                style={{marginTop:8,fontSize:'13px',padding:'4px 8px'}}
                            >
                                Reenviar código
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Phone Verification */}
            {!user.phone_verified && user.phone && (
                <div className="card" style={{marginBottom:20,backgroundColor:'#f0f9ff',borderColor:'#93c5fd'}}>
                    <h3 style={{marginTop:0}}>📱 Verificar Teléfono</h3>
                    <p className="muted">Verifica tu número de teléfono para recibir notificaciones SMS.</p>
                    
                    {!showPhoneVerification ? (
                        <button 
                            className="btn"
                            onClick={sendPhoneVerification}
                            disabled={sendingPhoneCode}
                        >
                            {sendingPhoneCode ? 'Enviando...' : 'Enviar código por SMS'}
                        </button>
                    ) : (
                        <div style={{marginTop:12}}>
                            <p style={{marginBottom:12,fontSize:'14px'}}>
                                Ingresa el código de 6 dígitos que enviamos a <strong>{user.phone}</strong>
                            </p>
                            {devPhoneCode && (
                                <div style={{
                                    padding:8,
                                    backgroundColor:'#fee2e2',
                                    borderRadius:4,
                                    marginBottom:12,
                                    fontSize:'13px',
                                    border:'1px solid #fca5a5'
                                }}>
                                    <strong>DEV MODE:</strong> Tu código es: <code style={{
                                        backgroundColor:'white',
                                        padding:'2px 8px',
                                        borderRadius:3,
                                        fontSize:'16px',
                                        letterSpacing:'2px'
                                    }}>{devPhoneCode}</code>
                                </div>
                            )}
                            <div style={{display:'flex',gap:8,alignItems:'center'}}>
                                <input
                                    type="text"
                                    placeholder="000000"
                                    value={phoneCode}
                                    onChange={(e) => setPhoneCode(e.target.value)}
                                    maxLength={6}
                                    style={{
                                        flex:1,
                                        padding:'10px',
                                        fontSize:'16px',
                                        letterSpacing:'4px',
                                        textAlign:'center',
                                        borderRadius:4,
                                        border:'1px solid #ddd'
                                    }}
                                />
                                <button 
                                    className="btn"
                                    onClick={verifyPhone}
                                    disabled={verifyingPhone || phoneCode.length !== 6}
                                >
                                    {verifyingPhone ? 'Verificando...' : 'Verificar'}
                                </button>
                            </div>
                            <button 
                                className="btn secondary"
                                onClick={sendPhoneVerification}
                                disabled={sendingPhoneCode}
                                style={{marginTop:8,fontSize:'13px',padding:'4px 8px'}}
                            >
                                Reenviar código
                            </button>
                        </div>
                    )}
                </div>
            )}

            {user.email_verified && user.phone_verified && (
                <div className="card" style={{backgroundColor:'#dcfce7',borderColor:'#86efac',textAlign:'center',padding:30}}>
                    <div style={{fontSize:'48px',marginBottom:12}}>✅</div>
                    <h3 style={{margin:0,color:'var(--success)'}}>Perfil Verificado</h3>
                    <p className="muted" style={{marginTop:8,marginBottom:0}}>
                        Tu email y teléfono están verificados
                    </p>
                </div>
            )}
        </div>
    );
}
