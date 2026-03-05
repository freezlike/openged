import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, X } from 'lucide-react';

import { createLookupValue, LookupEntity, LookupItem, searchLookup } from '../../api/lookup';
import { useDebouncedValue } from '../../hooks/use-debounced-value';
import { cn } from '../../lib/utils';

interface SmartMultiSelectProps {
  entity: LookupEntity;
  values: LookupItem[];
  onChange: (values: LookupItem[]) => void;
  placeholder?: string;
  taxonomy?: string;
  allowCreate?: boolean;
  disabled?: boolean;
  className?: string;
}

export function SmartMultiSelect({
  entity,
  values,
  onChange,
  placeholder,
  taxonomy,
  allowCreate = false,
  disabled,
  className,
}: SmartMultiSelectProps) {
  const queryClient = useQueryClient();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);

  const debounced = useDebouncedValue(query, 200);

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
    queryKey: ['lookup', 'multi', entity, taxonomy, debounced],
    queryFn: () =>
      searchLookup(entity, {
        q: debounced.trim() || undefined,
        taxonomy,
      }),
    enabled: open && !disabled,
  });

  const createMutation = useMutation({
    mutationFn: (label: string) => createLookupValue(entity, { label, taxonomy }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lookup', entity] });
      queryClient.invalidateQueries({ queryKey: ['lookup', 'multi', entity] });
    },
  });

  const options = useMemo(() => {
    const existingIds = new Set(values.map((value) => value.id));
    return (lookupQuery.data ?? []).filter((value) => !existingIds.has(value.id));
  }, [lookupQuery.data, values]);

  const createOption = useMemo(() => {
    if (!allowCreate) {
      return undefined;
    }

    const normalized = query.trim();
    if (!normalized) {
      return undefined;
    }

    const exact = [...values, ...options].some(
      (option) => option.label.toLowerCase() === normalized.toLowerCase(),
    );

    return exact ? undefined : normalized;
  }, [allowCreate, options, query, values]);

  useEffect(() => {
    setFocusedIndex(0);
  }, [debounced, createOption]);

  const totalItems = options.length + (createOption ? 1 : 0);

  const selectOption = (option: LookupItem) => {
    onChange([...values, option]);
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  };

  const removeOption = (id: string) => {
    onChange(values.filter((option) => option.id !== id));
  };

  const createAndSelect = async () => {
    if (!createOption) {
      return;
    }

    const created = await createMutation.mutateAsync(createOption);
    selectOption(created);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !query && values.length > 0) {
      onChange(values.slice(0, values.length - 1));
      return;
    }

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
        selectOption(option);
        return;
      }

      if (createOption) {
        void createAndSelect();
      }
    }
  };

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <div
        className={cn(
          'flex min-h-9 w-full flex-wrap items-center gap-1 rounded-lg border border-[#d6dee8] bg-white px-2 py-1 text-sm shadow-sm',
          disabled && 'opacity-50',
        )}
      >
        {values.map((value) => (
          <span
            key={value.id}
            className="inline-flex items-center gap-1 rounded-md bg-[#eff6ff] px-2 py-1 text-xs font-medium text-[#1d4ed8]"
          >
            {value.label}
            <button
              type="button"
              disabled={disabled}
              className="rounded p-0.5 hover:bg-[#dbeafe]"
              onClick={() => removeOption(value.id)}
              aria-label={`Remove ${value.label}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          value={query}
          disabled={disabled}
          placeholder={values.length === 0 ? placeholder : undefined}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={onInputKeyDown}
          className="h-7 min-w-[120px] flex-1 bg-transparent text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
        />
      </div>

      {open ? (
        <div className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[#d6dee8] bg-white shadow-xl">
          {lookupQuery.isLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-[#64748b]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading suggestions...
            </div>
          ) : null}

          {!lookupQuery.isLoading && options.length === 0 && !createOption ? (
            <p className="px-3 py-2 text-xs text-[#64748b]">No suggestions</p>
          ) : null}

          {!lookupQuery.isLoading
            ? options.map((option, index) => (
                <button
                  key={option.id}
                  type="button"
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm hover:bg-[#f8fafc]',
                    focusedIndex === index && 'bg-[#eff6ff]',
                  )}
                  onMouseEnter={() => setFocusedIndex(index)}
                  onClick={() => selectOption(option)}
                >
                  {option.label}
                </button>
              ))
            : null}

          {createOption ? (
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 border-t border-[#f1f5f9] px-3 py-2 text-left text-sm text-[#2563eb] hover:bg-[#eff6ff]',
                focusedIndex === options.length && 'bg-[#eff6ff]',
              )}
              onMouseEnter={() => setFocusedIndex(options.length)}
              onClick={() => {
                void createAndSelect();
              }}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Create "{createOption}"
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
