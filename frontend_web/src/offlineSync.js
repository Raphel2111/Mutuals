// IndexedDB Local Sync Queue for Offline Check-Ins
// Called from Scanner View

export const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('EventoAppOfflineManager', 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('failed_scans')) {
                db.createObjectStore('failed_scans', { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const queueOfflineScan = async (registrationId, eventId) => {
    const db = await openDB();
    const tx = db.transaction('failed_scans', 'readwrite');
    const store = tx.objectStore('failed_scans');
    store.add({
        registrationId,
        eventId,
        timestamp: new Date().toISOString()
    });
};

export const syncOfflineScans = async (syncFunction) => {
    const db = await openDB();
    const tx = db.transaction('failed_scans', 'readwrite');
    const store = tx.objectStore('failed_scans');
    const req = store.getAll();

    req.onsuccess = async () => {
        const scans = req.result;
        for (const scan of scans) {
            try {
                await syncFunction(scan.registrationId, scan.eventId);
                // Remove from DB if sync success
                const delTx = db.transaction('failed_scans', 'readwrite');
                delTx.objectStore('failed_scans').delete(scan.id);
            } catch (e) {
                console.warn('Failed to sync offline scan', scan.id);
            }
        }
    };
};

// Start sync listener
window.addEventListener('online', () => {
    console.log('Back online! Syncing background data...');
    // Logic to inject the real sync function will be configured in App.jsx
});
