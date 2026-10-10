const DB_NAME = 'st-mynovelai';
const DB_VERSION = 1;
const STORE = 'previews';

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function savePreview(record) {
    if (!record?.id || !record?.base64) throw new TypeError('preview id and base64 are required');
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put({ ...record, updatedAt: Date.now() });
        tx.oncomplete = () => resolve(record);
        tx.onerror = () => reject(tx.error);
    });
}

export async function getPreview(id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const request = db.transaction(STORE).objectStore(STORE).get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

export async function listPreviews() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const request = db.transaction(STORE).objectStore(STORE).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

export async function deletePreview(id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

export async function clearExpiredPreviews(maxAgeMs) {
    const cutoff = Date.now() - Math.max(0, Number(maxAgeMs) || 0);
    const previews = await listPreviews();
    await Promise.all(previews.filter(item => Number(item.updatedAt) < cutoff).map(item => deletePreview(item.id)));
    return previews.filter(item => Number(item.updatedAt) < cutoff).length;
}
