import { useStore } from '../store/useStore';
import { Sidebar } from './Sidebar';
import { Editor } from './Editor';

export function Layout() {
    const { isSidebarOpen } = useStore();

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
