import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { FileTree } from './FileTree';
import { Plus, FolderPlus, Download, Upload } from 'lucide-react';
import { exportData, importData } from '../utils/dataTransfer';
import { useRef } from 'react';
import { DndContext, type DragEndEvent, useDroppable, closestCenter } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useStore } from '../store/useStore';

export function Sidebar() {
    const folders = useLiveQuery(() => db.folders.toArray());
    const files = useLiveQuery(() => db.files.toArray());
    const { selectedFolderId } = useStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

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

                if (activeFile && overFile && activeFile.folderId === overFile.folderId) {
                    const siblings = files?.filter(f => f.folderId === activeFile.folderId)
                        .sort((a, b) => (a.order || 0) - (b.order || 0)) || [];

                    const oldIndex = siblings.findIndex(f => f.id === activeFile.id);
                    const newIndex = siblings.findIndex(f => f.id === overFile.id);

                    const newOrder = arrayMove(siblings, oldIndex, newIndex);

                    // Update order in DB
                    await Promise.all(newOrder.map((file, index) =>
                        db.files.update(file.id!, { order: index })
                    ));
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
            <div style={{
                padding: '0.5rem 1rem',
                borderBottom: '1px solid var(--border-color)'
            }}>
                <div
                    ref={setNodeRef}
                    style={{
                        padding: '0.5rem',
                        borderRadius: '4px',
                        border: '2px dashed var(--border-color)',
                        textAlign: 'center',
                        color: 'var(--text-secondary)',
                        fontSize: '0.85rem',
                        backgroundColor: isOver ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-secondary)',
                        transition: 'background-color 0.2s'
                    }}
                >
                    📁 Root (Drop here to move to root)
                </div>
            </div>
        );
    };

    return (
        <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={createFile} title="New File" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem' }}>
                        <Plus size={16} /> File
                    </button>
                    <button onClick={createFolder} title="New Folder" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem' }}>
                        <FolderPlus size={16} /> Folder
                    </button>
                </div>
                <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '0.5rem' }}>
                    <button onClick={exportData} title="Export Data" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                        <Download size={14} /> Export
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} title="Import Data" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                        <Upload size={14} /> Import
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImport}
                        style={{ display: 'none' }}
                        accept=".json"
                    />
                </div>
                {/* Root Drop Zone - Fixed above scrollable area */}
                <RootDropZone />
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                    <FileTree folders={folders || []} files={files || []} />
                </div>
            </div>
        </DndContext>
    );
}
