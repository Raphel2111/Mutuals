import React, { useState, useEffect } from 'react';
import BrandLogo from './components/BrandLogo';
import EventList from './pages/EventList';
import RegistrationList from './pages/RegistrationList';
import Wallet from './pages/Wallet';
import ClubList from './pages/ClubList';
import SocialRadar from './pages/SocialRadar';
import JoinClub from './pages/JoinClub';
import UserProfile from './pages/UserProfile';
import ProfileSettings from './pages/ProfileSettings';
import SocialProfile from './pages/SocialProfile';
import SocialLobby from './pages/SocialLobby';
import './pages/SocialProfile.css';
import NotificationCenter from './components/NotificationCenter';
import './components/NotificationCenter.css';
import QRFab from './components/QRFab';
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
    const [showLogin, setShowLogin] = useState(false);
    const [emailNotVerifiedAlert, setEmailNotVerifiedAlert] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [socialProfileId, setSocialProfileId] = useState(null);
    const [lobbyEvent, setLobbyEvent] = useState(null);
    const [radarFilter, setRadarFilter] = useState(null); // Nuevo: filtro por tag para el radar  // target user for SocialProfile view

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
            <nav className="glassmorphism">
                <div className="nav-container">
                    <div className="nav-header">
                        {/* Mobile Avatar / Left Action */}
                        <div className="mobile-only">
                            {authenticated && currentUser ? (
                                <img
                                    src={currentUser.avatar_url || currentUser.default_avatar_url}
                                    alt={currentUser.username}
                                    className="avatar-small"
                                    onClick={() => setView('profile')}
                                    onError={(e) => { e.target.src = 'https://via.placeholder.com/32?text=?' }}
                                />
                            ) : (
                                <div style={{ width: 36 }}></div>
                            )}
                        </div>

                        {/* Centered Brand */}
                        <div className="brand" onClick={() => setView('events')} style={{ cursor: 'pointer' }}>
                            <BrandLogo />
                        </div>

                        {/* Desktop Links (Center) */}
                        <div className="nav-links desktop-only">
                            <button className={`btn nav-item ${view === 'events' ? 'active' : ''}`} onClick={() => setView('events')}>Explorar</button>
                            {authenticated && (
                                <>
                                    <button className={`btn nav-item ${view === 'registrations' ? 'active' : ''}`} onClick={() => setView('registrations')}>Entradas</button>
                                    <button className={`btn nav-item ${view === 'wallet' ? 'active' : ''}`} onClick={() => setView('wallet')}>Cartera</button>
                                    <button className={`btn nav-item ${view === 'clubs' ? 'active' : ''}`} onClick={() => setView('clubs')}>Clubes</button>
                                    <button className={`btn nav-item ${view === 'radar' ? 'active' : ''}`} onClick={() => setView('radar')}>🌐 Radar</button>
                                </>
                            )}
                        </div>

                        {/* Desktop User Section & Mobile Auth Button */}
                        <div className="nav-actions">
                            {!authenticated ? (
                                <button className="btn primary btn-sm" onClick={() => setShowLogin(true)}>Acceder</button>
                            ) : currentUser ? (
                                <div className="user-profile-widget desktop-only" onClick={() => setView('profile')}>
                                    <img
                                        src={currentUser.avatar_url || currentUser.default_avatar_url}
                                        alt={currentUser.username}
                                        className="avatar-small"
                                        onError={(e) => { e.target.src = 'https://via.placeholder.com/32?text=?' }}
                                    />
                                    <button className="btn logout-btn" onClick={(e) => { e.stopPropagation(); localStorage.removeItem('access_token'); localStorage.removeItem('refresh_token'); setAuthenticated(false); }}>
                                        Salir
                                    </button>
                                </div>
                            ) : (
                                <div className="user-profile-widget desktop-only" style={{ opacity: 0.5 }}>
                                    <div className="avatar-small" style={{ backgroundColor: 'var(--surface-light)' }}></div>
                                    <button className="btn logout-btn" disabled>Cargando...</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            <div style={{ flex: 1 }} className="pb-safe">
                {/* Auth Flow: If unauthenticated and not on public views, show Login/Register */}
                {!authenticated && view !== 'join' && (showLogin || showRegister || view !== 'events') ? (
                    showRegister ? (
                        <ErrorBoundary>
                            <Register
                                onRegisterSuccess={() => { setShowRegister(false); setShowLogin(false); }}
                                onBackToLogin={() => { setShowRegister(false); setShowLogin(true); }}
                            />
                        </ErrorBoundary>
                    ) : (
                        <Login
                            onLogin={() => {
                                setAuthenticated(true);
                                setShowRegister(false);
                                setShowLogin(false);
                            }}
                            onShowRegister={() => { setShowLogin(false); setShowRegister(true); }}
                        />
                    )
                ) : (
                    <>
                        {view === 'events' && (
                            <ErrorBoundary>
                                <EventList
                                    onJoinLobby={(ev) => {
                                        setLobbyEvent(ev);
                                        setView('lobby');
                                    }}
                                />
                            </ErrorBoundary>
                        )}
                        {view === 'lobby' && authenticated && lobbyEvent && (
                            <ErrorBoundary>
                                <SocialLobby
                                    eventId={lobbyEvent.id}
                                    eventName={lobbyEvent.name}
                                    currentUser={currentUser}
                                    onBack={() => setView('events')}
                                />
                            </ErrorBoundary>
                        )}
                        {view === 'join' && (
                            <ErrorBoundary>
                                <JoinClub
                                    token={joinToken}
                                    onSuccess={(clubId) => {
                                        window.location.hash = '';
                                        setView('clubs');
                                    }}
                                    onCancel={() => {
                                        window.location.hash = '';
                                        setView('events');
                                    }}
                                />
                            </ErrorBoundary>
                        )}
                        {view === 'registrations' && authenticated && (
                            <ErrorBoundary><RegistrationList /></ErrorBoundary>
                        )}
                        {view === 'wallet' && authenticated && (
                            <ErrorBoundary><Wallet userId={currentUser?.id} /></ErrorBoundary>
                        )}

                        {view === 'clubs' && authenticated && (
                            <ErrorBoundary><ClubList /></ErrorBoundary>
                        )}
                        {view === 'radar' && authenticated && (
                            <ErrorBoundary>
                                <SocialRadar
                                    eventId={null}
                                    currentUser={currentUser}
                                    initialFilter={radarFilter}
                                />
                            </ErrorBoundary>
                        )}
                        {view === 'profile' && authenticated && currentUser && (
                            <ErrorBoundary>
                                <UserProfile
                                    userId={currentUser.id}
                                    onBack={() => setView('events')}
                                    showVerificationAlert={emailNotVerifiedAlert}
                                    onClearAlert={() => setEmailNotVerifiedAlert(false)}
                                />
                            </ErrorBoundary>
                        )}
                        {view === 'social-profile' && (
                            <ErrorBoundary>
                                <SocialProfile
                                    userId={socialProfileId || (currentUser?.id)}
                                    currentUserId={currentUser?.id}
                                    onBack={() => setView('events')}
                                    onInterestClick={(tagName) => {
                                        setRadarFilter(tagName);
                                        setView('radar');
                                    }}
                                />
                            </ErrorBoundary>
                        )}
                    </>
                )}
            </div>

            <BottomNavigation
                activeView={view}
                onNavigate={setView}
                authenticated={authenticated}
            />

            {/* QR FAB — quick ticket access, visible only when authenticated */}
            {authenticated && (
                <QRFab onPress={() => setView('registrations')} />
            )}
        </div>
    );
}

export default App;
