'use client';

import * as RoxyUI from '@roxyapi/ui-react';
import type { ElementType } from 'react';
import type { ToolWidgetSpec } from '@/lib/tool-widgets';

/**
 * Draws the components a message earned from its tool calls, above the written answer.
 *
 * The wrapper package exports one component per name in the catalog, so the export is looked up by
 * name and handed the parsed result as `data`. Nothing here carries a colour: the drawing sits
 * inside the bubble and takes the surface it is painted on, through the `--roxy-*` bridge in
 * `globals.css`, so it reads as part of the reply rather than as a card inside a card.
 */
export function ToolWidget({ widgets }: { widgets: ToolWidgetSpec[] }) {
  if (widgets.length === 0) return null;

  return (
    <div className="mb-3 space-y-3 overflow-x-auto">
      {widgets.map(({ key, pascal, attrs, data }) => {
        const Widget = RoxyUI[pascal as keyof typeof RoxyUI] as ElementType | undefined;
        if (!Widget) return null;

        return <Widget key={key} data={data} {...attrs} />;
      })}
    </div>
  );
}
