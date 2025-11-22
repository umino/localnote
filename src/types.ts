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
