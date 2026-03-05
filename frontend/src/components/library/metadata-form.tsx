import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LookupItem } from '../../api/lookup';
import { SmartAutocomplete, SmartTaxonomyPicker, SmartUserPicker } from '../smart';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { DocumentDetails } from '../../types/domain';

interface MetadataFormProps {
  document: DocumentDetails;
  onSubmit: (fields: Array<{ fieldId: string; value: unknown }>) => Promise<void>;
}

type ValueMode = 'id' | 'label';

type LookupConfig = {
  entity: 'users' | 'groups' | 'documents' | 'taxonomy' | 'tags' | 'departments';
  taxonomy?: string;
  allowCreate?: boolean;
  valueMode: ValueMode;
};

function resolveLookupConfig(field: DocumentDetails['availableFields'][number]): LookupConfig | null {
  const normalizedName = field.name.toLowerCase();

  if (field.dataType === 'USER_REFERENCE') {
    return {
      entity: 'users',
      valueMode: 'id',
      allowCreate: false,
    };
  }

  if (field.dataType === 'TAXONOMY' || field.dataType === 'LIST') {
    return {
      entity: 'taxonomy',
      taxonomy: field.name,
      allowCreate: true,
      valueMode: 'label',
    };
  }

  if (normalizedName.includes('department')) {
    return {
      entity: 'departments',
      allowCreate: true,
      valueMode: 'label',
    };
  }

  if (normalizedName.includes('tag')) {
    return {
      entity: 'tags',
      allowCreate: true,
      valueMode: 'label',
    };
  }

  return null;
}

function toInputValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

export function MetadataForm({ document, onSubmit }: MetadataFormProps) {
  const { t } = useTranslation('library');
  const [saving, setSaving] = useState(false);

  const buildInitialValues = () => {
    const initial: Record<string, string> = {};

    for (const field of document.availableFields) {
      const entry = document.metadata.find((item) => item.fieldId === field.id);
      initial[field.id] = toInputValue(entry?.value);
    }

    return initial;
  };

  const buildInitialLookupSelections = () => {
    const initial: Record<string, LookupItem | null> = {};

    for (const field of document.availableFields) {
      const config = resolveLookupConfig(field);
      if (!config) {
        continue;
      }

      const entry = document.metadata.find((item) => item.fieldId === field.id);
      const value = toInputValue(entry?.value).trim();

      if (!value) {
        initial[field.id] = null;
        continue;
      }

      initial[field.id] = {
        id: value,
        label: value,
      };
    }

    return initial;
  };

  const [values, setValues] = useState<Record<string, string>>(buildInitialValues);
  const [lookupSelections, setLookupSelections] = useState<Record<string, LookupItem | null>>(
    buildInitialLookupSelections,
  );

  useEffect(() => {
    setValues(buildInitialValues());
    setLookupSelections(buildInitialLookupSelections());
    // Reset form whenever selected document changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id]);

  const availableById = useMemo(() => {
    const map = new Map(document.availableFields.map((field) => [field.id, field]));
    return map;
  }, [document.availableFields]);

  const onSave = async () => {
    setSaving(true);

    try {
      const payload = Object.entries(values).map(([fieldId, value]) => {
        const field = availableById.get(fieldId);

        if (!field) {
          return { fieldId, value };
        }

        if (field.dataType === 'NUMBER') {
          if (!value) {
            return { fieldId, value: null };
          }
          const parsed = Number(value);
          return { fieldId, value: Number.isNaN(parsed) ? null : parsed };
        }

        if (field.dataType === 'BOOLEAN') {
          if (!value) {
            return { fieldId, value: null };
          }
          return { fieldId, value: value === 'true' };
        }

        return { fieldId, value };
      });

      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {document.availableFields.map((field) => {
        const lookupConfig = resolveLookupConfig(field);

        return (
          <div key={field.id} className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{field.name}</label>
            {lookupConfig ? (
              lookupConfig.entity === 'users' ? (
                <SmartUserPicker
                  value={lookupSelections[field.id] ?? null}
                  onChange={(selected) => {
                    setLookupSelections((previous) => ({
                      ...previous,
                      [field.id]: selected,
                    }));
                    setValues((previous) => ({
                      ...previous,
                      [field.id]:
                        selected
                          ? lookupConfig.valueMode === 'id'
                            ? selected.id
                            : selected.label
                          : '',
                    }));
                  }}
                  placeholder={field.required ? t('metadata.selectUser') : t('metadata.optionalUser')}
                />
              ) : lookupConfig.entity === 'taxonomy' ? (
                <SmartTaxonomyPicker
                  value={lookupSelections[field.id] ?? null}
                  taxonomy={lookupConfig.taxonomy}
                  allowCreate={lookupConfig.allowCreate}
                  onChange={(selected) => {
                    setLookupSelections((previous) => ({
                      ...previous,
                      [field.id]: selected,
                    }));
                    setValues((previous) => ({
                      ...previous,
                      [field.id]:
                        selected
                          ? lookupConfig.valueMode === 'id'
                            ? selected.id
                            : selected.label
                          : '',
                    }));
                  }}
                  placeholder={t('metadata.searchTaxonomy')}
                />
              ) : (
                <SmartAutocomplete
                  entity={lookupConfig.entity}
                  allowCreate={lookupConfig.allowCreate}
                  taxonomy={lookupConfig.taxonomy}
                  value={lookupSelections[field.id] ?? null}
                  onChange={(selected) => {
                    setLookupSelections((previous) => ({
                      ...previous,
                      [field.id]: selected,
                    }));
                    setValues((previous) => ({
                      ...previous,
                      [field.id]:
                        selected
                          ? lookupConfig.valueMode === 'id'
                            ? selected.id
                            : selected.label
                          : '',
                    }));
                  }}
                  placeholder={t('metadata.search')}
                />
              )
            ) : (
              <Input
                value={values[field.id] ?? ''}
                onChange={(event) =>
                  setValues((previous) => ({
                    ...previous,
                    [field.id]: event.target.value,
                  }))
                }
                placeholder={field.required ? t('metadata.required') : t('metadata.optional')}
              />
            )}
          </div>
        );
      })}

      <Button onClick={onSave} disabled={saving} className="w-full">
        {saving ? t('metadata.saving') : t('metadata.save')}
      </Button>
    </div>
  );
}
