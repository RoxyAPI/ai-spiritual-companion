import { ImageResponse } from 'next/og';
import { config } from '@/config/companion.config';

export const alt = `${config.name}, ${config.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * The social card, rendered from the config.
 *
 * @remarks The colours are written out rather than referenced, because an image cannot read a CSS
 * variable. `tests/design-tokens.test.ts` holds these values to the light palette in `globals.css`,
 * so a recolour that misses this file fails the suite instead of shipping a card in the old scheme.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px',
        background: '#FAF6EC',
        color: '#14232E',
        fontFamily: 'serif',
      }}
    >
      <div
        style={{
          fontSize: 22,
          letterSpacing: 8,
          textTransform: 'uppercase',
          color: '#5C6A76',
          marginBottom: 28,
        }}
      >
        {config.name}
      </div>
      <div style={{ fontSize: 76, lineHeight: 1.1, maxWidth: 900 }}>{config.tagline}</div>
      <div style={{ marginTop: 36, fontSize: 26, color: '#5C6A76', maxWidth: 900 }}>
        Your chart computed once. Your readings remembered. Your database.
      </div>
      <div style={{ marginTop: 'auto', fontSize: 22, color: '#B89D62' }}>
        Calculations verified against NASA JPL Horizons
      </div>
    </div>,
    size,
  );
}
