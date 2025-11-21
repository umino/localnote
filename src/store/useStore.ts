import { create } from 'zustand';

interface AppState {
    activeFileId: number | null;
    expandedFolderIds: number[];
    isSidebarOpen: boolean;
    setActiveFileId: (id: number | null) => void;
    toggleFolder: (id: number) => void;
    setSidebarOpen: (isOpen: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
    activeFileId: null,
    expandedFolderIds: [],
    isSidebarOpen: true,
    setActiveFileId: (id) => set({ activeFileId: id }),
    toggleFolder: (id) =>
        set((state) => ({
            expandedFolderIds: state.expandedFolderIds.includes(id)
                ? state.expandedFolderIds.filter((fid) => fid !== id)
                : [...state.expandedFolderIds, id],
        })),
    setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
}));
