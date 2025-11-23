import type { Folder, TextFile } from '../types';
import { useStore } from '../store/useStore';
import { ChevronRight, ChevronDown, FileText, Folder as FolderIcon, FolderOpen, Trash2 } from 'lucide-react';
import { db } from '../db';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import React from 'react';

interface FileTreeProps {
    folders: Folder[];
    files: TextFile[];
    parentId?: number | null;
    level?: number;
}

// Draggable/Droppable Item Components
function DraggableFolder({ folder, isExpanded, toggleFolder, handleDeleteFolder, children }: any) {
    const [isEditingName, setIsEditingName] = React.useState(false);
    const [folderName, setFolderName] = React.useState(folder.name);
    const { editingItemId, editingItemType, setEditingItem } = useStore();

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

    // Auto-edit when this folder is newly created
    React.useEffect(() => {
        if (editingItemId === folder.id && editingItemType === 'folder') {
            setIsEditingName(true);
            setEditingItem(null, null);  // Clear editing state
        }
    }, [editingItemId, editingItemType, folder.id, setEditingItem]);

    const handleNameSave = async () => {
        if (folderName.trim() && folderName !== folder.name) {
            await db.folders.update(folder.id!, { name: folderName.trim(), updatedAt: new Date() });
        } else {
            setFolderName(folder.name);
        }
        setIsEditingName(false);
    };

    return (
        <div ref={setDroppableRef} style={style}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    color: 'var(--text-secondary)',
                }}
                className="hover:bg-white/5 group"
            >
                <span
                    onClick={() => !isEditingName && toggleFolder(folder.id!)}
                    style={{ marginRight: '0.25rem', cursor: 'pointer' }}
                >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                <span
                    ref={setNodeRef}
                    {...listeners}
                    {...attributes}
                    style={{ marginRight: '0.5rem', color: 'var(--accent-color)', cursor: 'grab' }}
                    title="Drag to move"
                >
                    {isExpanded ? <FolderOpen size={16} /> : <FolderIcon size={16} />}
                </span>
                {isEditingName ? (
                    <input
                        type="text"
                        value={folderName}
                        onChange={(e) => setFolderName(e.target.value)}
                        onBlur={handleNameSave}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleNameSave();
                            if (e.key === 'Escape') {
                                setFolderName(folder.name);
                                setIsEditingName(false);
                            }
                        }}
                        autoFocus
                        style={{
                            flex: 1,
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--accent-color)',
                            borderRadius: '2px',
                            color: 'var(--text-primary)',
                            padding: '2px 4px',
                            outline: 'none',
                            fontSize: '0.9rem'
                        }}
                    />
                ) : (
                    <span
                        onDoubleClick={() => setIsEditingName(true)}
                        onClick={(e) => {
                            e.stopPropagation();
                            const { setSelectedFolderId } = useStore.getState();
                            setSelectedFolderId(folder.id!);
                        }}
                        style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                        title="Double-click to rename"
                    >
                        {folder.name}
                    </span>
                )}
                <button
                    onClick={(e) => handleDeleteFolder(e, folder.id!)}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.3')}
                    style={{
                        padding: '4px',
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        opacity: 0.3,  // 常に薄く表示
                        transition: 'opacity 0.2s',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                    }}
                    title="Delete Folder"
                >
                    <Trash2 size={16} />  {/* サイズを大きく */}
                </button>
            </div>
            {children}
        </div>
    );
}

// Draggable File Item
function DraggableFile({ file, activeFileId, setActiveFileId, handleDeleteFile }: any) {
    const [isEditingTitle, setIsEditingTitle] = React.useState(false);
    const [fileTitle, setFileTitle] = React.useState(file.title);
    const { editingItemId, editingItemType, setEditingItem } = useStore();

    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `file-${file.id}`,
        data: { type: 'file', id: file.id, folderId: file.folderId }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
    };

    // Auto-edit when this file is newly created
    React.useEffect(() => {
        if (editingItemId === file.id && editingItemType === 'file') {
            setIsEditingTitle(true);
            setEditingItem(null, null);  // Clear editing state
        }
    }, [editingItemId, editingItemType, file.id, setEditingItem]);

    const handleTitleSave = async () => {
        if (fileTitle.trim() && fileTitle !== file.title) {
            await db.files.update(file.id!, { title: fileTitle.trim(), updatedAt: new Date() });
        } else {
            setFileTitle(file.title);
        }
        setIsEditingTitle(false);
    };

    return (
        <div
            style={{
                ...style,
                display: 'flex',
                alignItems: 'center',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                backgroundColor: activeFileId === file.id ? 'var(--bg-tertiary)' : 'transparent',
                color: activeFileId === file.id ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
            className="hover:bg-white/5 group"
        >
            <span
                ref={setNodeRef}
                {...listeners}
                {...attributes}
                style={{ marginRight: '0.5rem', marginLeft: '1.25rem', cursor: 'grab' }}
                title="Drag to move"
            >
                <FileText size={14} />
            </span>
            {isEditingTitle ? (
                <input
                    type="text"
                    value={fileTitle}
                    onChange={(e) => setFileTitle(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleTitleSave();
                        if (e.key === 'Escape') {
                            setFileTitle(file.title);
                            setIsEditingTitle(false);
                        }
                    }}
                    autoFocus
                    style={{
                        flex: 1,
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--accent-color)',
                        borderRadius: '2px',
                        color: 'var(--text-primary)',
                        padding: '2px 4px',
                        outline: 'none',
                        fontSize: '0.9rem'
                    }}
                />
            ) : (
                <span
                    onClick={() => setActiveFileId(file.id!)}
                    onDoubleClick={() => setIsEditingTitle(true)}
                    style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                    title="Double-click to rename"
                >
                    {file.title}
                </span>
            )}
            <button
                onClick={(e) => handleDeleteFile(e, file.id!)}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.3')}
                style={{
                    padding: '4px',
                    background: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    opacity: 0.3,  // 常に薄く表示
                    transition: 'opacity 0.2s',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                }}
                title="Delete File"
            >
                <Trash2 size={16} />
            </button>
        </div>
    );
}

export function FileTree({ folders, files, parentId = null, level = 0 }: FileTreeProps) {
    const { expandedFolderIds, toggleFolder, activeFileId, setActiveFileId } = useStore();

    // Sort by order field
    const currentFolders = folders
        .filter((f) => f.parentId === parentId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    const currentFiles = files
        .filter((f) => f.folderId === parentId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    const handleDeleteFile = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        // confirm()を使用すると無限ループが発生するため削除
        // ユーザーは削除ボタンをクリックする際に慎重になる必要がある
        await db.files.delete(id);
        if (activeFileId === id) setActiveFileId(null);
    };

    const handleDeleteFolder = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        // confirm()を使用すると無限ループが発生するため削除
        await db.folders.delete(id);
    };

    // Render content
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
                                parentId={folder.id!}
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

    return content;
}
