import React, { useState } from 'react';
import { getApiUrl } from '../api';
import { toast } from './Toast';

const ShareButton = ({ registrationId, inviteLink }) => {
    const [loading, setLoading] = useState(false);

    // Re-use logic to get base URL
    const baseUrl = getApiUrl();
    const socialCardUrl = `${baseUrl}api/social-card/${registrationId}/`;

    const handleShare = async () => {
        setLoading(true);
        if (navigator.share) {
            try {
                const token = localStorage.getItem('access_token');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};

                // Fetch image as blob
                const response = await fetch(socialCardUrl, { headers });
                if (!response.ok) throw new Error('Error fetching image');

                const blob = await response.blob();
                const file = new File([blob], 'mi_entrada.jpg', { type: 'image/jpeg' });

                // native share modal
                await navigator.share({
                    title: '¡Voy a este evento!',
                    text: 'Vente a esta fiesta. Pilla tu entrada aquí:',
                    url: inviteLink,
                    files: [file]
                });
            } catch (error) {
                console.error('Error compartiendo:', error);
                fallbackShare();
            }
        } else {
            fallbackShare();
        }
        setLoading(false);
    };

    const fallbackShare = () => {
        navigator.clipboard.writeText(inviteLink);
        toast.info('¡Enlace de invitación copiado en portapapeles!');
    };

    return (
        <button
            className={`share-button ${loading ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={handleShare}
            disabled={loading}
            style={{
                background: 'linear-gradient(to right, #ec4899, #f97316)',
                color: 'white',
                borderRadius: '0.5rem',
                padding: '1rem',
                fontWeight: 'bold',
                width: '100%',
                cursor: 'pointer',
                border: 'none',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '1rem',
                transition: 'transform 0.1s active:scale-95'
            }}
        >
            {loading ? 'Generando imagen...' : '📸 Compartir en IG/WhatsApp'}
        </button>
    );
};

export default ShareButton;
