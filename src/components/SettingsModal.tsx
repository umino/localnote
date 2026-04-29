import { useEffect, useState } from 'react';
import { X, Save, HardDrive, RefreshCw, Download } from 'lucide-react';
import { db } from '../db';
import type { HistoryRetentionPolicy } from '../types';
import { toast } from 'sonner';
import {
    isStorageManagerSupported,
    isPersisted,
    requestPersist,
    getStorageEstimate,
    formatBytes,
} from '../utils/storage';
import { exportData } from '../utils/dataTransfer';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [retentionPolicy, setRetentionPolicy] = useState<HistoryRetentionPolicy>({ type: 'unlimited' });
    const [isLoading, setIsLoading] = useState(true);
    const [persisted, setPersisted] = useState<boolean | null>(null);
    const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number; usageRatio: number } | null>(null);
    const [isRequestingPersist, setIsRequestingPersist] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadSettings();
            loadStorageStatus();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        try {
            const setting = await db.table('settings').get('historyRetention');
            if (setting) {
                setRetentionPolicy(setting.value);
            }
        } catch (error) {
            console.error('Failed to load settings', error);
            toast.error('Failed to load settings');
        } finally {
            setIsLoading(false);
        }
    };

    const loadStorageStatus = async () => {
        const [persistedResult, estimateResult] = await Promise.all([
            isPersisted(),
            getStorageEstimate(),
        ]);
        setPersisted(persistedResult);
        setStorageEstimate(estimateResult);
    };

    const handleRequestPersist = async () => {
        setIsRequestingPersist(true);
        const ok = await requestPersist();
        setIsRequestingPersist(false);
        if (ok) {
            setPersisted(true);
            toast.success('ストレージの永続化が許可されました');
        } else {
            toast.warning('ブラウザによってブロックされました。ブラウザ設定でサイト権限を変更するか、定期的にバックアップをエクスポートしてください');
        }
    };

    const handleSave = async () => {
        try {
            // Validation
            if (retentionPolicy.type === 'count' && (retentionPolicy.value < 1)) {
                toast.error('History count must be at least 1');
                return;
            }
            if (retentionPolicy.type === 'days' && (retentionPolicy.value < 1)) {
                toast.error('History days must be at least 1');
                return;
            }

            await db.table('settings').put({
                key: 'historyRetention',
                value: retentionPolicy
            });
            toast.success('Settings saved');
            onClose();
        } catch (error) {
            console.error('Failed to save settings', error);
            toast.error('Failed to save settings');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <section>
                                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                                    <HardDrive size={15} /> Storage
                                </h3>
                                <div className="space-y-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-sm">
                                    {!isStorageManagerSupported() ? (
                                        <p className="text-zinc-500 text-xs">このブラウザは Storage Manager API をサポートしていません。</p>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <span className="text-zinc-600 dark:text-zinc-400">Persistent storage</span>
                                                <span className={persisted === null ? 'text-zinc-400' : persisted ? 'text-green-600 dark:text-green-400 font-medium' : 'text-yellow-600 dark:text-yellow-400 font-medium'}>
                                                    {persisted === null ? '確認中…' : persisted ? 'Enabled' : 'Not enabled'}
                                                </span>
                                            </div>
                                            {storageEstimate && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-zinc-600 dark:text-zinc-400">Used (概算)</span>
                                                    <span className="text-zinc-700 dark:text-zinc-300">
                                                        {formatBytes(storageEstimate.usage)} / {formatBytes(storageEstimate.quota)}
                                                        <span className="ml-1 text-zinc-400">({(storageEstimate.usageRatio * 100).toFixed(2)}%)</span>
                                                    </span>
                                                </div>
                                            )}
                                            {persisted === false && (
                                                <div className="space-y-2 pt-1">
                                                    <button
                                                        onClick={handleRequestPersist}
                                                        disabled={isRequestingPersist}
                                                        className="flex items-center gap-2 w-full justify-center px-3 py-2 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-60 rounded-lg transition-colors"
                                                    >
                                                        <RefreshCw size={13} className={isRequestingPersist ? 'animate-spin' : ''} />
                                                        永続化を再要求
                                                    </button>
                                                    <button
                                                        onClick={() => exportData()}
                                                        className="flex items-center gap-2 w-full justify-center px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-200 dark:border-zinc-700"
                                                    >
                                                        <Download size={13} />
                                                        バックアップをエクスポート
                                                    </button>
                                                </div>
                                            )}
                                            <p className="text-xs text-zinc-400 pt-1">
                                                Safari では 7 日間未訪問でデータが削除される場合があります。定期的なエクスポートを推奨します。
                                            </p>
                                        </>
                                    )}
                                </div>
                            </section>

                            <section>
                                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">History Retention</h3>
                                <div className="space-y-3">
                                    <label className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
                                        <input
                                            type="radio"
                                            name="historyPolicy"
                                            checked={retentionPolicy.type === 'unlimited'}
                                            onChange={() => setRetentionPolicy({ type: 'unlimited' })}
                                            className="text-primary-600 focus:ring-primary-500"
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">Unlimited</div>
                                            <div className="text-xs text-zinc-500">Keep all history versions forever</div>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
                                        <input
                                            type="radio"
                                            name="historyPolicy"
                                            checked={retentionPolicy.type === 'count'}
                                            onChange={() => setRetentionPolicy({ type: 'count', value: 10 })}
                                            className="text-primary-600 focus:ring-primary-500"
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">Max Versions</div>
                                            <div className="text-xs text-zinc-500">Keep a specific number of recent versions</div>
                                        </div>
                                        {retentionPolicy.type === 'count' && (
                                            <input
                                                type="number"
                                                min="1"
                                                value={retentionPolicy.value}
                                                onChange={(e) => setRetentionPolicy({ type: 'count', value: Math.max(1, parseInt(e.target.value) || 1) })}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-20 px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                            />
                                        )}
                                    </label>

                                    <label className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
                                        <input
                                            type="radio"
                                            name="historyPolicy"
                                            checked={retentionPolicy.type === 'days'}
                                            onChange={() => setRetentionPolicy({ type: 'days', value: 30 })}
                                            className="text-primary-600 focus:ring-primary-500"
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">Max Days</div>
                                            <div className="text-xs text-zinc-500">Keep history for a specific number of days</div>
                                        </div>
                                        {retentionPolicy.type === 'days' && (
                                            <input
                                                type="number"
                                                min="1"
                                                value={retentionPolicy.value}
                                                onChange={(e) => setRetentionPolicy({ type: 'days', value: Math.max(1, parseInt(e.target.value) || 1) })}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-20 px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                            />
                                        )}
                                    </label>
                                </div>
                            </section>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-sm active:scale-95"
                    >
                        <Save size={16} /> Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
