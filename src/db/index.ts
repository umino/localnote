import Dexie, { type EntityTable } from 'dexie';
import type { Folder, TextFile, FileHistory } from '../types';

const db = new Dexie('LocalNoteDB') as Dexie & {
    folders: EntityTable<Folder, 'id'>;
    files: EntityTable<TextFile, 'id'>;
    history: EntityTable<FileHistory, 'id'>;
};

// Version 1: Initial schema
db.version(1).stores({
    folders: '++id, parentId, name, createdAt, updatedAt',
    files: '++id, folderId, title, createdAt, updatedAt',
    history: '++id, fileId, timestamp'
});

// Version 2: Add order field for sorting
db.version(2).stores({
    folders: '++id, parentId, name, order, createdAt, updatedAt',
    files: '++id, folderId, title, order, createdAt, updatedAt',
    history: '++id, fileId, timestamp'
}).upgrade(async (trans) => {
    // Migration: Add order field to existing data
    const folders = await trans.table('folders').toArray();
    const files = await trans.table('files').toArray();

    // Assign order based on creation date for existing folders
    folders.forEach((folder: any, index: number) => {
        trans.table('folders').update(folder.id, { order: index });
    });

    // Assign order based on creation date for existing files
    files.forEach((file: any, index: number) => {
        trans.table('files').update(file.id, { order: index });
    });
});

export { db };
