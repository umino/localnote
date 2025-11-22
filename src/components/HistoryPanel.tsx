import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
// import { format } from 'date-fns';
import { RotateCcw } from 'lucide-react';

interface HistoryPanelProps {
    fileId: number;
    onRestore: (content: string) => void;
}

export function HistoryPanel({ fileId, onRestore }: HistoryPanelProps) {
    const history = useLiveQuery(() =>
        db.history.where('fileId').equals(fileId).reverse().sortBy('timestamp')
        , [fileId]);

    if (!history || history.length === 0) {
        return <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>No history yet.</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold' }}>
                Version History
            </div>
            {history.map((entry) => (
                <div
                    key={entry.id}
                    style={{
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                    }}
                >
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {new Date(entry.timestamp).toLocaleString()}
                    </div>
                    <div style={{
                        fontSize: '0.9rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        opacity: 0.8
                    }}>
                        {entry.content}
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            // confirm()を使用すると無限ループが発生するため削除
                            onRestore(entry.content);
                        }}
                        style={{
                            alignSelf: 'flex-start',
                            fontSize: '0.8rem',
                            padding: '0.25rem 0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                        }}
                    >
                        <RotateCcw size={12} /> Restore
                    </button>
                </div>
            ))}
        </div>
    );
}
