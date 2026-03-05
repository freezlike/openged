import { Card } from '../components/ui/card';

export function FavoritesPage() {
  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold text-[#0f172a]">Favorites</h1>
      <p className="mt-2 text-sm text-[#64748b]">
        Favorites are ready for local/user persistence (star/bookmark actions can be wired in next iteration).
      </p>
    </Card>
  );
}
