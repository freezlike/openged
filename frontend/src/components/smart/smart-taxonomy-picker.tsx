import { LookupItem } from '../../api/lookup';
import { SmartAutocomplete, SmartAutocompleteProps } from './smart-autocomplete';

type SmartTaxonomyPickerProps = Omit<SmartAutocompleteProps, 'entity'> & {
  value: LookupItem | null;
};

export function SmartTaxonomyPicker(props: SmartTaxonomyPickerProps) {
  return <SmartAutocomplete {...props} entity="taxonomy" allowCreate={props.allowCreate ?? true} />;
}
