import { db } from '../db';
import { toast } from 'sonner';

function sanitizeFilename(s: string): string {
    return (s.trim() || 'untitled').replace(/[<>:"/\\|?*]/g, '_');
}

function downloadJson(filename: string, data: object) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export const exportData = async () => {
    try {
        const folders = await db.folders.toArray();
        const files = await db.files.toArray();
        const history = await db.history.toArray();
        downloadJson(
            `localnote-backup-${new Date().toISOString().slice(0, 10)}.json`,
            { folders, files, history, timestamp: new Date().toISOString(), version: 1 }
        );
        toast.success('Export successful');
    } catch (error) {
        console.error('Export failed', error);
        toast.error('Export failed');
    }
};

export const exportFile = async (fileId: number) => {
    try {
        const file = await db.files.get(fileId);
        if (!file) throw new Error('File not found');
        const name = sanitizeFilename(file.title);
        downloadJson(
            `localnote-page-${name}-${new Date().toISOString().slice(0, 10)}.json`,
            { kind: 'page', file, timestamp: new Date().toISOString(), version: 1 }
        );
        toast.success('エクスポートしました');
    } catch (error) {
        console.error('Export failed', error);
        toast.error('Export failed');
    }
};

export const exportFolder = async (folderId: number) => {
    try {
        const rootFolder = await db.folders.get(folderId);
        if (!rootFolder) throw new Error('Folder not found');

        // BFS で配下フォルダを収集
        const allFolders = [rootFolder];
        const queue = [folderId];
        while (queue.length > 0) {
            const parentId = queue.shift()!;
            const children = await db.folders.where('parentId').equals(parentId).toArray();
            allFolders.push(...children);
            queue.push(...children.map(f => f.id!));
        }

        const folderIds = allFolders.map(f => f.id!);
        const allFiles = await db.files.where('folderId').anyOf(folderIds).toArray();
        const name = sanitizeFilename(rootFolder.name);

        downloadJson(
            `localnote-folder-${name}-${new Date().toISOString().slice(0, 10)}.json`,
            {
                kind: 'folder',
                rootFolderId: folderId,
                folders: allFolders,
                files: allFiles,
                timestamp: new Date().toISOString(),
                version: 1,
            }
        );
        toast.success('エクスポートしました');
    } catch (error) {
        console.error('Export failed', error);
        toast.error('Export failed');
    }
};

export const importData = async (file: File) => {
    // Step 1: JSON parse (独立してキャッチ)
    let data: any;
    try {
        data = JSON.parse(await file.text());
    } catch (e) {
        const detail = e instanceof SyntaxError ? e.message : String(e);
        toast.error(`JSONの解析に失敗しました: ${detail}`, { duration: 8000 });
        console.error('Import parse error', e);
        return;
    }

    // Step 2: 構造検証 + DB 書き込み
    try {
        if (data == null || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('ファイルのルートがオブジェクトではありません');
        }

        if (data.version != null && data.version !== 1) {
            toast.warning(`未知のバージョン (version: ${data.version}) です。インポートを試みますが互換性の問題が起きる可能性があります`, { duration: 6000 });
        }

        const kind: string = data.kind ?? 'full';

        if (kind === 'page') {
            if (data.file == null || typeof data.file !== 'object' || Array.isArray(data.file)) {
                throw new Error('ページデータ (file フィールド) が見つかりません');
            }
            if (typeof data.file.title !== 'string') {
                throw new Error('ページのタイトル (file.title) が文字列ではありません');
            }
            if (typeof data.file.content !== 'string') {
                throw new Error('ページの内容 (file.content) が文字列ではありません');
            }

            const { id: _id, ...fileData } = data.file;
            await db.files.add({ ...fileData, folderId: null });
            toast.success('インポートしました');
            window.location.reload();

        } else if (kind === 'folder') {
            if (!Array.isArray(data.folders)) {
                throw new Error('フォルダリスト (folders フィールド) が配列ではありません');
            }
            if (data.folders.length === 0) {
                throw new Error('フォルダリスト (folders) が空です');
            }
            if (!Array.isArray(data.files)) {
                throw new Error('ファイルリスト (files フィールド) が配列ではありません');
            }
            if (typeof data.rootFolderId !== 'number') {
                throw new Error('ルートフォルダID (rootFolderId フィールド) が数値ではありません');
            }

            await db.transaction('rw', db.folders, db.files, async () => {
                const folderList: any[] = [...data.folders];
                const rootFolderId: number = data.rootFolderId;
                const sorted: any[] = [];
                const remaining = new Map(folderList.map(f => [f.id, f]));
                const visitQueue = [rootFolderId];
                while (visitQueue.length > 0 && remaining.size > 0) {
                    const id = visitQueue.shift()!;
                    const folder = remaining.get(id);
                    if (folder) {
                        sorted.push(folder);
                        remaining.delete(id);
                        folderList.filter(f => f.parentId === id).forEach(f => visitQueue.push(f.id));
                    }
                }
                remaining.forEach(f => sorted.push(f));

                const idMap = new Map<number, number>();
                for (const folder of sorted) {
                    const { id: oldId, parentId, ...rest } = folder;
                    const newParentId = oldId === rootFolderId
                        ? null
                        : (parentId != null ? (idMap.get(parentId) ?? null) : null);
                    const newId = await db.folders.add({ ...rest, parentId: newParentId });
                    if (oldId != null) idMap.set(oldId, newId as number);
                }

                const fileInserts = (data.files as any[]).map(({ id: _id, folderId, ...rest }: any) => ({
                    ...rest,
                    folderId: folderId != null ? (idMap.get(folderId) ?? null) : null,
                }));
                await db.files.bulkAdd(fileInserts);
            });

            toast.success('インポートしました');
            window.location.reload();

        } else if (kind === 'full') {
            if (!Array.isArray(data.folders)) {
                throw new Error('フォルダリスト (folders フィールド) が配列ではありません');
            }
            if (!Array.isArray(data.files)) {
                throw new Error('ファイルリスト (files フィールド) が配列ではありません');
            }
            if (!confirm('既存データをすべて置き換えます。続けますか？')) return;

            await db.transaction('rw', db.folders, db.files, db.history, async () => {
                await db.folders.clear();
                await db.files.clear();
                await db.history.clear();
                await db.folders.bulkAdd(data.folders);
                await db.files.bulkAdd(data.files);
                if (data.history) await db.history.bulkAdd(data.history);
            });

            toast.success('Import successful');
            window.location.reload();

        } else {
            throw new Error(`未知の kind "${kind}" です。localnote のエクスポートファイルか確認してください`);
        }
    } catch (error) {
        console.error('Import failed', error);
        const detail = error instanceof Error ? error.message : String(error);
        toast.error(`インポートに失敗しました: ${detail}`, { duration: 8000 });
    }
};
