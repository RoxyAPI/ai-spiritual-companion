import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Section } from '@/components/section';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireOnboarded } from '@/lib/auth';
import { aspectLabel } from '@/lib/chart';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Your chart',
  robots: { index: false, follow: false },
};

/**
 * The stored chart, read from the database. There is no calculation call on this page, and saying
 * so on the page is the demonstration. Without that line it is only a table.
 */
export default async function ChartPage() {
  const user = await requireOnboarded();
  const supabase = await createClient();

  const { data: stored } = await supabase
    .from('charts')
    .select('natal, computed_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!stored) redirect('/onboarding');

  const { natal, computed_at: computedAt } = stored;

  return (
    <Section wash="start" containerClassName="space-y-8">
      <div className="space-y-2">
        <p className="eyebrow text-muted-foreground">Computed once</p>
        <h1 className="text-3xl">Your natal chart</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Calculated on {computedAt.slice(0, 10)} from your birth details and kept ever since. This
          page reads it out of your database. It has never been recalculated, and it never will be,
          because the moment it describes cannot change.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Sun', value: natal.planets.find((p) => p.name === 'Sun')?.sign ?? 'unknown' },
          { label: 'Ascendant', value: natal.ascendant.sign },
          { label: 'Midheaven', value: natal.midheaven.sign },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader>
              <CardTitle className="eyebrow text-muted-foreground">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-2xl">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Placements</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 font-normal">Body</th>
                <th className="py-2 font-normal">Sign</th>
                <th className="py-2 font-normal">Degree</th>
                <th className="py-2 font-normal">House</th>
                <th className="py-2 font-normal">Motion</th>
              </tr>
            </thead>
            <tbody>
              {natal.planets.map((planet) => (
                <tr key={planet.name} className="border-t">
                  <td className="py-2">{planet.name}</td>
                  <td className="py-2">{planet.sign}</td>
                  <td className="py-2">{planet.degree.toFixed(2)}</td>
                  <td className="py-2">{planet.house}</td>
                  <td className="py-2 text-muted-foreground">
                    {planet.isRetrograde ? 'retrograde' : 'direct'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Aspects</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 font-normal">Between</th>
                <th className="py-2 font-normal">Aspect</th>
                <th className="py-2 font-normal">Orb</th>
              </tr>
            </thead>
            <tbody>
              {natal.aspects.map((aspect) => (
                <tr key={`${aspect.planet1}-${aspect.type}-${aspect.planet2}`} className="border-t">
                  <td className="py-2">
                    {aspect.planet1} and {aspect.planet2}
                  </td>
                  <td className="py-2">{aspectLabel(aspect.type)}</td>
                  <td className="py-2">{aspect.orb.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </Section>
  );
}
