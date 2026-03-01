import React, { useState, useEffect } from 'react';
import { fetchInterestTags, fetchCurrentUser, updateUserInterests, discoverClubsByInterests, discoverPeople, createInterestTag } from '../api';
import './SocialRadar.css';

const CATEGORY_ICONS = {
    'Arte': '🎨', 'Entretenimiento': '🎬', 'Gaming': '🎮',
    'Cultura': '📚', 'Lifestyle': '🌿', 'Deportes': '⚽',
    'Tech': '💻', 'Social': '🤝', 'General': '📌',
};

export default function SocialRadar({ onOpenClub, onOpenProfile, initialFilter }) {
    const [user, setUser] = useState(null);
    const [allTags, setAllTags] = useState([]);
    const [myTagIds, setMyTagIds] = useState(new Set());
    const [clubs, setClubs] = useState([]);
    const [people, setPeople] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeCategory, setActiveCategory] = useState('all');
    const [tab, setTab] = useState('interests');
    const [tagSearch, setTagSearch] = useState('');
    const [newTagName, setNewTagName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => { loadAll(); }, []);

    // Auto-fill search if opened via interest click
    useEffect(() => {
        if (initialFilter) {
            setTagSearch(initialFilter);
            setTab('interests');
        }
    }, [initialFilter]);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [tagsRes, userRes] = await Promise.all([
                fetchInterestTags(),
                fetchCurrentUser(),
            ]);
            const tags = tagsRes.data?.results || tagsRes.data || [];
            setAllTags(tags);
            const u = userRes.data;
            setUser(u);
            const ids = new Set((u.interests || []).map(i => typeof i === 'object' ? i.id : i));
            setMyTagIds(ids);
            if (ids.size > 0) loadDiscovery();
        } catch (err) {
            console.error('Radar load error:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadDiscovery = async () => {
        try {
            const [clubsRes, peopleRes] = await Promise.all([
                discoverClubsByInterests(),
                discoverPeople(),
            ]);
            setClubs(clubsRes.data?.clubs || []);
            setPeople(peopleRes.data?.people || []);
        } catch (err) {
            console.error('Discovery error:', err);
        }
    };

    const toggleTag = async (tagId) => {
        const newIds = new Set(myTagIds);
        if (newIds.has(tagId)) newIds.delete(tagId);
        else newIds.add(tagId);
        setMyTagIds(newIds);
        setSaving(true);
        try {
            await updateUserInterests(user.id, [...newIds]);
            if (newIds.size > 0) loadDiscovery();
            else { setClubs([]); setPeople([]); }
        } catch (err) {
            console.error('Error updating interests:', err);
            setMyTagIds(myTagIds);
        } finally {
            setSaving(false);
        }
    };

    const handleCreateTag = async () => {
        const name = newTagName.trim();
        if (!name) return;
        setCreating(true);
        try {
            const res = await createInterestTag(name);
            const newTag = res.data;
            // Add to list if not already there
            setAllTags(prev => {
                if (prev.find(t => t.id === newTag.id)) return prev;
                return [...prev, newTag];
            });
            // Auto-select the new tag
            const newIds = new Set(myTagIds);
            newIds.add(newTag.id);
            setMyTagIds(newIds);
            await updateUserInterests(user.id, [...newIds]);
            setNewTagName('');
            if (newIds.size > 0) loadDiscovery();
        } catch (err) {
            console.error('Error creating tag:', err);
        } finally {
            setCreating(false);
        }
    };

    // Group tags by category
    const categories = [...new Set(allTags.map(t => t.category).filter(Boolean))];

    // Filter tags by search and category
    const filteredTags = allTags.filter(t => {
        const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
        const matchesSearch = !tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    // Check if search has no results (suggest creating)
    const noResults = tagSearch && filteredTags.length === 0;

    if (loading) return (
        <div className="radar-page">
            <div className="radar-hero">
                <h1 className="radar-title">🔭 Radar</h1>
                <p className="radar-subtitle">Cargando tu radar de conexiones...</p>
            </div>
            <div className="radar-skeleton">
                {[...Array(6)].map((_, i) => <div key={i} className="skeleton-chip" />)}
            </div>
        </div>
    );

    return (
        <div className="radar-page">
            {/* Hero */}
            <div className="radar-hero">
                <h1 className="radar-title">🔭 Radar</h1>
                <p className="radar-subtitle">
                    Selecciona tus intereses y descubre clubs y personas que comparten tus gustos.
                </p>
            </div>

            {/* Tab bar */}
            <div className="radar-tabs">
                <button className={`radar-tab ${tab === 'interests' ? 'active' : ''}`} onClick={() => setTab('interests')}>
                    🎯 Mis Intereses {myTagIds.size > 0 && <span className="radar-tab-badge">{myTagIds.size}</span>}
                </button>
                <button className={`radar-tab ${tab === 'clubs' ? 'active' : ''}`} onClick={() => setTab('clubs')}>
                    🏛️ Clubs {clubs.length > 0 && <span className="radar-tab-badge">{clubs.length}</span>}
                </button>
                <button className={`radar-tab ${tab === 'people' ? 'active' : ''}`} onClick={() => setTab('people')}>
                    👥 Gente {people.length > 0 && <span className="radar-tab-badge">{people.length}</span>}
                </button>
            </div>

            {/* ── MY INTERESTS ── */}
            {tab === 'interests' && (
                <div className="radar-section">
                    <div className="radar-section-header">
                        <h2>🎯 Mis Intereses</h2>
                        <p className="radar-section-desc">
                            Toca para añadir o quitar. ¿No encuentras el tuyo? Búscalo o créalo abajo.
                        </p>
                        {saving && <span className="radar-saving">Guardando...</span>}
                    </div>

                    {/* Search bar */}
                    <div className="radar-search-wrap">
                        <span className="radar-search-icon">🔍</span>
                        <input
                            className="radar-search"
                            type="text"
                            placeholder="Buscar intereses..."
                            value={tagSearch}
                            onChange={e => setTagSearch(e.target.value)}
                        />
                        {tagSearch && (
                            <button className="radar-search-clear" onClick={() => setTagSearch('')}>✕</button>
                        )}
                    </div>

                    {/* Category filter pills (hidden when searching) */}
                    {!tagSearch && (
                        <div className="radar-category-pills">
                            <button className={`radar-pill ${activeCategory === 'all' ? 'active' : ''}`}
                                onClick={() => setActiveCategory('all')}>✨ Todo</button>
                            {categories.map(cat => (
                                <button key={cat}
                                    className={`radar-pill ${activeCategory === cat ? 'active' : ''}`}
                                    onClick={() => setActiveCategory(cat)}>
                                    {CATEGORY_ICONS[cat] || '📌'} {cat}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Interest chips */}
                    <div className="radar-chips">
                        {filteredTags.map(tag => (
                            <button key={tag.id}
                                className={`radar-chip ${myTagIds.has(tag.id) ? 'selected' : ''}`}
                                onClick={() => toggleTag(tag.id)}>
                                {tag.name}
                                {myTagIds.has(tag.id) && <span className="chip-check">✓</span>}
                            </button>
                        ))}
                    </div>

                    {/* No results → Create new tag */}
                    {noResults && (
                        <div className="radar-create-tag">
                            <p>No se encontró "<strong>{tagSearch}</strong>"</p>
                            <button className="radar-create-btn" onClick={() => { setNewTagName(tagSearch); setTagSearch(''); }}
                                disabled={creating}>
                                ➕ Crear "{tagSearch}"
                            </button>
                        </div>
                    )}

                    {/* Create new tag input */}
                    <div className="radar-new-tag">
                        <input
                            className="radar-new-tag-input"
                            type="text"
                            placeholder="✏️ Crear nuevo interés..."
                            value={newTagName}
                            onChange={e => setNewTagName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
                            maxLength={50}
                        />
                        <button className="radar-new-tag-btn" onClick={handleCreateTag}
                            disabled={creating || !newTagName.trim()}>
                            {creating ? '...' : '➕'}
                        </button>
                    </div>

                    {myTagIds.size > 0 && (
                        <div className="radar-cta-row">
                            <p className="radar-match-hint">
                                ✨ {myTagIds.size} interés{myTagIds.size !== 1 ? 'es' : ''} seleccionado{myTagIds.size !== 1 ? 's' : ''}
                                {clubs.length > 0 && ` — ${clubs.length} club${clubs.length !== 1 ? 's' : ''}`}
                                {people.length > 0 && ` · ${people.length} persona${people.length !== 1 ? 's' : ''}`}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* ── CLUBS MATCHING ── */}
            {tab === 'clubs' && (
                <div className="radar-section">
                    <div className="radar-section-header">
                        <h2>🏛️ Clubs para ti</h2>
                        <p className="radar-section-desc">Clubs que comparten tus intereses, ordenados por coincidencia.</p>
                    </div>

                    {myTagIds.size === 0 ? (
                        <div className="radar-empty">
                            <span className="radar-empty-icon">🎯</span>
                            <p>Añade intereses en la pestaña <strong>"Mis Intereses"</strong> para descubrir clubs.</p>
                        </div>
                    ) : clubs.length === 0 ? (
                        <div className="radar-empty">
                            <span className="radar-empty-icon">🔭</span>
                            <p>Aún no hay clubs que coincidan con tus intereses. ¡Pronto habrá más!</p>
                        </div>
                    ) : (
                        <div className="radar-clubs-grid">
                            {clubs.map(club => (
                                <div key={club.id} className="radar-club-card"
                                    onClick={() => onOpenClub?.(club.id)}>
                                    <div className="radar-club-header">
                                        <div className="radar-club-avatar">
                                            {club.image_url
                                                ? <img src={club.image_url} alt={club.name} />
                                                : <span>{club.name.slice(0, 2).toUpperCase()}</span>}
                                        </div>
                                        <div className="radar-club-info">
                                            <h3>{club.name}</h3>
                                            <p className="radar-club-meta">
                                                👥 {club.members_count} miembros
                                                {club.is_private && ' · 🔒 Privado'}
                                            </p>
                                        </div>
                                        <div className="radar-match-score">
                                            <span className="score-number">{club.match_score}</span>
                                            <span className="score-label">match{club.match_score !== 1 ? 'es' : ''}</span>
                                        </div>
                                    </div>
                                    {club.description && (
                                        <p className="radar-club-desc">{club.description.slice(0, 100)}{club.description.length > 100 ? '…' : ''}</p>
                                    )}
                                    <div className="radar-shared-tags">
                                        {(club.tags || [])
                                            .filter(t => club.shared_tag_ids?.includes(t.id))
                                            .map(t => <span key={t.id} className="radar-shared-chip">{t.name}</span>)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── PEOPLE MATCHING ── */}
            {tab === 'people' && (
                <div className="radar-section">
                    <div className="radar-section-header">
                        <h2>👥 Gente como tú</h2>
                        <p className="radar-section-desc">Personas con gustos similares a los tuyos.</p>
                    </div>

                    {myTagIds.size === 0 ? (
                        <div className="radar-empty">
                            <span className="radar-empty-icon">🎯</span>
                            <p>Añade intereses en la pestaña <strong>"Mis Intereses"</strong> para descubrir gente.</p>
                        </div>
                    ) : people.length === 0 ? (
                        <div className="radar-empty">
                            <span className="radar-empty-icon">🌐</span>
                            <p>Aún no hay gente con tus mismos intereses. ¡Invita a tus amigos!</p>
                        </div>
                    ) : (
                        <div className="radar-people-grid">
                            {people.map(person => (
                                <div key={person.id} className="radar-person-card"
                                    onClick={() => onOpenProfile?.(person.id)}>
                                    <div className="radar-person-avatar">
                                        {person.avatar_url
                                            ? <img src={person.avatar_url} alt={person.username} />
                                            : <span>{(person.full_name || person.username).slice(0, 2).toUpperCase()}</span>}
                                    </div>
                                    <div className="radar-person-info">
                                        <h4>{person.full_name || person.username}</h4>
                                        <p className="radar-person-username">@{person.username}</p>
                                        {person.bio && <p className="radar-person-bio">{person.bio.slice(0, 80)}{person.bio.length > 80 ? '…' : ''}</p>}
                                    </div>
                                    <div className="radar-match-score">
                                        <span className="score-number">{person.match_score}</span>
                                        <span className="score-label">match{person.match_score !== 1 ? 'es' : ''}</span>
                                    </div>
                                    <div className="radar-shared-tags">
                                        {(person.interests || [])
                                            .filter(t => person.shared_tag_ids?.includes(t.id))
                                            .map(t => <span key={t.id} className="radar-shared-chip">{t.name}</span>)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
