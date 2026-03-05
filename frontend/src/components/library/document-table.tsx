import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ColumnDef,
  ColumnOrderState,
  ColumnSizingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Download,
  Eye,
  FolderOpen,
  GripHorizontal,
  History,
  Play,
  Settings2,
} from 'lucide-react';

import { FileTypeIcon } from './file-type-icon';
import { StatusBadge } from './status-badge';
import { Checkbox } from '../ui/checkbox';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../ui/context-menu';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn, formatDate } from '../../lib/utils';
import { LibraryDocumentItem, LibraryFolderItem } from '../../types/domain';
import { Skeleton } from '../ui/skeleton';

export type LibraryRowItem =
  | (LibraryFolderItem & {
      title: string;
      status?: undefined;
      contentType?: undefined;
      confidentiality?: undefined;
      createdBy?: undefined;
      modifiedBy?: undefined;
    })
  | LibraryDocumentItem;

interface DocumentTableProps {
  rows: LibraryRowItem[];
  loading?: boolean;
  viewKey: string;
  resetSelectionToken?: number;
  onSelectionChange: (rows: LibraryRowItem[]) => void;
  onOpenPreview: (item: LibraryRowItem) => void;
  onOpenVersions: (item: LibraryRowItem) => void;
  onStartWorkflow: (item: LibraryRowItem) => void;
  onDownload: (item: LibraryRowItem) => void;
  onOpenFolder: (folderId: string) => void;
}

interface ViewPreferences {
  columnVisibility: VisibilityState;
  columnOrder: ColumnOrderState;
  columnSizing: ColumnSizingState;
}

function loadPreferences(key: string): ViewPreferences | null {
  const raw = localStorage.getItem(key);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ViewPreferences;
  } catch {
    return null;
  }
}

function savePreferences(key: string, preferences: ViewPreferences) {
  localStorage.setItem(key, JSON.stringify(preferences));
}

export function DocumentTable({
  rows,
  loading,
  viewKey,
  resetSelectionToken,
  onSelectionChange,
  onOpenPreview,
  onOpenVersions,
  onStartWorkflow,
  onDownload,
  onOpenFolder,
}: DocumentTableProps) {
  const { t } = useTranslation(['library', 'common']);
  const storageKey = `openged.view.${viewKey}`;

  const initialPreferences = useMemo(() => loadPreferences(storageKey), [storageKey]);

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    initialPreferences?.columnVisibility ?? {},
  );
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
    initialPreferences?.columnOrder ?? [],
  );
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(
    initialPreferences?.columnSizing ?? {},
  );

  const columns = useMemo<ColumnDef<LibraryRowItem>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllRowsSelected() || (table.getIsSomeRowsSelected() && 'indeterminate')}
            onCheckedChange={(value) => table.toggleAllRowsSelected(Boolean(value))}
            aria-label={t('table.selectAll')}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
            aria-label={t('table.selectRow')}
          />
        ),
        enableResizing: false,
        size: 38,
      },
      {
        accessorKey: 'title',
        header: t('table.name'),
        size: 320,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="group flex min-w-0 items-center gap-2">
              <FileTypeIcon
                fileName={item.kind === 'folder' ? item.name : item.title}
                kind={item.kind}
                className="h-4 w-4 shrink-0"
              />
              <span className="truncate text-left text-sm text-[#0f172a] hover:underline">
                {item.kind === 'folder' ? item.name : item.title}
              </span>
              <div className="ml-auto hidden items-center gap-1 group-hover:flex">
                {item.kind === 'document' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenPreview(item)}
                      className="rounded p-1 text-[#64748b] hover:bg-[#e2e8f0]"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownload(item)}
                      className="rounded p-1 text-[#64748b] hover:bg-[#e2e8f0]"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenFolder(item.id)}
                    className="rounded p-1 text-[#64748b] hover:bg-[#e2e8f0]"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'updatedAt',
        header: t('table.modified'),
        size: 150,
        cell: ({ row }) => <span className="text-xs text-[#334155]">{formatDate(row.original.updatedAt)}</span>,
      },
      {
        accessorKey: 'modifiedBy',
        header: t('table.modifiedBy'),
        size: 180,
        cell: ({ row }) => (
          <span className="truncate text-xs text-[#334155]">
            {row.original.kind === 'document' ? row.original.modifiedBy.email : '-'}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: t('table.created'),
        size: 150,
        cell: ({ row }) => <span className="text-xs text-[#334155]">{formatDate(row.original.createdAt)}</span>,
      },
      {
        accessorKey: 'createdBy',
        header: t('table.createdBy'),
        size: 180,
        cell: ({ row }) => (
          <span className="truncate text-xs text-[#334155]">
            {row.original.kind === 'document' ? row.original.createdBy.email : '-'}
          </span>
        ),
      },
      {
        accessorKey: 'contentType',
        header: t('table.type'),
        size: 130,
        cell: ({ row }) => (
          <span className="text-xs text-[#334155]">
            {row.original.kind === 'document' ? row.original.contentType : t('contentTypes.folder')}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('table.status'),
        size: 140,
        cell: ({ row }) =>
          row.original.kind === 'document' ? <StatusBadge status={row.original.status} /> : <span>-</span>,
      },
      {
        accessorKey: 'confidentiality',
        header: t('table.confidentiality'),
        size: 150,
        cell: ({ row }) => (
          <span className="text-xs text-[#334155]">
            {row.original.kind === 'document' ? row.original.confidentiality ?? '-' : '-'}
          </span>
        ),
      },
    ],
    [onDownload, onOpenFolder, onOpenPreview, t],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      rowSelection,
      columnVisibility,
      columnOrder,
      columnSizing,
    },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: 'onChange',
    getRowId: (row) => row.id,
    enableRowSelection: true,
    enableMultiRowSelection: true,
  });

  useEffect(() => {
    const selectedRows = table
      .getSelectedRowModel()
      .flatRows.map((row) => row.original)
      .filter((item) => item.kind === 'document' || item.kind === 'folder');

    onSelectionChange(selectedRows);
  }, [onSelectionChange, rowSelection, table]);

  useEffect(() => {
    setRowSelection({});
  }, [resetSelectionToken]);

  useEffect(() => {
    savePreferences(storageKey, {
      columnOrder,
      columnSizing,
      columnVisibility,
    });
  }, [columnOrder, columnSizing, columnVisibility, storageKey]);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowModel = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: rowModel.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 12,
  });

  const moveColumn = (columnId: string, direction: 'left' | 'right') => {
    const order = table.getState().columnOrder.length
      ? table.getState().columnOrder
      : table
          .getAllLeafColumns()
          .map((column) => column.id)
          .filter((column) => column !== 'select');

    const selectedIndex = order.indexOf(columnId);

    if (selectedIndex < 0) {
      return;
    }

    const targetIndex = direction === 'left' ? selectedIndex - 1 : selectedIndex + 1;

    if (targetIndex < 0 || targetIndex >= order.length) {
      return;
    }

    const nextOrder = [...order];
    [nextOrder[selectedIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[selectedIndex]];
    table.setColumnOrder(['select', ...nextOrder]);
  };

  const selectRowFromClick = (event: MouseEvent, rowId: string) => {
    const withModifier = event.metaKey || event.ctrlKey || event.shiftKey;

    if (!withModifier) {
      table.setRowSelection({ [rowId]: true });
      return;
    }

    const row = table.getRow(rowId);
    row?.toggleSelected(!row.getIsSelected());
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-white px-3 py-2">
        <div className="text-xs text-[#64748b]">
          {table.getSelectedRowModel().rows.length > 0
            ? t('table.selectedCount', { count: table.getSelectedRowModel().rows.length })
            : t('table.itemsCount', { count: rows.length })}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm">
              <Settings2 className="h-4 w-4" />
              {t('table.columns')}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            {table
              .getAllLeafColumns()
              .filter((column) => column.id !== 'select')
              .map((column) => (
                <div key={column.id} className="flex items-center gap-1 px-1 py-0.5">
                  <DropdownMenuCheckboxItem
                    checked={column.getIsVisible()}
                    onCheckedChange={(checked: boolean) => column.toggleVisibility(Boolean(checked))}
                    className="flex-1"
                  >
                    {column.columnDef.header as string}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuItem onClick={() => moveColumn(column.id, 'left')}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => moveColumn(column.id, 'right')}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </DropdownMenuItem>
                </div>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto bg-white">
        <table className="w-full border-separate border-spacing-0" style={{ width: table.getTotalSize() }}>
          <thead className="sticky top-0 z-10 bg-white">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="relative border-b border-[#e2e8f0] px-2 py-2 text-left text-xs font-semibold text-[#475569]"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}

                    {header.column.getCanResize() ? (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={cn(
                          'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none bg-transparent hover:bg-[#bfdbfe]',
                          header.column.getIsResizing() && 'bg-[#60a5fa]',
                        )}
                      >
                        <GripHorizontal className="pointer-events-none absolute right-[-6px] top-1/2 h-3 w-3 -translate-y-1/2 text-[#94a3b8]" />
                      </div>
                    ) : null}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: 'relative',
            }}
          >
            {loading ? (
              <tr>
                <td className="px-3 py-4" colSpan={table.getAllLeafColumns().length}>
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-[92%]" />
                    <Skeleton className="h-8 w-[86%]" />
                  </div>
                </td>
              </tr>
            ) : null}

            {!loading && rowModel.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-sm text-[#64748b]" colSpan={table.getAllLeafColumns().length}>
                  {t('table.noDocuments')}
                </td>
              </tr>
            ) : null}

            {!loading
              ? rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rowModel[virtualRow.index];
                  if (!row) {
                    return null;
                  }

                  const item = row.original;

                  return (
                    <ContextMenu key={row.id}>
                      <ContextMenuTrigger asChild>
                        <tr
                          data-state={row.getIsSelected() ? 'selected' : ''}
                          className={cn(
                            'group absolute left-0 top-0 table w-full table-fixed border-b border-[#f1f5f9] text-sm hover:bg-[#f8fafc]',
                            row.getIsSelected() && 'bg-[#eff6ff]',
                          )}
                          style={{ transform: `translateY(${virtualRow.start}px)` }}
                          onDoubleClick={() => {
                            if (item.kind === 'folder') {
                              onOpenFolder(item.id);
                              return;
                            }
                            onOpenPreview(item);
                          }}
                          onClick={(event) => {
                            const target = event.target as HTMLElement;
                            if (target.closest('button,input,[role="menuitem"],a')) {
                              return;
                            }
                            selectRowFromClick(event, row.id);
                          }}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} style={{ width: cell.column.getSize() }} className="px-2 py-2">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        {item.kind === 'folder' ? (
                          <>
                            <ContextMenuItem onClick={() => onOpenFolder(item.id)}>
                              {t('table.openFolder')}
                            </ContextMenuItem>
                          </>
                        ) : (
                          <>
                            <ContextMenuItem onClick={() => onOpenPreview(item)}>{t('table.open')}</ContextMenuItem>
                            <ContextMenuItem onClick={() => onOpenPreview(item)}>
                              {t('common:actions.preview')}
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => onDownload(item)}>
                              {t('common:actions.download')}
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => onOpenVersions(item)}>{t('table.versions')}</ContextMenuItem>
                            <ContextMenuItem onClick={() => onStartWorkflow(item)}>
                              {t('common:actions.startWorkflow')}
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem>{t('table.managePermissions')}</ContextMenuItem>
                          </>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })
              : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
