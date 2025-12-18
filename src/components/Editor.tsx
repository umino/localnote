import { useStore } from '../store/useStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useEffect, useState, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { History, Copy, FileText } from 'lucide-react';
import { HistoryPanel } from './HistoryPanel';

export function Editor() {
    const { activeFileId } = useStore();
    const file = useLiveQuery(() => activeFileId ? db.files.get(activeFileId) : undefined, [activeFileId]);
    const [content, setContent] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedContentRef = useRef('');
    const contentRef = useRef('');

    const [title, setTitle] = useState('');
    const titleRef = useRef('');
    const lastSavedTitleRef = useRef('');
    const titleSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const lastFileIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (file) {
            const isIdChanged = file.id !== lastFileIdRef.current;
            lastFileIdRef.current = file.id!;

            // Sync Content: Update if ID changed OR if DB content changed externally
            if (isIdChanged || (file.content !== contentRef.current && !saveTimeoutRef.current)) {
                setContent(file.content);
                lastSavedContentRef.current = file.content;
                contentRef.current = file.content;
            }

            // Sync Title: Update if ID changed OR if DB title changed externally
            if (isIdChanged || (file.title !== titleRef.current && !titleSaveTimeoutRef.current)) {
                setTitle(file.title);
                lastSavedTitleRef.current = file.title;
                titleRef.current = file.title;
            }
        } else {
            setContent('');
            lastSavedContentRef.current = '';
            contentRef.current = '';

            setTitle('');
            lastSavedTitleRef.current = '';
            titleRef.current = '';
            lastFileIdRef.current = null;
        }
    }, [file?.id, file?.title, file?.content]); // Watch for changes in ID, title, and content

    // Save on unmount or activeFileId change
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            if (activeFileId && contentRef.current !== lastSavedContentRef.current) {
                saveFile(activeFileId, contentRef.current, false);
            }

            // Save pending title changes
            if (titleSaveTimeoutRef.current) {
                clearTimeout(titleSaveTimeoutRef.current);
            }
            if (activeFileId && titleRef.current !== lastSavedTitleRef.current) {
                db.files.update(activeFileId, { title: titleRef.current, updatedAt: new Date() });
            }
        };
    }, [activeFileId]);

    const handleContentChange = (newContent: string) => {
        setContent(newContent);
        contentRef.current = newContent;

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            if (activeFileId && newContent !== lastSavedContentRef.current) {
                await saveFile(activeFileId, newContent);
            }
            saveTimeoutRef.current = null; // Clear ref after save
        }, 60000); // 60 seconds auto-save
    };

    const handleTitleChange = (newTitle: string) => {
        setTitle(newTitle);
        titleRef.current = newTitle;

        if (titleSaveTimeoutRef.current) {
            clearTimeout(titleSaveTimeoutRef.current);
        }

        titleSaveTimeoutRef.current = setTimeout(async () => {
            if (activeFileId && newTitle !== lastSavedTitleRef.current) {
                await db.files.update(activeFileId, { title: newTitle, updatedAt: new Date() });
                lastSavedTitleRef.current = newTitle;
            }
            titleSaveTimeoutRef.current = null; // Clear ref after save
        }, 500); // 500ms debounce for title
    };

    const saveFile = async (id: number, newContent: string, updateLastSaved = true) => {
        try {
            await db.transaction('rw', db.files, db.history, async () => {
                await db.files.update(id, { content: newContent, updatedAt: new Date() });
                await db.history.add({
                    fileId: id,
                    content: newContent,
                    timestamp: new Date(),
                });
            });
            if (updateLastSaved) {
                lastSavedContentRef.current = newContent;
            }
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

            {/* Toolbar / Header */}
            <header className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center gap-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-20">
                <input
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Untitled"
                    className="bg-transparent border-none text-zinc-900 dark:text-zinc-100 text-2xl font-bold flex-1 outline-none placeholder:opacity-30"
                />

                <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-lg">
                    <button
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(content);
                                toast.success('Copied to clipboard');
                            } catch (error) {
                                console.error('Failed to copy', error);
                                toast.error('Failed to copy');
                            }
                        }}
                        title="Copy Content"
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

            {/* Editor Area */}
            <div className="flex-1 flex overflow-hidden relative">
                <textarea
                    value={content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="Type something..."
                    className="
                        flex-1 bg-transparent border-none text-zinc-800 dark:text-zinc-200 
                        p-8 md:p-12 resize-none outline-none 
                        font-sans text-lg leading-relaxed
                        placeholder:opacity-20
                        scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800
                    "
                />

                {/* History Panel Sidebar */}
                {showHistory && (
                    <aside className="w-[320px] border-l border-zinc-200 dark:border-zinc-800 glass z-10 shadow-2xl animate-in slide-in-from-right duration-300">
                        <HistoryPanel fileId={activeFileId} onRestore={(content) => {
                            setContent(content);
                            saveFile(activeFileId, content);
                        }} />
                    </aside>
                )}
            </div>
        </div>
    );
}
