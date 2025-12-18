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
        return (
            <div className="p-8 text-center bg-transparent">
                <p className="text-sm text-zinc-500 dark:text-zinc-500 italic">No history yet.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden bg-transparent">
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                    Version History
                </h3>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">
                    {history.length}
                </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                    {history.map((entry) => (
                        <div
                            key={entry.id}
                            className="p-5 hover:bg-white/50 dark:hover:bg-white/5 transition-colors group relative"
                        >
                            <div className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 mb-2 flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                                {new Date(entry.timestamp).toLocaleString()}
                            </div>

                            <div className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-3 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">
                                {entry.content || <span className="italic opacity-30 px-1">Empty content</span>}
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRestore(entry.content);
                                }}
                                className="
                                    flex items-center gap-1.5 px-3 py-1.5 
                                    bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700
                                    hover:bg-primary-50 hover:border-primary-200 hover:text-primary-700
                                    dark:hover:bg-primary-900/20 dark:hover:border-primary-800 dark:hover:text-primary-300
                                    rounded-md text-[11px] font-bold text-zinc-700 dark:text-zinc-300
                                    transition-all active:scale-95 shadow-sm
                                "
                            >
                                <RotateCcw size={12} />
                                RESTORE THIS VERSION
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
