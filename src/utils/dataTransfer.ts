import { db } from '../db';
import { toast } from 'sonner';

export const exportData = async () => {
    try {
        const folders = await db.folders.toArray();
        const files = await db.files.toArray();
        const history = await db.history.toArray();

        const data = {
            folders,
            files,
            history,
            timestamp: new Date().toISOString(),
            version: 1
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `localnote-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Export successful');
    } catch (error) {
        console.error('Export failed', error);
        toast.error('Export failed');
    }
};

export const importData = async (file: File) => {
    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.folders || !data.files) {
            throw new Error('Invalid backup file');
        }

        await db.transaction('rw', db.folders, db.files, db.history, async () => {
            await db.folders.clear();
            await db.files.clear();
            await db.history.clear();

            await db.folders.bulkAdd(data.folders);
            await db.files.bulkAdd(data.files);
            if (data.history) {
                await db.history.bulkAdd(data.history);
            }
        });

        toast.success('Import successful');
        window.location.reload(); // Reload to refresh UI state
    } catch (error) {
        console.error('Import failed', error);
        toast.error('Import failed');
    }
};
