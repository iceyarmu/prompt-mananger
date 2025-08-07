export * from './fileTree';
export * from './services';

export interface FileInfo {
  name: string;
  path: string;
  size?: number;
  type: 'file' | 'folder';
  modified?: Date;
  permissions?: string;
}