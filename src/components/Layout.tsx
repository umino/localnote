import { useStore } from '../store/useStore';
import { Sidebar } from './Sidebar';
import { Editor } from './Editor';

export function Layout() {
    const { isSidebarOpen } = useStore();

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
            {isSidebarOpen && (
                <aside style={{
                    width: '280px',
                    borderRight: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <Sidebar />
                </aside>
            )}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
                <Editor />
            </main>
        </div>
    );
}
