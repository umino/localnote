import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useStore } from '../store/useStore';
import { db } from '../db';
import { Sidebar } from './Sidebar';
import { Editor } from './Editor';
import { isStorageManagerSupported, isPersisted } from '../utils/storage';

export function Layout() {
    const { isSidebarOpen, sidebarWidth, setSidebarWidth } = useStore();

    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = useStore.getState().sidebarWidth;

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(180, Math.min(600, startWidth + (e.clientX - startX)));
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [setSidebarWidth]);

    // Ctrl+Alt+N: 新規ファイル作成（Ctrl+N はブラウザ新規ウィンドウに専有されるため Alt を併用）
    useEffect(() => {
        const handler = async (e: KeyboardEvent) => {
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                const { selectedFolderId, expandedFolderIds, toggleFolder, setEditingItem, setActiveFileId } = useStore.getState();
                const folderId = selectedFolderId ?? null;
                const siblings = await db.files.filter(f => f.folderId === folderId).toArray();
                const maxOrder = siblings.reduce((m, f) => Math.max(m, f.order ?? 0), 0);
                const id = await db.files.add({
                    folderId,
                    title: 'Untitled',
                    content: '',
                    order: maxOrder + 1,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                if (folderId && !expandedFolderIds.includes(folderId)) toggleFolder(folderId);
                setEditingItem(id as number, 'file');
                setActiveFileId(id as number);
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    useEffect(() => {
        if (location.protocol === 'file:') return;
        if (!isStorageManagerSupported()) return;
        if (sessionStorage.getItem('persistNoticeShown')) return;
        isPersisted().then((ok) => {
            if (!ok) {
                sessionStorage.setItem('persistNoticeShown', '1');
                toast.info('データの永続化が許可されていません。設定 > Storage から再要求できます', { duration: 6000 });
            }
        });
    }, []);

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
            {isSidebarOpen && (
                <>
                    <aside className="h-full glass z-10 flex flex-col shadow-xl shrink-0" style={{ width: sidebarWidth }}>
                        <Sidebar />
                    </aside>
                    <div
                        className="w-1 h-full shrink-0 cursor-col-resize bg-zinc-200 dark:bg-zinc-700 hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors z-20"
                        onMouseDown={handleResizeStart}
                    />
                </>
            )}
            <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-900 shadow-inner relative">
                <Editor />
            </main>
        </div>
    );
}
