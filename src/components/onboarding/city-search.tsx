'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CityChoice } from '@/types';

/**
 * Birth city, by name. Nobody is ever asked for a latitude.
 *
 * @remarks Two pieces of state, deliberately separated: `query` is what is being typed and
 * `selected` is what has been chosen. Collapsing them makes the label update before the coordinates
 * under it do, so the form briefly shows one city and holds another.
 *
 * The chosen city carries the IANA timezone rather than a numeric offset, because that is the form
 * that stays correct across a daylight saving boundary in the year somebody was born.
 *
 * A superseded request is aborted, and an abort is not a failure: it must not clear the list or
 * raise a message, or every keystroke would flash an error. A real failure does say so, because
 * this is the one field somebody cannot work around, and silently showing nothing reads as
 * "your birthplace is not in there".
 */
export function CitySearch({
  selected,
  onSelect,
}: {
  selected: CityChoice | null;
  onSelect: (city: CityChoice | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityChoice[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);

  // Nothing is set synchronously in the effect body, which is both a lint rule and the right shape:
  // whether the list should be visible is derived from the query below rather than stored twice.
  useEffect(() => {
    if (query.trim().length < 3) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { cities?: CityChoice[] };
        setResults(body.cities ?? []);
        setFailed(false);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setFailed(true);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const searched = query.trim().length >= 3;
  const visible = searched ? results : [];

  return (
    <div className="space-y-2">
      <Label htmlFor="city-search">Birth city</Label>
      <div className="relative">
        <Input
          id="city-search"
          autoComplete="off"
          placeholder="Start typing a city"
          value={selected ? `${selected.city}, ${selected.country}` : query}
          onChange={(event) => {
            onSelect(null);
            setFailed(false);
            setQuery(event.target.value);
          }}
        />
        {searching ? (
          <Loader2 className="absolute top-2.5 right-3 size-4 animate-spin text-muted-foreground" />
        ) : null}

        {!selected && visible.length > 0 ? (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-sm">
            {visible.map((city) => (
              <li key={`${city.city}-${city.province}-${city.country}-${city.latitude}`}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-accent/20"
                  onClick={() => {
                    onSelect(city);
                    setResults([]);
                  }}
                >
                  <span className="block text-sm">{city.city}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[city.province, city.country].filter(Boolean).join(', ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {selected ? (
        <p className="text-xs text-muted-foreground">
          {selected.latitude.toFixed(2)}, {selected.longitude.toFixed(2)} in {selected.timezone}
        </p>
      ) : failed ? (
        <p className="text-xs text-destructive">
          The city search did not answer. Check that ROXYAPI_KEY is set, then type another letter to
          try again.
        </p>
      ) : searched && !searching && results.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No match yet. Try the nearest larger city, or add the country.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Pick from the list so the chart gets the right coordinates and timezone.
        </p>
      )}
    </div>
  );
}
