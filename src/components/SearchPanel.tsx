import { useMemo } from 'react';
import { Search, FileText, Folder as FolderIcon } from 'lucide-react';
import type { TextFile, Folder } from '../types';
import { extractText } from '../utils/content';
import { useStore } from '../store/useStore';

interface SearchPanelProps {
    query: string;
    scope: 'all' | 'folder';
    files: TextFile[];
    folders: Folder[];
}

function getFolderPath(folderId: number | null, folders: Folder[]): string {
    if (folderId == null) return 'Root';
    const parts: string[] = [];
    let current: number | null = folderId;
    while (current != null) {
        const folder = folders.find(f => f.id === current);
        if (!folder) break;
        parts.unshift(folder.name);
        current = folder.parentId;
    }
    return parts.length ? parts.join(' › ') : 'Root';
}

function getSubtreeFolderIds(rootId: number, folders: Folder[]): Set<number> {
    const ids = new Set<number>();
    const queue = [rootId];
    while (queue.length) {
        const id = queue.shift()!;
        ids.add(id);
        folders.filter(f => f.parentId === id).forEach(f => queue.push(f.id!));
    }
    return ids;
}

function getSnippet(text: string, query: string, half = 60): string {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text.slice(0, half * 2);
    const start = Math.max(0, idx - half);
    const end = Math.min(text.length, idx + query.length + half);
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

function Highlight({ text, query }: { text: string; query: string }) {
    if (!query.trim()) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
        <>
            {text.slice(0, idx)}
            <mark className="bg-yellow-200 dark:bg-yellow-700/60 text-inherit rounded-sm not-italic">
                {text.slice(idx, idx + query.length)}
            </mark>
            {text.slice(idx + query.length)}
        </>
    );
}

export function SearchPanel({ query, scope, files, folders }: SearchPanelProps) {
    const { setActiveFileId, selectedFolderId } = useStore();

    const results = useMemo(() => {
        const q = query.trim();
        if (!q) return [];

        let pool = files;
        if (scope === 'folder' && selectedFolderId != null) {
            const ids = getSubtreeFolderIds(selectedFolderId, folders);
            pool = files.filter(f => f.folderId != null && ids.has(f.folderId));
        }

        const ql = q.toLowerCase();
        return pool
            .filter(f => f.title.toLowerCase().includes(ql) || extractText(f.content).toLowerCase().includes(ql))
            .map(f => {
                const body = extractText(f.content);
                return {
                    file: f,
                    folderPath: getFolderPath(f.folderId, folders),
                    snippet: body.toLowerCase().includes(ql) ? getSnippet(body, q) : null,
                };
            });
    }, [query, scope, files, folders, selectedFolderId]);

    if (scope === 'folder' && selectedFolderId == null) {
        return (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-zinc-400 dark:text-zinc-500">
                <Search size={22} className="opacity-40" />
                <span className="text-xs text-center px-4">フォルダを選択してから<br />検索してください</span>
            </div>
        );
    }

    if (!query.trim()) return null;

    if (results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-zinc-400 dark:text-zinc-500">
                <Search size={22} className="opacity-40" />
                <span className="text-xs">一致するページなし</span>
            </div>
        );
    }

    return (
        <div className="p-2">
            <p className="text-xs text-zinc-400 dark:text-zinc-500 px-2 pb-1.5">{results.length} 件</p>
            <div className="space-y-0.5">
                {results.map(({ file, folderPath, snippet }) => (
                    <button
                        key={file.id}
                        onClick={() => setActiveFileId(file.id!)}
                        className="w-full text-left px-2 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
                    >
                        <div className="flex items-center gap-1.5 min-w-0">
                            <FileText size={13} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
                            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                <Highlight text={file.title} query={query} />
                            </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 pl-5">
                            <FolderIcon size={11} className="text-zinc-400 shrink-0" />
                            <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate">{folderPath}</span>
                        </div>
                        {snippet && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 pl-5 mt-0.5 leading-relaxed">
                                <Highlight text={snippet} query={query} />
                            </p>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
