import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { createLookupValue, LookupEntity, LookupItem, searchLookup } from '../../api/lookup';
import { useDebouncedValue } from '../../hooks/use-debounced-value';
import { cn } from '../../lib/utils';
import { Input } from '../ui/input';

export interface SmartAutocompleteProps {
  entity: LookupEntity;
  value: LookupItem | null;
  onChange: (value: LookupItem | null) => void;
  placeholder?: string;
  taxonomy?: string;
  activeOnly?: boolean;
  minChars?: number;
  allowCreate?: boolean;
  disabled?: boolean;
  className?: string;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlightedLabel(label: string, query: string) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return label;
  }

  const normalizedQueryLower = normalizedQuery.toLowerCase();
  const regex = new RegExp(`(${escapeRegex(normalizedQuery)})`, 'ig');
  const chunks = label.split(regex);

  return (
    <>
      {chunks.map((chunk, index) =>
        chunk.toLowerCase() === normalizedQueryLower ? (
          <mark key={`${chunk}-${index}`} className="bg-[#fef08a] px-0.5 text-inherit">
            {chunk}
          </mark>
        ) : (
          <span key={`${chunk}-${index}`}>{chunk}</span>
        ),
      )}
    </>
  );
}

export function SmartAutocomplete({
  entity,
  value,
  onChange,
  placeholder,
  taxonomy,
  activeOnly,
  minChars = 0,
  allowCreate = false,
  disabled,
  className,
}: SmartAutocompleteProps) {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value?.label ?? '');
  const [focusedIndex, setFocusedIndex] = useState(0);

  const debounced = useDebouncedValue(inputValue, 200);
  const normalizedQuery = debounced.trim();
  const canSearch = normalizedQuery.length >= minChars;

  useEffect(() => {
    setInputValue(value?.label ?? '');
  }, [value?.id, value?.label]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current || wrapperRef.current.contains(event.target as Node)) {
        return;
      }

      setOpen(false);
    };

    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, []);

  const lookupQuery = useQuery({
    queryKey: ['lookup', entity, taxonomy, activeOnly, debounced],
    queryFn: () =>
      searchLookup(entity, {
        q: normalizedQuery || undefined,
        taxonomy,
        activeOnly,
      }),
    enabled: open && !disabled && canSearch,
  });

  const createMutation = useMutation({
    mutationFn: (label: string) => createLookupValue(entity, { label, taxonomy }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lookup', entity] });
    },
  });

  const options = lookupQuery.data ?? [];

  const createOption = useMemo(() => {
    if (!allowCreate) {
      return undefined;
    }

    const normalized = inputValue.trim();
    if (!normalized) {
      return undefined;
    }

    const exact = options.some((option) => option.label.toLowerCase() === normalized.toLowerCase());
    if (exact || normalized.length < minChars) {
      return undefined;
    }

    return normalized;
  }, [allowCreate, inputValue, minChars, options]);

  useEffect(() => {
    setFocusedIndex(0);
  }, [debounced, createOption]);

  const totalItems = options.length + (createOption ? 1 : 0);

  const onSelectOption = (option: LookupItem) => {
    onChange(option);
    setInputValue(option.label);
    setOpen(false);
  };

  const onCreateNew = async () => {
    if (!createOption) {
      return;
    }

    const created = await createMutation.mutateAsync(createOption);
    onSelectOption(created);
  };

  const onKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        setOpen(true);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (totalItems > 0) {
        setFocusedIndex((current) => Math.min(current + 1, totalItems - 1));
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusedIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();

      const option = options[focusedIndex];

      if (option) {
        onSelectOption(option);
        return;
      }

      if (createOption) {
        await onCreateNew();
      }
    }
  };

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <Input
        value={inputValue}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setInputValue(event.target.value);
          setOpen(true);
          if (value) {
            onChange(null);
          }
        }}
        onKeyDown={(event) => {
          void onKeyDown(event);
        }}
      />

      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setInputValue('');
            setOpen(true);
          }}
          className="absolute right-2 top-2 rounded p-0.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#334155]"
          aria-label={t('smart.clearSelection')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {open ? (
        <div className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[#d6dee8] bg-white shadow-xl">
          {lookupQuery.isLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-[#64748b]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('smart.loadingSuggestions')}
            </div>
          ) : null}

          {!lookupQuery.isLoading && !canSearch ? (
            <p className="px-3 py-2 text-xs text-[#64748b]">
              {t('smart.typeToSearch', { count: minChars })}
            </p>
          ) : null}

          {!lookupQuery.isLoading && canSearch && options.length === 0 && !createOption ? (
            <p className="px-3 py-2 text-xs text-[#64748b]">{t('smart.noSuggestions')}</p>
          ) : null}

          {!lookupQuery.isLoading && canSearch
            ? options.map((option, index) => (
                <button
                  key={option.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[#f8fafc]',
                    focusedIndex === index && 'bg-[#eff6ff]',
                  )}
                  onMouseEnter={() => setFocusedIndex(index)}
                  onClick={() => onSelectOption(option)}
                >
                  <span className="truncate">{renderHighlightedLabel(option.label, inputValue)}</span>
                  {value?.id === option.id ? <Check className="h-3.5 w-3.5 text-[#2563eb]" /> : null}
                </button>
              ))
            : null}

          {canSearch && createOption ? (
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 border-t border-[#f1f5f9] px-3 py-2 text-left text-sm text-[#2563eb] hover:bg-[#eff6ff]',
                focusedIndex === options.length && 'bg-[#eff6ff]',
              )}
              onMouseEnter={() => setFocusedIndex(options.length)}
              onClick={() => {
                void onCreateNew();
              }}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {t('smart.create', { value: createOption })}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
