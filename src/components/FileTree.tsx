import type { Folder, TextFile } from '../types';
import { useStore } from '../store/useStore';
import { ChevronRight, ChevronDown, FileText, Folder as FolderIcon, FolderOpen, Trash2 } from 'lucide-react';
import { db } from '../db';
import { useDroppable } from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React from 'react';

interface FileTreeProps {
    folders: Folder[];
    files: TextFile[];
    parentId?: number | null;
    level?: number;
}

// Draggable/Sortable Item Components
function DraggableFolder({ folder, isExpanded, toggleFolder, handleDeleteFolder, children }: any) {
    const [isEditingName, setIsEditingName] = React.useState(false);
    const [folderName, setFolderName] = React.useState(folder.name);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
        over
    } = useSortable({
        id: `folder-${folder.id}`,
        data: { type: 'folder', id: folder.id, parentId: folder.parentId }
    });

    const { setNodeRef: setDroppableRef, isOver: isOverDrop } = useDroppable({
        id: `folder-drop-${folder.id}`,
        data: { type: 'folder', id: folder.id }
    });

    const isOverSort = over?.id === `folder-${folder.id}`;

    const { editingItemId, editingItemType, setEditingItem } = useStore();

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
        <div className="select-none">
            <div
                ref={(node) => {
                    setNodeRef(node);
                    setDroppableRef(node);
                }}
                {...attributes}
                {...listeners}
                className={`
                    flex items-center px-2 py-1.5 rounded-lg transition-all duration-300 group relative
                    ${isOverDrop
                        ? 'bg-primary-500/15 ring-2 ring-primary-500 ring-inset shadow-lg'
                        : 'hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80'}
                    ${isDragging ? 'opacity-40 scale-[0.98] z-50' : 'opacity-100'}
                    ${isOverSort && !isOverDrop ? 'border-t-2 border-primary-500' : ''}
                    cursor-grab active:cursor-grabbing
                `}
                style={{
                    transform: CSS.Translate.toString(transform),
                    transition,
                }}
            >
                <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!isEditingName) toggleFolder(folder.id!);
                    }}
                    className="mr-1.5 p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors z-10"
                >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <div
                    className={`mr-2 transition-colors ${isExpanded || isOverDrop ? 'text-primary-500' : 'text-primary-400/70'}`}
                >
                    {isExpanded ? <FolderOpen size={18} /> : <FolderIcon size={18} />}
                </div>
                {isEditingName ? (
                    <input
                        type="text"
                        value={folderName}
                        onChange={(e) => setFolderName(e.target.value)}
                        onBlur={handleNameSave}
                        onPointerDown={(e) => e.stopPropagation()} // Prevent drag starting on input
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') handleNameSave();
                            if (e.key === 'Escape') {
                                setFolderName(folder.name);
                                setIsEditingName(false);
                            }
                        }}
                        autoFocus
                        className="flex-1 min-w-0 bg-white dark:bg-zinc-800 border-2 border-primary-500 rounded px-1.5 py-0.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none shadow-sm z-10"
                    />
                ) : (
                    <span
                        onPointerDown={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            setIsEditingName(true);
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            const { setSelectedFolderId } = useStore.getState();
                            setSelectedFolderId(folder.id!);
                        }}
                        className="flex-1 truncate text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
                        title="Double-click to rename"
                    >
                        {folder.name}
                    </span>
                )}
                <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(e, folder.id!);
                    }}
                    className="p-1 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-red-500 dark:hover:text-red-400 transition-all duration-200 z-10"
                    title="Delete Folder"
                >
                    <Trash2 size={16} />
                </button>
            </div>
            {children}
        </div>
    );
}

// Draggable/Sortable File Item
function DraggableFile({ file, activeFileId, setActiveFileId, handleDeleteFile }: any) {
    const [isEditingTitle, setIsEditingTitle] = React.useState(false);
    const [fileTitle, setFileTitle] = React.useState(file.title);
    const { editingItemId, editingItemType, setEditingItem } = useStore();

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
        over
    } = useSortable({
        id: `file-${file.id}`,
        data: { type: 'file', id: file.id, folderId: file.folderId }
    });

    const isOverSort = over?.id === `file-${file.id}`;

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
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
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            className={`
                flex items-center px-2 py-1.5 rounded-lg transition-all duration-300 group relative select-none
                ${activeFileId === file.id
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-900 dark:text-primary-100 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80'}
                ${isDragging ? 'opacity-40 scale-[0.98] shadow-none z-50' : 'opacity-100'}
                ${isOverSort ? 'border-t-2 border-primary-500' : ''}
                cursor-grab active:cursor-grabbing
            `}
            style={style}
        >
            <div
                className={`
                    mr-2 ml-5 transition-colors
                    ${activeFileId === file.id ? 'text-primary-500' : 'text-zinc-400 dark:text-zinc-500'}
                `}
            >
                <FileText size={16} />
            </div>
            {isEditingTitle ? (
                <input
                    type="text"
                    value={fileTitle}
                    onChange={(e) => setFileTitle(e.target.value)}
                    onBlur={handleTitleSave}
                    onPointerDown={(e) => e.stopPropagation()} // Prevent drag starting on input
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') handleTitleSave();
                        if (e.key === 'Escape') {
                            setFileTitle(file.title);
                            setIsEditingTitle(false);
                        }
                    }}
                    autoFocus
                    className="flex-1 min-w-0 bg-white dark:bg-zinc-800 border-2 border-primary-500 rounded px-1.5 py-0.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none shadow-sm z-10"
                />
            ) : (
                <span
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        setActiveFileId(file.id!);
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        setIsEditingTitle(true);
                    }}
                    className="flex-1 truncate text-sm font-medium cursor-pointer"
                    title="Double-click to rename"
                >
                    {file.title}
                </span>
            )}
            <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFile(e, file.id!);
                }}
                className="p-1 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-red-500 dark:hover:text-red-400 transition-all duration-200 z-10"
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
        <div className={level > 0 ? "ml-4 pl-2 border-l border-zinc-200 dark:border-zinc-800" : ""}>
            <SortableContext items={currentFolders.map(f => `folder-${f.id}`)} strategy={verticalListSortingStrategy}>
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
            </SortableContext>
            <SortableContext items={currentFiles.map(f => `file-${f.id}`)} strategy={verticalListSortingStrategy}>
                {currentFiles.map((file) => (
                    <DraggableFile
                        key={file.id}
                        file={file}
                        activeFileId={activeFileId}
                        setActiveFileId={setActiveFileId}
                        handleDeleteFile={handleDeleteFile}
                    />
                ))}
            </SortableContext>
        </div>
    );

    return content;
}
