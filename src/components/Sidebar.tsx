import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { FileTree } from './FileTree';
import { Plus, FolderPlus, Download, Upload } from 'lucide-react';
import { exportData, importData } from '../utils/dataTransfer';
import { useRef } from 'react';

export function Sidebar() {
    const folders = useLiveQuery(() => db.folders.toArray());
    const files = useLiveQuery(() => db.files.toArray());
    const fileInputRef = useRef<HTMLInputElement>(null);

    const createFolder = async () => {
        await db.folders.add({
            parentId: null,
            name: 'New Folder',
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    };

    const createFile = async () => {
        await db.files.add({
            folderId: null,
            title: 'Untitled',
            content: '',
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            importData(file);
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
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
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                {/* We will pass data to FileTree here */}
                <FileTree folders={folders || []} files={files || []} />
            </div>
        </div>
    );
}
