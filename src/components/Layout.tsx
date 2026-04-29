import { useEffect } from 'react';
import { toast } from 'sonner';
import { useStore } from '../store/useStore';
import { Sidebar } from './Sidebar';
import { Editor } from './Editor';
import { isStorageManagerSupported, isPersisted } from '../utils/storage';

export function Layout() {
    const { isSidebarOpen } = useStore();

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
                <aside className="w-[280px] h-full glass border-r z-10 flex flex-col shadow-xl">
                    <Sidebar />
                </aside>
            )}
            <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-900 shadow-inner relative">
                <Editor />
            </main>
        </div>
    );
}
