import React, { useState, useEffect } from 'react';
import BrandLogo from './components/BrandLogo';
import EventList from './pages/EventList';
import RegistrationList from './pages/RegistrationList';
import GroupList from './pages/GroupList';
import JoinGroup from './pages/JoinGroup';
import UserProfile from './pages/UserProfile';
import ProfileSettings from './pages/ProfileSettings';

import Login from './pages/Login';
import Register from './pages/Register';
import { fetchCurrentUser } from './auth';
import ErrorBoundary from './ErrorBoundary';

import ProfileCompletionModal from './components/ProfileCompletionModal';

import BottomNavigation from './components/BottomNavigation';

function App() {
    const [view, setView] = useState('events');
    const [authenticated, setAuthenticated] = useState(!!localStorage.getItem('access_token'));
    const [currentUser, setCurrentUser] = useState(null);
    const [joinToken, setJoinToken] = useState(null);
    const [showRegister, setShowRegister] = useState(false);
    const [emailNotVerifiedAlert, setEmailNotVerifiedAlert] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Check if user needs to complete profile
    const needsProfileCompletion = authenticated && currentUser && (!currentUser.first_name || !currentUser.last_name);

    // Escuchar evento de email no verificado
    // Escuchar evento de email no verificado
    /*
    useEffect(() => {
        const handleEmailNotVerified = (event) => {
                    setEmailNotVerifiedAlert(true);
                setView('profile'); // Redirigir al perfil para verificación
        };

                window.addEventListener('email-not-verified', handleEmailNotVerified);
        return () => window.removeEventListener('email-not-verified', handleEmailNotVerified);
    }, []);
                */

    // Verificar automáticamente al cargar usuario si no está verificado
    // Verificar automáticamente al cargar usuario si no está verificado
    /*
    useEffect(() => {
        if (currentUser && !currentUser.email_verified && authenticated) {
                    setView('profile'); // Abrir automáticamente el perfil
                setEmailNotVerifiedAlert(true);
        }
    }, [currentUser, authenticated]);
                */

    // Handle URL hash routing for invitations and OAuth
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;

            // Handle OAuth success callback
            const oauthMatch = hash.match(/#\/oauth-success\?access=(.+?)&refresh=(.+)/);
            if (oauthMatch) {
                const accessToken = oauthMatch[1];
                const refreshToken = oauthMatch[2];

                // Save tokens
                localStorage.setItem('access_token', accessToken);
                localStorage.setItem('refresh_token', refreshToken);

                // Update auth state
                setAuthenticated(true);

                // Redirect to events page
                window.location.hash = '#/';
                setView('events');

                // Fetch user data
                fetchCurrentUser()
                    .then(user => {
                        setCurrentUser(user);
                        console.log('OAuth login successful:', user);
                    })
                    .catch(err => {
                        console.error('Error fetching user after OAuth:', err);
                    });

                return;
            }

            // Handle OAuth error
            const errorMatch = hash.match(/#\/login\?error=(.+)/);
            if (errorMatch) {
                alert('Error al iniciar sesión con OAuth. Por favor intenta de nuevo.');
                window.location.hash = '#/';
                return;
            }

            // Handle invitation links
            const joinMatch = hash.match(/#\/join\/(.+)/);
            if (joinMatch) {
                setJoinToken(joinMatch[1]);
                setView('join');
            }
        };

        handleHashChange(); // Check on mount
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    useEffect(() => {
        const onStorage = () => setAuthenticated(!!localStorage.getItem('access_token'));
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    useEffect(() => {
        let mounted = true;
        async function load() {
            if (!authenticated) {
                setCurrentUser(null);
                return;
            }
            const u = await fetchCurrentUser();
            if (mounted) setCurrentUser(u);
        }
        load();
        return () => { mounted = false };
    }, [authenticated]);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {needsProfileCompletion && (
                <ProfileCompletionModal
                    user={currentUser}
                    onComplete={(updatedUser) => setCurrentUser(updatedUser)}
                />
            )}
            <nav>
                <div className="nav-container">
                    <div className="nav-header">
                        <div className="brand" onClick={() => setView('events')} style={{ cursor: 'pointer' }}>
                            <BrandLogo />
                            <h1 style={{ margin: 0, fontSize: '1.5em' }}>La Terreta</h1>
                        </div>
                        {/* Mobile Menu Button Removed in favor of Bottom Nav (hidden via CSS) */}
                        <div className="mobile-menu-btn" style={{ display: 'none' }}></div>

                        {/* Auth buttons for mobile header if needed, but usually in bottom nav profiles or separate */}
                        {!authenticated && (
                            <div className="mobile-auth-btn" style={{ display: 'none' }}>
                                {/* Placeholder if we want login button in header on mobile */}
                            </div>
                        )}

                        {/* Desktop User Section (Visible > 768px via CSS) */}
                        <div className="nav-user-section desktop-only" style={{ marginLeft: 'auto', display: 'flex' }}>
                            {currentUser ? (
                                <div className="user-profile-widget">
                                    <div className="user-info" onClick={() => setView('profile')}>
                                        {currentUser.avatar_url ? (
                                            <img src={currentUser.avatar_url} alt={currentUser.username} className="avatar-small" />
                                        ) : (
                                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.username)}&background=random&size=40`} alt={currentUser.username} className="avatar-small" />
                                        )}
                                        <div className="user-details">
                                            <span className="username">{currentUser.username}</span>
                                        </div>
                                    </div>
                                    <button className="btn logout-btn" onClick={() => { localStorage.removeItem('access_token'); localStorage.removeItem('refresh_token'); setAuthenticated(false); }}>
                                        Salir
                                    </button>
                                </div>
                            ) : (
                                <div className="auth-buttons">
                                    {!showRegister ? (
                                        <button className="btn primary" onClick={() => setShowRegister(true)}>Acceder</button>
                                    ) : (
                                        <button className="btn secondary" onClick={() => setShowRegister(false)}>Login</button>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>

                    <div className="nav-links">
                        <button className={`btn nav-item ${view === 'events' ? 'active' : ''}`} onClick={() => setView('events')}>📅 Eventos</button>
                        {authenticated && (
                            <>
                                <button className={`btn nav-item ${view === 'registrations' ? 'active' : ''}`} onClick={() => setView('registrations')}>🎟️ Mis Entradas</button>
                                <button className={`btn nav-item ${view === 'groups' ? 'active' : ''}`} onClick={() => setView('groups')}>👥 Mis Grupos</button>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            <div style={{ flex: 1 }} className="pb-safe">
                {!authenticated && view !== 'join' && !showRegister && view !== 'registrations' && view !== 'groups' && view !== 'profile' && (
                    <Login
                        onLogin={() => {
                            setAuthenticated(true);
                            setShowRegister(false);
                            setView('events');
                        }}
                        onShowRegister={() => setShowRegister(true)}
                    />
                )}
                {!authenticated && showRegister && (
                    <ErrorBoundary>
                        <Register
                            onRegisterSuccess={() => {
                                setShowRegister(false);
                            }}
                            onBackToLogin={() => setShowRegister(false)}
                        />
                    </ErrorBoundary>
                )}
                {view === 'join' && (
                    <ErrorBoundary>
                        <JoinGroup
                            token={joinToken}
                            onSuccess={(groupId) => {
                                window.location.hash = '';
                                setView('groups');
                            }}
                            onCancel={() => {
                                window.location.hash = '';
                                setView('events');
                            }}
                        />
                    </ErrorBoundary>
                )}
                {view === 'events' && (
                    <ErrorBoundary><EventList /></ErrorBoundary>
                )}
                {view === 'registrations' && authenticated ? (
                    <ErrorBoundary><RegistrationList /></ErrorBoundary>
                ) : view === 'registrations' ? (
                    <div className="container">
                        <div className="card" style={{ textAlign: 'center' }}>
                            <h3>Debes iniciar sesión</h3>
                            <p className="muted">Para ver tus entradas, accede con tu cuenta.</p>
                            <button className="btn full" onClick={() => { setShowRegister(true); }}>Acceder / Registrarse</button>
                        </div>
                    </div>
                ) : null}
                {view === 'groups' && authenticated ? (
                    <ErrorBoundary><GroupList /></ErrorBoundary>
                ) : view === 'groups' ? (
                    <div className="container">
                        <div className="card" style={{ textAlign: 'center' }}>
                            <h3>Debes iniciar sesión</h3>
                            <p className="muted">Para ver tus grupos, accede con tu cuenta.</p>
                            <button className="btn full" onClick={() => { setShowRegister(true); }}>Acceder / Registrarse</button>
                        </div>
                    </div>
                ) : null}
                {view === 'profile' && authenticated && currentUser ? (
                    <ErrorBoundary>
                        <UserProfile
                            userId={currentUser.id}
                            onBack={() => setView('events')}
                            showVerificationAlert={emailNotVerifiedAlert}
                            onClearAlert={() => setEmailNotVerifiedAlert(false)}
                        />
                    </ErrorBoundary>
                ) : view === 'profile' ? (
                    <div className="container">
                        {!authenticated && !showRegister ? (
                            <Login
                                onLogin={() => {
                                    setAuthenticated(true);
                                    setShowRegister(false);
                                    setView('profile');
                                }}
                                onShowRegister={() => setShowRegister(true)}
                            />
                        ) : (
                            <div className="card" style={{ textAlign: 'center' }}>
                                <h2>Acceso restringido</h2>
                                <p>Debes iniciar sesión para ver tu perfil</p>
                                <button className="btn" onClick={() => setShowRegister(true)}>Acceder</button>
                            </div>
                        )}
                    </div>
                ) : null}

            </div>

            <BottomNavigation
                activeView={view}
                onNavigate={setView}
                authenticated={authenticated}
            />
        </div>
    );
}

export default App;
