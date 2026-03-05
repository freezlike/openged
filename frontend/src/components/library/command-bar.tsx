import {
  ChevronDown,
  Download,
  FilePlus2,
  History,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Share2,
  Trash2,
  Upload,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export interface CommandBarProps {
  selectedCount: number;
  onNewFolder: () => void;
  onUpload: () => void;
  onEditMetadata: () => void;
  onDownload: () => void;
  onVersions: () => void;
  onStartWorkflow: () => void;
  onDelete: () => void;
}

export function CommandBar({
  selectedCount,
  onNewFolder,
  onUpload,
  onEditMetadata,
  onDownload,
  onVersions,
  onStartWorkflow,
  onDelete,
}: CommandBarProps) {
  const { t } = useTranslation(['common']);
  const hasSelection = selectedCount > 0;

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-y border-[#e2e8f0] bg-white/90 px-3 py-2 backdrop-blur">
      <Button variant="secondary" size="sm" onClick={onNewFolder}>
        <Plus className="h-4 w-4" />
        {t('actions.new')}
      </Button>

      <Button variant="secondary" size="sm" onClick={onUpload}>
        <Upload className="h-4 w-4" />
        {t('actions.upload')}
      </Button>

      <Button variant="secondary" size="sm" onClick={onEditMetadata} disabled={!hasSelection}>
        <Pencil className="h-4 w-4" />
        {t('actions.editMetadata')}
      </Button>

      <Button variant="secondary" size="sm" disabled={!hasSelection}>
        <Share2 className="h-4 w-4" />
        {t('actions.share')}
      </Button>

      <Button variant="secondary" size="sm" onClick={onDownload} disabled={!hasSelection}>
        <Download className="h-4 w-4" />
        {t('actions.download')}
      </Button>

      <Button variant="secondary" size="sm" onClick={onVersions} disabled={!hasSelection}>
        <History className="h-4 w-4" />
        {t('actions.versionHistory')}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" disabled={!hasSelection}>
            <Play className="h-4 w-4" />
            {t('actions.automate')}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onStartWorkflow}>{t('actions.startWorkflow')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="secondary" size="sm" onClick={onDelete} disabled={!hasSelection}>
        <Trash2 className="h-4 w-4" />
        {t('actions.delete')}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onNewFolder}>
            <FilePlus2 className="h-4 w-4" />
            {`${t('actions.new')} ${t('library:contentTypes.folder')}`}
          </DropdownMenuItem>
          <DropdownMenuItem>{t('actions.pinToTop')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
