import { useStore } from '../store/useStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useEffect, useState, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { History, Copy, FileText, Underline as UnderlineIcon, Palette, X } from 'lucide-react';
import { HistoryPanel } from './HistoryPanel';
import { RichEditor, type RichEditorHandle } from './RichEditor';

const COLOR_PALETTE = [
    { label: '赤', value: '#ef4444' },
    { label: 'オレンジ', value: '#f97316' },
    { label: '緑', value: '#10b981' },
    { label: '青', value: '#3b82f6' },
    { label: '紫', value: '#8b5cf6' },
    { label: 'グレー', value: '#71717a' },
];

export function Editor() {
    const { activeFileId } = useStore();
    const file = useLiveQuery(() => activeFileId ? db.files.get(activeFileId) : undefined, [activeFileId]);
    const [showHistory, setShowHistory] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedContentRef = useRef('');
    const contentRef = useRef('');
    const richEditorRef = useRef<RichEditorHandle>(null);

    const [title, setTitle] = useState('');
    const titleRef = useRef('');
    const lastSavedTitleRef = useRef('');
    const titleSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const lastFileIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (file) {
            const isIdChanged = file.id !== lastFileIdRef.current;
            lastFileIdRef.current = file.id!;

            if (isIdChanged) {
                lastSavedContentRef.current = file.content;
                contentRef.current = file.content;
                setTitle(file.title);
                lastSavedTitleRef.current = file.title;
                titleRef.current = file.title;
            } else if (file.title !== titleRef.current && !titleSaveTimeoutRef.current) {
                setTitle(file.title);
                lastSavedTitleRef.current = file.title;
                titleRef.current = file.title;
            }
        } else {
            lastSavedContentRef.current = '';
            contentRef.current = '';
            setTitle('');
            lastSavedTitleRef.current = '';
            titleRef.current = '';
            lastFileIdRef.current = null;
        }
    }, [file?.id, file?.title, file?.content]);

    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            if (activeFileId && contentRef.current !== lastSavedContentRef.current) {
                saveFile(activeFileId, contentRef.current, false);
            }
            if (titleSaveTimeoutRef.current) clearTimeout(titleSaveTimeoutRef.current);
            if (activeFileId && titleRef.current !== lastSavedTitleRef.current) {
                db.files.update(activeFileId, { title: titleRef.current, updatedAt: new Date() });
            }
        };
    }, [activeFileId]);

    const handleContentChange = (newContent: string) => {
        contentRef.current = newContent;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(async () => {
            if (activeFileId && contentRef.current !== lastSavedContentRef.current) {
                await saveFile(activeFileId, contentRef.current);
            }
            saveTimeoutRef.current = null;
        }, 2000);
    };

    const handleTitleChange = (newTitle: string) => {
        setTitle(newTitle);
        titleRef.current = newTitle;
        if (titleSaveTimeoutRef.current) clearTimeout(titleSaveTimeoutRef.current);
        titleSaveTimeoutRef.current = setTimeout(async () => {
            if (activeFileId && newTitle !== lastSavedTitleRef.current) {
                await db.files.update(activeFileId, { title: newTitle, updatedAt: new Date() });
                lastSavedTitleRef.current = newTitle;
            }
            titleSaveTimeoutRef.current = null;
        }, 500);
    };

    const saveFile = async (id: number, newContent: string, updateLastSaved = true) => {
        try {
            await db.transaction('rw', db.files, db.history, db.settings, async () => {
                await db.files.update(id, { content: newContent, updatedAt: new Date() });
                await db.history.add({ fileId: id, content: newContent, timestamp: new Date() });

                const setting = await db.table('settings').get('historyRetention');
                const policy = setting?.value || { type: 'unlimited' };

                if (policy.type === 'count') {
                    const limit = Math.max(1, policy.value);
                    const count = await db.history.where('fileId').equals(id).count();
                    if (count > limit) {
                        const oldestKeys = await db.history
                            .where('fileId').equals(id).sortBy('timestamp')
                            .then(items => items.slice(0, count - limit).map(i => i.id!));
                        await db.history.bulkDelete(oldestKeys);
                    }
                } else if (policy.type === 'days') {
                    const cutoff = new Date();
                    cutoff.setDate(cutoff.getDate() - Math.max(1, policy.value));
                    const oldKeys = await db.history
                        .where('fileId').equals(id).filter(h => h.timestamp < cutoff).primaryKeys();
                    await db.history.bulkDelete(oldKeys);
                }
            });
            if (updateLastSaved) lastSavedContentRef.current = newContent;
            toast.success('Saved');
        } catch (error) {
            console.error('Failed to save', error);
            toast.error('Failed to save');
        }
    };

    if (!activeFileId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 bg-zinc-50/50 dark:bg-zinc-950/50">
                <div className="w-16 h-16 mb-4 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <FileText size={32} className="opacity-20" />
                </div>
                <p className="text-lg font-medium">Select a file to start editing</p>
                <p className="text-sm opacity-60 mt-1">Your notes are stored locally and securely.</p>
            </div>
        );
    }

    if (!file) return null;

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-900 relative">
            <Toaster position="bottom-right" theme="dark" />

            <header className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center gap-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-20">
                <input
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Untitled"
                    className="bg-transparent border-none text-zinc-900 dark:text-zinc-100 text-2xl font-bold flex-1 outline-none placeholder:opacity-30"
                />

                <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-lg">
                    {/* Underline */}
                    <button
                        onClick={() => richEditorRef.current?.toggleUnderline()}
                        title="下線 (Ctrl+U)"
                        className={`
                            p-2 rounded-md transition-all active:scale-95
                            ${richEditorRef.current?.isUnderlineActive()
                                ? 'text-primary-600 dark:text-primary-400 bg-white dark:bg-zinc-700 shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-700'}
                        `}
                    >
                        <UnderlineIcon size={18} />
                    </button>

                    {/* Color picker */}
                    <div className="relative">
                        <button
                            onClick={() => setShowColorPicker(p => !p)}
                            title="文字色"
                            className={`
                                p-2 rounded-md transition-all active:scale-95
                                ${showColorPicker
                                    ? 'text-primary-600 dark:text-primary-400 bg-white dark:bg-zinc-700 shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-700'}
                            `}
                        >
                            <Palette size={18} style={{ color: richEditorRef.current?.getCurrentColor() ?? undefined }} />
                        </button>
                        {showColorPicker && (
                            <div className="absolute right-0 top-full mt-1 z-30 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl flex flex-col gap-1.5 min-w-[120px]">
                                <div className="grid grid-cols-3 gap-1.5">
                                    {COLOR_PALETTE.map(({ label, value }) => (
                                        <button
                                            key={value}
                                            title={label}
                                            onClick={() => { richEditorRef.current?.setColor(value); setShowColorPicker(false); }}
                                            className="w-7 h-7 rounded-full border-2 border-transparent hover:border-zinc-400 transition-all active:scale-90"
                                            style={{ backgroundColor: value }}
                                        />
                                    ))}
                                </div>
                                <button
                                    onClick={() => { richEditorRef.current?.unsetColor(); setShowColorPicker(false); }}
                                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition-colors"
                                >
                                    <X size={11} /> デフォルト
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="w-px h-4 bg-zinc-200 dark:border-zinc-700 mx-0.5" />
                    <button
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(richEditorRef.current?.getText() ?? '');
                                toast.success('Copied to clipboard');
                            } catch {
                                toast.error('Failed to copy');
                            }
                        }}
                        title="Copy as plain text"
                        className="p-2 text-zinc-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-white dark:hover:bg-zinc-700 rounded-md transition-all active:scale-95"
                    >
                        <Copy size={18} />
                    </button>
                    <div className="w-px h-4 bg-zinc-200 dark:border-zinc-700 mx-0.5" />
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        title="View History"
                        className={`
                            p-2 rounded-md transition-all active:scale-95
                            ${showHistory
                                ? 'text-primary-600 dark:text-primary-400 bg-white dark:bg-zinc-700 shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-700'}
                        `}
                    >
                        <History size={18} />
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                <RichEditor
                    ref={richEditorRef}
                    key={file.id}
                    initialContent={file.content}
                    onChange={handleContentChange}
                />

                {showHistory && (
                    <aside className="w-[320px] border-l border-zinc-200 dark:border-zinc-800 glass z-10 shadow-2xl animate-in slide-in-from-right duration-300">
                        <HistoryPanel fileId={activeFileId} onRestore={(restoredContent) => {
                            if (saveTimeoutRef.current) {
                                clearTimeout(saveTimeoutRef.current);
                                saveTimeoutRef.current = null;
                            }
                            richEditorRef.current?.setContent(restoredContent);
                            contentRef.current = restoredContent;
                            saveFile(activeFileId, restoredContent);
                        }} />
                    </aside>
                )}
            </div>
        </div>
    );
}
