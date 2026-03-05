import { LookupItem } from '../../api/lookup';
import { SmartAutocomplete, SmartAutocompleteProps } from './smart-autocomplete';

type SmartUserPickerProps = Omit<SmartAutocompleteProps, 'entity' | 'allowCreate'> & {
  value: LookupItem | null;
};

export function SmartUserPicker(props: SmartUserPickerProps) {
  return <SmartAutocomplete {...props} entity="users" allowCreate={false} />;
}
