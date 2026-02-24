import axios from 'axios';

// Use environment variable for backend URL
const BACKEND_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const API_BASE = BACKEND_BASE + '/api/';

const instance = axios.create({
    baseURL: API_BASE,
    headers: { 'Content-Type': 'application/json' }
});

// Attach token from localStorage if present
instance.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor to handle token refresh
let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(token) {
    refreshSubscribers.map(cb => cb(token));
}

function addRefreshSubscriber(cb) {
    refreshSubscribers.push(cb);
}

instance.interceptors.response.use(undefined, async (error) => {
    const originalRequest = error.config;

    // Manejar error de email no verificado
    if (error.response && error.response.status === 403) {
        const data = error.response.data;
        if (data && data.error_code === 'EMAIL_NOT_VERIFIED') {
            // Disparar evento personalizado para que App.jsx lo maneje
            window.dispatchEvent(new CustomEvent('email-not-verified', { detail: data }));
            return Promise.reject(error);
        }
    }

    if (error.response && error.response.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
            if (isRefreshing) {
                return new Promise((resolve) => {
                    addRefreshSubscriber((token) => {
                        originalRequest.headers['Authorization'] = 'Bearer ' + token;
                        resolve(instance(originalRequest));
                    });
                });
            }
            isRefreshing = true;
            try {
                const resp = await axios.post(BACKEND_BASE + '/api/token/refresh/', { refresh: refreshToken });
                const newToken = resp.data.access;
                localStorage.setItem('access_token', newToken);
                instance.defaults.headers.common['Authorization'] = 'Bearer ' + newToken;
                onRefreshed(newToken);
                refreshSubscribers = [];
                isRefreshing = false;
                originalRequest.headers['Authorization'] = 'Bearer ' + newToken;
                return instance(originalRequest);
            } catch (e) {
                isRefreshing = false;
                refreshSubscribers = [];
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                window.location.reload();
                return Promise.reject(e);
            }
        }
    }
    return Promise.reject(error);
});

export function getBackendUrl(path) {
    if (!path) return API_BASE;
    if (path.startsWith('/')) return BACKEND_BASE + path;
    return API_BASE + path;
}

// Magic Link and Guest Checkout flows
export const sendMagicLink = async (email) => {
    return instance.post('users/magic-login/', { email });
};

export const fetchInterestTags = async () => {
    return instance.get('interest-tags/');
};

// Club APIs
export const fetchClubs = async () => {
    return instance.get('clubs/');
};

export const joinClub = async (id, message = '') => {
    return instance.post(`clubs/${id}/join/`, { message });
};

export const fetchClubMemberships = async () => {
    return instance.get('club-memberships/');
};

export { API_BASE as apiBase, BACKEND_BASE as backendBase };

// Social Radar / Icebreaker APIs
export const fetchMutualMatches = async (eventId) => {
    return instance.get(`events/${eventId}/mutual_matches/`);
};

export const updateAvailabilityStatus = async (available) => {
    return instance.patch('users/me/', { availability_status: available });
};

export default instance;
