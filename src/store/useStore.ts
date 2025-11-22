import { create } from 'zustand';

interface AppState {
    activeFileId: number | null;
    selectedFolderId: number | null;  // Currently selected folder
    editingItemId: number | null;  // ID of item being edited
    editingItemType: 'file' | 'folder' | null;  // Type of item being edited
    expandedFolderIds: number[];
    isSidebarOpen: boolean;
    setActiveFileId: (id: number | null) => void;
    setSelectedFolderId: (id: number | null) => void;
    setEditingItem: (id: number | null, type: 'file' | 'folder' | null) => void;
    toggleFolder: (id: number) => void;
    setSidebarOpen: (isOpen: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
    activeFileId: null,
    selectedFolderId: null,
    editingItemId: null,
    editingItemType: null,
    expandedFolderIds: [],
    isSidebarOpen: true,

    setActiveFileId: (id) => set({ activeFileId: id }),

    setSelectedFolderId: (id) => set({ selectedFolderId: id }),

    setEditingItem: (id, type) => set({ editingItemId: id, editingItemType: type }),

    toggleFolder: (id) =>
        set((state) => ({
            expandedFolderIds: state.expandedFolderIds.includes(id)
                ? state.expandedFolderIds.filter((fid) => fid !== id)
                : [...state.expandedFolderIds, id],
        })),

    setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
}));
