import {
  File,
  FileArchive,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  FileVideo,
  Folder,
} from 'lucide-react';

interface FileTypeIconProps {
  fileName?: string;
  mimeType?: string;
  kind?: 'folder' | 'document';
  className?: string;
}

function extensionFromName(name?: string) {
  if (!name || !name.includes('.')) {
    return '';
  }

  return name.split('.').pop()?.toLowerCase() ?? '';
}

export function FileTypeIcon({ fileName, mimeType, kind = 'document', className }: FileTypeIconProps) {
  if (kind === 'folder') {
    return <Folder className={className ?? 'h-4 w-4 text-[#f59e0b]'} />;
  }

  const extension = extensionFromName(fileName);

  if (mimeType?.includes('image') || ['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(extension)) {
    return <FileImage className={className ?? 'h-4 w-4 text-[#0284c7]'} />;
  }

  if (
    mimeType?.includes('spreadsheet') ||
    ['xls', 'xlsx', 'csv'].includes(extension)
  ) {
    return <FileSpreadsheet className={className ?? 'h-4 w-4 text-[#16a34a]'} />;
  }

  if (mimeType?.includes('pdf') || extension === 'pdf') {
    return <FileType className={className ?? 'h-4 w-4 text-[#dc2626]'} />;
  }

  if (mimeType?.includes('text') || ['txt', 'md', 'doc', 'docx'].includes(extension)) {
    return <FileText className={className ?? 'h-4 w-4 text-[#334155]'} />;
  }

  if (mimeType?.includes('zip') || ['zip', 'rar', '7z'].includes(extension)) {
    return <FileArchive className={className ?? 'h-4 w-4 text-[#9333ea]'} />;
  }

  if (mimeType?.includes('video')) {
    return <FileVideo className={className ?? 'h-4 w-4 text-[#2563eb]'} />;
  }

  if (mimeType?.includes('json') || ['js', 'ts', 'tsx', 'jsx', 'json'].includes(extension)) {
    return <FileCode2 className={className ?? 'h-4 w-4 text-[#0ea5e9]'} />;
  }

  return <File className={className ?? 'h-4 w-4 text-[#64748b]'} />;
}
