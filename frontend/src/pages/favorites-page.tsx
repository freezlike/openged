import { Card } from '../components/ui/card';
import { useTranslation } from 'react-i18next';

export function FavoritesPage() {
  const { t } = useTranslation('common');

  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold text-[#0f172a]">{t('pages.favorites.title')}</h1>
      <p className="mt-2 text-sm text-[#64748b]">
        {t('pages.favorites.description')}
      </p>
    </Card>
  );
}
