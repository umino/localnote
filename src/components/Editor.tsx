import { useStore } from '../store/useStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useEffect, useState, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { History, Copy } from 'lucide-react';
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

    useEffect(() => {
        if (file) {
            setContent(file.content);
            lastSavedContentRef.current = file.content;
            contentRef.current = file.content;

            setTitle(file.title);
            lastSavedTitleRef.current = file.title;
            titleRef.current = file.title;
        } else {
            setContent('');
            lastSavedContentRef.current = '';
            contentRef.current = '';

            setTitle('');
            lastSavedTitleRef.current = '';
            titleRef.current = '';
        }
    }, [file?.id]); // Only reset when file ID changes

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
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                Select a file to start editing
            </div>
        );
    }

    if (!file) return null;

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
            <Toaster position="bottom-right" theme="dark" />
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        flex: 1,
                        outline: 'none'
                    }}
                />
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
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', marginRight: '0.5rem' }}
                    className="hover:text-accent-color"
                >
                    <Copy size={20} />
                </button>
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    title="View History"
                    style={{ background: 'transparent', border: 'none', color: showHistory ? 'var(--accent-color)' : 'var(--text-secondary)' }}
                >
                    <History size={20} />
                </button>
            </div>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <textarea
                    value={content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        padding: '1rem',
                        resize: 'none',
                        outline: 'none',
                        fontFamily: 'monospace',
                        fontSize: '1rem',
                        lineHeight: '1.6'
                    }}
                />
                {showHistory && (
                    <div style={{ width: '300px', borderLeft: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                        <HistoryPanel fileId={activeFileId} onRestore={(content) => {
                            setContent(content);
                            saveFile(activeFileId, content);
                        }} />
                    </div>
                )}
            </div>
        </div>
    );
}
