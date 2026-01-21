import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { FileTree } from './FileTree';
import { Plus, FolderPlus, Download, Upload, Settings } from 'lucide-react';
import { exportData, importData } from '../utils/dataTransfer';
import { useRef, useState } from 'react';
import { SettingsModal } from './SettingsModal';
import {
    DndContext,
    type DragEndEvent,
    useDroppable,
    closestCenter,
    useSensor,
    useSensors,
    PointerSensor
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useStore } from '../store/useStore';

export function Sidebar() {
    const folders = useLiveQuery(() => db.folders.toArray());
    const files = useLiveQuery(() => db.files.toArray());
    const { selectedFolderId } = useStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // 5px movement required to start dragging
            },
        })
    );

    const createFolder = async () => {
        // Get max order for folders in the selected parent
        const siblingFolders = (folders || []).filter(f => f.parentId === selectedFolderId);
        const maxOrder = siblingFolders.reduce((max, f) => Math.max(max, f.order || 0), 0);

        const newFolderId = await db.folders.add({
            parentId: selectedFolderId,  // Use selected folder as parent
            name: 'New Folder',
            order: maxOrder + 1,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // Expand the parent folder if it exists
        if (selectedFolderId) {
            const { expandedFolderIds, toggleFolder } = useStore.getState();
            if (!expandedFolderIds.includes(selectedFolderId)) {
                toggleFolder(selectedFolderId);
            }
        }

        // Set editing state to auto-edit the new folder name
        useStore.getState().setEditingItem(newFolderId as number, 'folder');

        return newFolderId;
    };

    const createFile = async () => {
        // Get max order for files in the selected folder
        const siblingFiles = (files || []).filter(f => f.folderId === selectedFolderId);
        const maxOrder = siblingFiles.reduce((max, f) => Math.max(max, f.order || 0), 0);

        const newFileId = await db.files.add({
            folderId: selectedFolderId,  // Use selected folder
            title: 'Untitled',
            content: '',
            order: maxOrder + 1,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // Expand the parent folder if it exists
        if (selectedFolderId) {
            const { expandedFolderIds, toggleFolder } = useStore.getState();
            if (!expandedFolderIds.includes(selectedFolderId)) {
                toggleFolder(selectedFolderId);
            }
        }

        // Set editing state to auto-edit the new file title
        useStore.getState().setEditingItem(newFileId as number, 'file');

        // Set active file to the newly created file
        useStore.getState().setActiveFileId(newFileId as number);

        return newFileId;
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            importData(file);
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Drag and drop handler
    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        console.log('Sidebar drag end event:', { active: active.id, over: over?.id });
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        // Reordering Logic
        // Only reorder if we are NOT dropping onto a "folder-drop-" target (which implies nesting)
        if (activeId !== overId && !overId.startsWith('folder-drop-')) {
            const activeType = active.data.current?.type;
            const overType = over.data.current?.type;

            // Reorder Folders
            if (activeType === 'folder' && overType === 'folder') {
                const activeFolder = folders?.find(f => f.id === active.data.current?.id);
                const overFolder = folders?.find(f => f.id === over.data.current?.id);

                if (activeFolder && overFolder && activeFolder.parentId === overFolder.parentId) {
                    const siblings = folders?.filter(f => f.parentId === activeFolder.parentId)
                        .sort((a, b) => (a.order || 0) - (b.order || 0)) || [];

                    const oldIndex = siblings.findIndex(f => f.id === activeFolder.id);
                    const newIndex = siblings.findIndex(f => f.id === overFolder.id);

                    const newOrder = arrayMove(siblings, oldIndex, newIndex);

                    // Update order in DB
                    await Promise.all(newOrder.map((folder, index) =>
                        db.folders.update(folder.id!, { order: index })
                    ));
                    return;
                }
            }

            // Reorder Files
            if (activeType === 'file' && overType === 'file') {
                const activeFile = files?.find(f => f.id === active.data.current?.id);
                const overFile = files?.find(f => f.id === over.data.current?.id);

                if (activeFile && overFile) {
                    if (activeFile.folderId === overFile.folderId) {
                        // Same folder reordering
                        const siblings = files?.filter(f => f.folderId === activeFile.folderId)
                            .sort((a, b) => (a.order || 0) - (b.order || 0)) || [];

                        const oldIndex = siblings.findIndex(f => f.id === activeFile.id);
                        const newIndex = siblings.findIndex(f => f.id === overFile.id);

                        const newOrder = arrayMove(siblings, oldIndex, newIndex);

                        await Promise.all(newOrder.map((file, index) =>
                            db.files.update(file.id!, { order: index })
                        ));
                    } else {
                        // Cross-folder reordering
                        console.log('Cross-folder move: moving file', activeFile.id, 'to folder', overFile.folderId);

                        // 1. Get siblings in the TARGET folder
                        const targetSiblings = files?.filter(f => f.folderId === overFile.folderId)
                            .sort((a, b) => (a.order || 0) - (b.order || 0)) || [];

                        // 2. Insert the active file after the over file
                        const overIndex = targetSiblings.findIndex(f => f.id === overFile.id);
                        const newSiblings = [...targetSiblings];
                        newSiblings.splice(overIndex + 1, 0, activeFile);

                        // 3. Update all files in the target folder with new parent and order
                        await Promise.all(newSiblings.map((file, index) =>
                            db.files.update(file.id!, {
                                folderId: overFile.folderId,
                                order: index,
                                updatedAt: file.id === activeFile.id ? new Date() : file.updatedAt
                            })
                        ));

                        // 4. Optionally: Update orders in the OLD folder to fill the gap
                        const oldSiblings = files?.filter(f => f.folderId === activeFile.folderId && f.id !== activeFile.id)
                            .sort((a, b) => (a.order || 0) - (b.order || 0)) || [];
                        await Promise.all(oldSiblings.map((file, index) =>
                            db.files.update(file.id!, { order: index })
                        ));
                    }
                    return;
                }
            }
        }

        // File or Folder dropped to Root
        if (overId === 'root-drop-zone') {
            if (activeId.startsWith('file-')) {
                const fileId = parseInt(activeId.replace('file-', ''));
                console.log('Moving file', fileId, 'to root');
                await db.files.update(fileId, { folderId: null, updatedAt: new Date() });
                console.log('File moved to root successfully');
            } else if (activeId.startsWith('folder-')) {
                const folderId = parseInt(activeId.replace('folder-', ''));
                console.log('Moving folder', folderId, 'to root');
                await db.folders.update(folderId, { parentId: null, updatedAt: new Date() });
                console.log('Folder moved to root successfully');
            }
            return;
        }

        // File dropped into Folder
        if (activeId.startsWith('file-') && (overId.startsWith('folder-drop-') || overId.startsWith('folder-'))) {
            const fileId = parseInt(activeId.replace('file-', ''));
            const folderId = parseInt(overId.replace('folder-drop-', '').replace('folder-', ''));
            console.log('Moving file', fileId, 'to folder', folderId);

            if (active.data.current?.folderId !== folderId) {
                await db.files.update(fileId, { folderId, updatedAt: new Date() });
                console.log('File moved successfully');
            }
        }

        // Folder dropped into Folder
        if (activeId.startsWith('folder-') && (overId.startsWith('folder-drop-') || overId.startsWith('folder-'))) {
            const draggedFolderId = parseInt(activeId.replace('folder-', ''));
            const targetFolderId = parseInt(overId.replace('folder-drop-', '').replace('folder-', ''));
            console.log('Moving folder', draggedFolderId, 'to folder', targetFolderId);

            if (draggedFolderId !== targetFolderId && active.data.current?.parentId !== targetFolderId) {
                await db.folders.update(draggedFolderId, { parentId: targetFolderId, updatedAt: new Date() });
                console.log('Folder moved successfully');
            }
        }
    };

    // Root drop zone component
    const RootDropZone = () => {
        const { setNodeRef, isOver } = useDroppable({
            id: 'root-drop-zone',
            data: { type: 'root' }
        });

        return (
            <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
                <div
                    ref={setNodeRef}
                    className={`
                        p-2.5 rounded-lg border-2 border-dashed text-xs text-center transition-all duration-300
                        ${isOver
                            ? 'bg-primary-500/20 border-primary-500 text-primary-700 dark:text-primary-300 font-bold scale-[1.02] shadow-md animate-pulse'
                            : 'bg-zinc-100/50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400'}
                    `}
                >
                    📁 Drop here to move to Root
                </div>
            </div>
        );
    };

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    return (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
            <div className="flex flex-col h-full overflow-hidden">
                {/* Header Actions */}
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
                    <div className="flex gap-2">
                        <button
                            onClick={createFile}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm active:scale-95"
                        >
                            <Plus size={16} /> File
                        </button>
                        <button
                            onClick={createFolder}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm font-medium transition-colors active:scale-95"
                        >
                            <FolderPlus size={16} /> Folder
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={exportData}
                            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                        >
                            <Download size={14} /> Export
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                        >
                            <Upload size={14} /> Import
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImport}
                            className="hidden"
                            accept=".json"
                        />
                    </div>
                </div>

                {/* Root Drop Zone */}
                <RootDropZone />

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
                    <FileTree folders={folders || []} files={files || []} />
                </div>

                {/* Footer Settings */}
                <div className="p-2 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <Settings size={16} /> Settings
                    </button>
                </div>

                <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
            </div>
        </DndContext>
    );
}
