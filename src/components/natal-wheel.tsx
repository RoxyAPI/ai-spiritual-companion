'use client';

import { RoxyNatalChart } from '@roxyapi/ui-react';
import type { NatalChartResponse } from '@/types';

/**
 * The stored chart, drawn.
 *
 * @remarks The page that reads the chart out of the database is a server component and the drawing
 * is a browser custom element, so this file exists to be the boundary between the two and does
 * nothing else. The stored response is passed through untouched: the component takes the same
 * shape the calculation returned.
 */
export function NatalWheel({ data }: { data: NatalChartResponse }) {
  return <RoxyNatalChart data={data} />;
}
