import { useStore } from '../store/useStore';
import { normalizeHref } from '../utils/normalizeHref';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { History, Copy, FileText, Underline as UnderlineIcon, Palette, X, Link2, Link2Off, Table as TableIcon, Indent as IndentIcon, Outdent as OutdentIcon } from 'lucide-react';
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
    const { activeFileId, searchHighlightQuery, setActiveFileId } = useStore();
    const file = useLiveQuery(() => activeFileId ? db.files.get(activeFileId) : undefined, [activeFileId]);
    const allFiles = useLiveQuery(() => db.files.toArray(), []);
    const [showHistory, setShowHistory] = useState(false);
    const [isInTable, setIsInTable] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [linkMode, setLinkMode] = useState<'url' | 'page'>('url');
    const [pageSearch, setPageSearch] = useState('');
    const linkInputRef = useRef<HTMLInputElement>(null);
    const pageSearchRef = useRef<HTMLInputElement>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const autoSaveIntervalRef = useRef<number>(30000);
    const lastSavedContentRef = useRef('');
    const contentRef = useRef('');
    const richEditorRef = useRef<RichEditorHandle>(null);

    const [title, setTitle] = useState('');
    const titleRef = useRef('');
    const lastSavedTitleRef = useRef('');
    const titleSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const lastFileIdRef = useRef<number | null>(null);

    useEffect(() => {
        db.table('settings').get('autoSaveInterval').then((s) => {
            if (s?.value != null) autoSaveIntervalRef.current = s.value * 1000;
        });
    }, []);

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
        }, autoSaveIntervalRef.current);
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

    const closeLinkInput = useCallback(() => {
        setShowLinkInput(false);
        setLinkUrl('');
        setLinkMode('url');
        setPageSearch('');
    }, []);

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

                    {/* Link */}
                    <div className="relative">
                        {richEditorRef.current?.isLinkActive() ? (
                            <button
                                onClick={() => richEditorRef.current?.unsetLink()}
                                title="リンクを解除"
                                className="p-2 rounded-md transition-all active:scale-95 text-primary-600 dark:text-primary-400 bg-white dark:bg-zinc-700 shadow-sm"
                            >
                                <Link2Off size={18} />
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    setLinkUrl(richEditorRef.current?.getCurrentLink() ?? '');
                                    setShowLinkInput(p => !p);
                                    setTimeout(() => linkInputRef.current?.focus(), 50);
                                }}
                                title="リンクを挿入"
                                className={`
                                    p-2 rounded-md transition-all active:scale-95
                                    ${showLinkInput
                                        ? 'text-primary-600 dark:text-primary-400 bg-white dark:bg-zinc-700 shadow-sm'
                                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-700'}
                                `}
                            >
                                <Link2 size={18} />
                            </button>
                        )}
                        {showLinkInput && (
                            <div className="absolute right-0 top-full mt-1 z-30 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl min-w-[280px]">
                                {/* Tab */}
                                <div className="flex border-b border-zinc-200 dark:border-zinc-700">
                                    <button
                                        onClick={() => { setLinkMode('url'); setTimeout(() => linkInputRef.current?.focus(), 50); }}
                                        className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors rounded-tl-lg ${linkMode === 'url' ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                                    >
                                        URL
                                    </button>
                                    <button
                                        onClick={() => { setLinkMode('page'); setTimeout(() => pageSearchRef.current?.focus(), 50); }}
                                        className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors rounded-tr-lg ${linkMode === 'page' ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                                    >
                                        ページ
                                    </button>
                                </div>

                                {linkMode === 'url' ? (
                                    <div className="flex gap-1.5 p-2">
                                        <input
                                            ref={linkInputRef}
                                            type="text"
                                            value={linkUrl}
                                            onChange={e => setLinkUrl(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && linkUrl) {
                                                    richEditorRef.current?.setLink(normalizeHref(linkUrl));
                                                    closeLinkInput();
                                                } else if (e.key === 'Escape') {
                                                    closeLinkInput();
                                                }
                                            }}
                                            placeholder="https://... または C:\path\to\file"
                                            className="flex-1 text-sm px-2 py-1 bg-zinc-100 dark:bg-zinc-700 rounded border border-zinc-200 dark:border-zinc-600 outline-none focus:border-primary-400 text-zinc-900 dark:text-zinc-100"
                                        />
                                        <button
                                            onClick={() => {
                                                if (linkUrl) richEditorRef.current?.setLink(normalizeHref(linkUrl));
                                                closeLinkInput();
                                            }}
                                            className="px-2 py-1 text-xs bg-primary-500 hover:bg-primary-600 text-white rounded transition-colors"
                                        >
                                            設定
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-2 flex flex-col gap-1.5">
                                        <input
                                            ref={pageSearchRef}
                                            type="text"
                                            value={pageSearch}
                                            onChange={e => setPageSearch(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Escape') closeLinkInput(); }}
                                            placeholder="ページ名で検索..."
                                            className="text-sm px-2 py-1 bg-zinc-100 dark:bg-zinc-700 rounded border border-zinc-200 dark:border-zinc-600 outline-none focus:border-primary-400 text-zinc-900 dark:text-zinc-100"
                                        />
                                        <div className="max-h-[280px] overflow-y-auto">
                                            <div className="flex flex-col gap-0.5">
                                            {(allFiles ?? [])
                                                .filter(f => f.id !== activeFileId && f.title.toLowerCase().includes(pageSearch.toLowerCase()))
                                                .map(f => (
                                                    <button
                                                        key={f.id}
                                                        onClick={() => {
                                                            richEditorRef.current?.insertInternalLink(f.id!, f.title || 'Untitled');
                                                            closeLinkInput();
                                                        }}
                                                        className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 truncate transition-colors"
                                                    >
                                                        {f.title || 'Untitled'}
                                                    </button>
                                                ))
                                            }
                                            </div>
                                            {(allFiles ?? []).filter(f => f.id !== activeFileId && f.title.toLowerCase().includes(pageSearch.toLowerCase())).length === 0 && (
                                                <p className="text-xs text-zinc-400 px-2 py-1.5">ページが見つかりません</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="w-px h-4 bg-zinc-200 dark:border-zinc-700 mx-0.5" />

                    {/* Indent */}
                    <button
                        onClick={() => richEditorRef.current?.decreaseIndent()}
                        title="インデントを減らす (Ctrl+[)"
                        className="p-2 rounded-md transition-all active:scale-95 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-700"
                    >
                        <OutdentIcon size={18} />
                    </button>
                    <button
                        onClick={() => richEditorRef.current?.increaseIndent()}
                        title="インデントを増やす (Ctrl+])"
                        className="p-2 rounded-md transition-all active:scale-95 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-700"
                    >
                        <IndentIcon size={18} />
                    </button>

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
                    <button
                        onClick={() => richEditorRef.current?.insertTable()}
                        title="テーブルを挿入 (3×3)"
                        className="p-2 text-zinc-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-white dark:hover:bg-zinc-700 rounded-md transition-all active:scale-95"
                    >
                        <TableIcon size={18} />
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

            {/* Table toolbar — visible only when cursor is inside a table */}
            {isInTable && (
                <div className="flex flex-wrap items-center gap-1 px-4 py-1.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs">
                    <span className="text-zinc-400 dark:text-zinc-500 mr-1 select-none">行:</span>
                    <button onClick={() => richEditorRef.current?.addRowBefore()} className="px-2 py-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors" title="上に行を追加">↑ 追加</button>
                    <button onClick={() => richEditorRef.current?.addRowAfter()}  className="px-2 py-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors" title="下に行を追加">↓ 追加</button>
                    <button onClick={() => richEditorRef.current?.deleteRow()}    className="px-2 py-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 dark:text-red-400 transition-colors" title="この行を削除">✕ 削除</button>
                    <div className="w-px h-3.5 bg-zinc-300 dark:bg-zinc-600 mx-0.5" />
                    <span className="text-zinc-400 dark:text-zinc-500 mr-1 select-none">列:</span>
                    <button onClick={() => richEditorRef.current?.addColumnBefore()} className="px-2 py-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors" title="左に列を追加">← 追加</button>
                    <button onClick={() => richEditorRef.current?.addColumnAfter()}  className="px-2 py-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors" title="右に列を追加">→ 追加</button>
                    <button onClick={() => richEditorRef.current?.deleteColumn()}    className="px-2 py-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 dark:text-red-400 transition-colors" title="この列を削除">✕ 削除</button>
                    <div className="w-px h-3.5 bg-zinc-300 dark:bg-zinc-600 mx-0.5" />
                    <button onClick={() => richEditorRef.current?.deleteTable()}    className="px-2 py-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 dark:text-red-400 transition-colors" title="テーブルを削除">🗑 テーブル削除</button>
                </div>
            )}

            <div className="flex-1 flex overflow-hidden relative">
                <RichEditor
                    ref={richEditorRef}
                    key={file.id}
                    initialContent={file.content}
                    onChange={handleContentChange}
                    highlightQuery={searchHighlightQuery}
                    onInternalLinkClick={(id) => setActiveFileId(id)}
                    onTableStateChange={setIsInTable}
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
