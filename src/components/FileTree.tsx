import type { Folder, TextFile } from '../types';
import { useStore } from '../store/useStore';
import { ChevronRight, ChevronDown, FileText, Folder as FolderIcon, FolderOpen, Trash2 } from 'lucide-react';
import { db } from '../db';
import { DndContext, type DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface FileTreeProps {
    folders: Folder[];
    files: TextFile[];
    parentId?: number | null;
    level?: number;
}

// Draggable/Droppable Item Components
function DraggableFolder({ folder, isExpanded, toggleFolder, handleDeleteFolder, children }: any) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `folder-${folder.id}`,
        data: { type: 'folder', id: folder.id, parentId: folder.parentId }
    });
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
        id: `folder-drop-${folder.id}`,
        data: { type: 'folder', id: folder.id }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        backgroundColor: isOver ? 'rgba(59, 130, 246, 0.2)' : undefined,
    };

    return (
        <div ref={setDroppableRef} style={style}>
            <div
                ref={setNodeRef}
                {...listeners}
                {...attributes}
                onClick={() => toggleFolder(folder.id!)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.25rem 0.5rem',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    color: 'var(--text-secondary)',
                }}
                className="hover:bg-white/5 group"
            >
                <span style={{ marginRight: '0.25rem' }}>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                <span style={{ marginRight: '0.5rem', color: 'var(--accent-color)' }}>
                    {isExpanded ? <FolderOpen size={16} /> : <FolderIcon size={16} />}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {folder.name}
                </span>
                <button
                    onClick={(e) => handleDeleteFolder(e, folder.id!)}
                    style={{ padding: '2px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', opacity: 0 }}
                    className="group-hover:opacity-100 hover:text-red-500"
                    title="Delete Folder"
                >
                    <Trash2 size={14} />
                </button>
            </div>
            {children}
        </div>
    );
}

function DraggableFile({ file, activeFileId, setActiveFileId, handleDeleteFile }: any) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `file-${file.id}`,
        data: { type: 'file', id: file.id, folderId: file.folderId }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
    };

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            onClick={() => setActiveFileId(file.id!)}
            style={{
                ...style,
                display: 'flex',
                alignItems: 'center',
                padding: '0.25rem 0.5rem',
                cursor: 'pointer',
                borderRadius: '4px',
                backgroundColor: activeFileId === file.id ? 'var(--bg-tertiary)' : 'transparent',
                color: activeFileId === file.id ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
            className="hover:bg-white/5 group"
        >
            <span style={{ marginRight: '0.5rem', marginLeft: '1.25rem' }}>
                <FileText size={14} />
            </span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.title || 'Untitled'}
            </span>
            <button
                onClick={(e) => handleDeleteFile(e, file.id!)}
                style={{ padding: '2px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', opacity: 0 }}
                className="group-hover:opacity-100 hover:text-red-500"
                title="Delete File"
            >
                <Trash2 size={14} />
            </button>
        </div>
    );
}

export function FileTree({ folders, files, parentId = null, level = 0 }: FileTreeProps) {
    const { expandedFolderIds, toggleFolder, activeFileId, setActiveFileId } = useStore();

    const currentFolders = folders.filter((f) => f.parentId === parentId);
    const currentFiles = files.filter((f) => f.folderId === parentId);

    const handleDeleteFile = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this file?')) {
            await db.files.delete(id);
            if (activeFileId === id) setActiveFileId(null);
        }
    };

    const handleDeleteFolder = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this folder and all its contents?')) {
            await db.folders.delete(id);
        }
    };

    // Only render DndContext at the root level
    const content = (
        <div style={{ paddingLeft: level > 0 ? '1rem' : 0 }}>
            {currentFolders.map((folder) => {
                const isExpanded = expandedFolderIds.includes(folder.id!);
                return (
                    <DraggableFolder
                        key={folder.id}
                        folder={folder}
                        isExpanded={isExpanded}
                        toggleFolder={toggleFolder}
                        handleDeleteFolder={handleDeleteFolder}
                    >
                        {isExpanded && (
                            <FileTree
                                folders={folders}
                                files={files}
                                parentId={folder.id}
                                level={level + 1}
                            />
                        )}
                    </DraggableFolder>
                );
            })}
            {currentFiles.map((file) => (
                <DraggableFile
                    key={file.id}
                    file={file}
                    activeFileId={activeFileId}
                    setActiveFileId={setActiveFileId}
                    handleDeleteFile={handleDeleteFile}
                />
            ))}
        </div>
    );

    if (level === 0) {
        const handleDragEnd = async (event: DragEndEvent) => {
            const { active, over } = event;
            if (!over) return;

            const activeId = active.id as string;
            const overId = over.id as string;

            // File dropped into Folder
            if (activeId.startsWith('file-') && overId.startsWith('folder-drop-')) {
                const fileId = parseInt(activeId.replace('file-', ''));
                const folderId = parseInt(overId.replace('folder-drop-', ''));

                if (active.data.current?.folderId !== folderId) {
                    await db.files.update(fileId, { folderId, updatedAt: new Date() });
                }
            }

            // Folder dropped into Folder
            if (activeId.startsWith('folder-') && overId.startsWith('folder-drop-')) {
                const draggedFolderId = parseInt(activeId.replace('folder-', ''));
                const targetFolderId = parseInt(overId.replace('folder-drop-', ''));

                if (draggedFolderId !== targetFolderId && active.data.current?.parentId !== targetFolderId) {
                    // Prevent circular dependency (simple check: don't drop into self)
                    // A more robust check would be to traverse up the tree
                    await db.folders.update(draggedFolderId, { parentId: targetFolderId, updatedAt: new Date() });
                }
            }
        };

        return (
            <DndContext onDragEnd={handleDragEnd}>
                {content}
            </DndContext>
        );
    }

    return content;
}
