import { useEffect, useMemo, useState } from 'react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DocumentDetails } from '../../types/domain';

interface MetadataFormProps {
  document: DocumentDetails;
  onSubmit: (fields: Array<{ fieldId: string; value: unknown }>) => Promise<void>;
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
  const [saving, setSaving] = useState(false);
  const buildInitialValues = () => {
    const initial: Record<string, string> = {};

    for (const field of document.availableFields) {
      const entry = document.metadata.find((item) => item.fieldId === field.id);
      initial[field.id] = toInputValue(entry?.value);
    }

    return initial;
  };

  const [values, setValues] = useState<Record<string, string>>(buildInitialValues);

  useEffect(() => {
    setValues(buildInitialValues());
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
        const allowedValues =
          field.validation &&
          typeof field.validation === 'object' &&
          'allowed' in field.validation &&
          Array.isArray((field.validation as { allowed?: unknown[] }).allowed)
            ? ((field.validation as { allowed?: unknown[] }).allowed as unknown[])
            : null;

        return (
          <div key={field.id} className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{field.name}</label>
            {allowedValues ? (
              <Select
                value={values[field.id] ?? ''}
                onValueChange={(value) =>
                  setValues((previous) => ({
                    ...previous,
                    [field.id]: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select value" />
                </SelectTrigger>
                <SelectContent>
                  {allowedValues.map((value) => (
                    <SelectItem key={String(value)} value={String(value)}>
                      {String(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={values[field.id] ?? ''}
                onChange={(event) =>
                  setValues((previous) => ({
                    ...previous,
                    [field.id]: event.target.value,
                  }))
                }
                placeholder={field.required ? 'Required' : 'Optional'}
              />
            )}
          </div>
        );
      })}

      <Button onClick={onSave} disabled={saving} className="w-full">
        {saving ? 'Saving...' : 'Save metadata'}
      </Button>
    </div>
  );
}
