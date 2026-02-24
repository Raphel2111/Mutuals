import React, { useState, useEffect } from 'react';
import axios from '../api';

export default function SmartSuggestions({ eventId, onIcebreaker }) {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!eventId) return;

        const fetchMatches = async () => {
            try {
                const res = await axios.get(`events/${eventId}/mutual_matches/`);
                setMatches(res.data.matches || []);
            } catch (err) {
                console.error("Error fetching matches:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchMatches();
        // Refresh matches every 2 minutes or so, as people join/leave
        const interval = setInterval(fetchMatches, 120000);
        return () => clearInterval(interval);
    }, [eventId]);

    if (loading) return <div className="smart-suggestions-loading">Buscando conexiones...</div>;
    if (matches.length === 0) return null;

    return (
        <div className="smart-suggestions-container fade-in">
            <h3 className="suggestions-title">✨ Conexiones Inteligentes</h3>
            <div className="suggestions-list">
                {matches.slice(0, 3).map(match => (
                    <div key={match.user_id} className="suggestion-card">
                        <div className="suggestion-user">
                            <img src={match.avatar_url} alt={match.name} className="suggestion-avatar" />
                            <div className="suggestion-info">
                                <span className="suggestion-name">{match.name}</span>
                                <div className="suggestion-tags">
                                    {match.shared_tags.slice(0, 2).map(tag => (
                                        <span key={tag} className="match-tag">#{tag}</span>
                                    ))}
                                    {match.shared_tags.length > 2 && <span className="match-tag-more">+{match.shared_tags.length - 2}</span>}
                                </div>
                            </div>
                        </div>
                        <div className="icebreaker-section">
                            <p className="icebreaker-tip">{match.icebreaker_suggestion}</p>
                            <button
                                className="icebreaker-btn"
                                onClick={() => onIcebreaker(match.icebreaker_suggestion, match.name)}
                            >
                                💬 Romper el hielo
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
