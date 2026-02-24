import React, { useState, useEffect, useRef } from 'react';
import { backendBase } from '../api';
import axios from 'axios';
import './EventCapsule.css';

const instance = axios.create({
    baseURL: backendBase + '/api/',
});
instance.interceptors.request.use(cfg => {
    const tok = localStorage.getItem('access_token');
    if (tok) cfg.headers['Authorization'] = `Bearer ${tok}`;
    return cfg;
});

export default function EventCapsule({ event }) {
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [locked, setLocked] = useState(false);
    const [lockMsg, setLockMsg] = useState('');
    const [caption, setCaption] = useState('');
    const fileRef = useRef(null);

    useEffect(() => {
        if (!event) return;
        // Check if wall is unlocked (2h after event.date)
        const unlockTime = new Date(new Date(event.date).getTime() + 2 * 60 * 60 * 1000);
        if (new Date() < unlockTime) {
            setLocked(true);
            setLockMsg(`El muro se desbloquea a las ${unlockTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
            setLoading(false);
            return;
        }
        loadPhotos();
    }, [event]);

    const loadPhotos = async () => {
        setLoading(true);
        try {
            const res = await instance.get(`event-photos/?event=${event.id}`);
            setPhotos(res.data.results || res.data);
        } catch (err) {
            console.error('Error loading photos', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append('event', event.id);
        fd.append('image', file);
        fd.append('caption', caption);
        try {
            await instance.post('event-photos/', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setCaption('');
            await loadPhotos();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error al subir la foto.');
        } finally {
            setUploading(false);
        }
    };

    const toggleLike = async (photoId, type) => {
        try {
            const endpoint = type === 'fire' ? `event-photos/${photoId}/fire_like/` : `event-photos/${photoId}/like/`;
            await instance.post(endpoint);
            setPhotos(prev => prev.map(p => {
                if (p.id !== photoId) return p;
                const isLiked = type === 'fire' ? p.i_fire_liked : p.i_liked;
                const countKey = type === 'fire' ? 'fire_likes_count' : 'likes_count';
                const flagKey = type === 'fire' ? 'i_fire_liked' : 'i_liked';
                return { ...p, [countKey]: p[countKey] + (isLiked ? -1 : 1), [flagKey]: !isLiked };
            }));
        } catch (err) {
            console.error(err);
        }
    };

    if (locked) return (
        <div className="capsule-locked">
            <div className="capsule-lock-icon">🔒</div>
            <h3 className="capsule-lock-title">Mutual Memories</h3>
            <p className="capsule-lock-msg">{lockMsg}</p>
            <p className="capsule-lock-sub">El muro se abre automáticamente 2 horas después del evento.</p>
        </div>
    );

    return (
        <div className="capsule-wrap">
            <div className="capsule-header">
                <h3 className="capsule-title">📸 Mutual Memories</h3>
                <p className="capsule-subtitle">Las mejores fotos de la noche, subidas por los asistentes.</p>
            </div>

            {/* Upload area */}
            <div className="capsule-upload-area">
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleUpload}
                />
                <input
                    type="text"
                    className="capsule-caption-input"
                    placeholder="Descripción (opcional)..."
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                />
                <button
                    className="capsule-upload-btn"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                >
                    {uploading ? '⏳ Subiendo...' : '📷 Subir foto'}
                </button>
                <p className="capsule-upload-hint">Máximo 3 fotos por persona.</p>
            </div>

            {/* Photo grid (asymmetric moodboard) */}
            {loading ? (
                <div className="capsule-skeleton-grid">
                    {[1, 2, 3, 4].map(i => <div key={i} className="capsule-skeleton" />)}
                </div>
            ) : photos.length === 0 ? (
                <div className="capsule-empty">
                    <span className="capsule-empty-icon">🌌</span>
                    <p>Sé el primero en compartir un momento de esta noche.</p>
                </div>
            ) : (
                <div className="capsule-grid">
                    {photos.map((photo, idx) => (
                        <div key={photo.id} className={`capsule-photo-card ${idx % 3 === 0 ? 'wide' : ''}`}>
                            <img
                                src={photo.image_url || photo.image}
                                alt={photo.caption || 'Event photo'}
                                className="capsule-img"
                            />
                            <div className="capsule-photo-overlay">
                                <div className="capsule-photo-author">
                                    <img
                                        src={photo.user?.avatar_url || `https://ui-avatars.com/api/?name=${photo.user?.username}`}
                                        alt={photo.user?.username}
                                        className="capsule-author-avatar"
                                    />
                                    <span className="capsule-author-name">{photo.user?.first_name || photo.user?.username}</span>
                                </div>
                                {photo.caption && <p className="capsule-photo-caption">{photo.caption}</p>}
                                <div className="capsule-like-row">
                                    <button
                                        className={`capsule-like-btn ${photo.i_liked ? 'active-heart' : ''}`}
                                        onClick={() => toggleLike(photo.id, 'heart')}
                                    >
                                        ❤️ {photo.likes_count}
                                    </button>
                                    <button
                                        className={`capsule-like-btn ${photo.i_fire_liked ? 'active-fire' : ''}`}
                                        onClick={() => toggleLike(photo.id, 'fire')}
                                    >
                                        🔥 {photo.fire_likes_count}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
