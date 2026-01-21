export interface Folder {
  id?: number;
  parentId: number | null; // null for root folders
  name: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TextFile {
  id?: number;
  folderId: number | null; // null for root files
  title: string;
  content: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileHistory {
  id?: number;
  fileId: number;
  content: string;
  timestamp: Date;
}

export type HistoryRetentionPolicy =
  | { type: 'unlimited' }
  | { type: 'count'; value: number }
  | { type: 'days'; value: number };

export interface AppSettings {
  key: string;
  value: any;
}
