import { Card } from '../components/ui/card';

export function RecentPage() {
  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold text-[#0f172a]">Recent</h1>
      <p className="mt-2 text-sm text-[#64748b]">
        Recent documents shortcut is available in this UI baseline. Hook it to a dedicated backend endpoint when needed.
      </p>
    </Card>
  );
}
