export function isStorageManagerSupported(): boolean {
    return (
        typeof navigator !== 'undefined' &&
        'storage' in navigator &&
        typeof navigator.storage?.persist === 'function'
    );
}

export async function isPersisted(): Promise<boolean> {
    if (!isStorageManagerSupported()) return false;
    try {
        return await navigator.storage.persisted();
    } catch {
        return false;
    }
}

export async function requestPersist(): Promise<boolean> {
    if (!isStorageManagerSupported()) return false;
    try {
        if (await navigator.storage.persisted()) return true;
        return await navigator.storage.persist();
    } catch {
        return false;
    }
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number; usageRatio: number } | null> {
    if (!isStorageManagerSupported() || typeof navigator.storage.estimate !== 'function') return null;
    try {
        const { usage = 0, quota = 0 } = await navigator.storage.estimate();
        return { usage, quota, usageRatio: quota > 0 ? usage / quota : 0 };
    } catch {
        return null;
    }
}

export function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
