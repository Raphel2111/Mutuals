import React, { useState } from 'react';
import './PostEventSurvey.css';

const RATINGS = [
    { value: 'sad', emoji: '😞', label: 'Decepcionante' },
    { value: 'neutral', emoji: '😐', label: 'Normal' },
    { value: 'love', emoji: '😍', label: 'Increíble' },
];

export default function PostEventSurvey({ event, onRate, onShare }) {
    const [selected, setSelected] = useState(null);
    const [submitted, setSubmitted] = useState(false);

    const handleSelect = async (val) => {
        setSelected(val);
        try {
            if (onRate) await onRate(event.id, val);
        } catch (_) { }
        setSubmitted(true);
    };

    if (submitted) {
        return (
            <div className="survey-card submitted fade-in">
                {selected === 'love' ? (
                    <>
                        <div className="survey-thanks-emoji">🎉</div>
                        <p className="survey-thanks-text">¡Genial! Nos alegra que lo hayas disfrutado.</p>
                        <button className="btn-share-card" onClick={() => onShare && onShare(event)}>
                            📸 Comparte tu Social Card del evento
                        </button>
                    </>
                ) : (
                    <>
                        <div className="survey-thanks-emoji">🙏</div>
                        <p className="survey-thanks-text">Gracias por tu feedback. Nos ayuda a mejorar.</p>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="survey-card fade-in">
            <p className="survey-eyebrow">POST-EVENTO</p>
            <h3 className="survey-question">¿Qué tal <span className="survey-event-name">{event?.name}</span>?</h3>
            <div className="survey-options">
                {RATINGS.map(r => (
                    <button
                        key={r.value}
                        className={`survey-emoji-btn ${selected === r.value ? 'selected' : ''}`}
                        onClick={() => handleSelect(r.value)}
                    >
                        <span className="survey-emoji">{r.emoji}</span>
                        <span className="survey-label">{r.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
