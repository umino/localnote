import Dexie, { type EntityTable } from 'dexie';
import type { Folder, TextFile, FileHistory } from '../types';

const db = new Dexie('LocalNoteDB') as Dexie & {
    folders: EntityTable<Folder, 'id'>;
    files: EntityTable<TextFile, 'id'>;
    history: EntityTable<FileHistory, 'id'>;
};

db.version(1).stores({
    folders: '++id, parentId, name, createdAt, updatedAt',
    files: '++id, folderId, title, createdAt, updatedAt', // content is not indexed
    history: '++id, fileId, timestamp'
});

export { db };
