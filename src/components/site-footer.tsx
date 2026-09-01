import { config } from '@/config/companion.config';

const REPO = 'https://github.com/RoxyAPI/ai-spiritual-companion';

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="site-container flex flex-col gap-3 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          {config.name}. Calculations by{' '}
          <a href="https://roxyapi.com" className="underline underline-offset-2">
            RoxyAPI
          </a>
          , verified against NASA JPL Horizons.
        </p>
        <div className="flex gap-4">
          <a href={REPO} className="underline underline-offset-2">
            Source
          </a>
          <a href={config.supportUrl} className="underline underline-offset-2">
            Support
          </a>
        </div>
      </div>
    </footer>
  );
}
