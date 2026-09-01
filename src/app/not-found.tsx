import Link from 'next/link';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <Section containerClassName="max-w-md space-y-4">
      <h1 className="text-2xl">Nothing here</h1>
      <p className="text-sm text-muted-foreground">That page does not exist.</p>
      <Button asChild>
        <Link href="/">Back to the start</Link>
      </Button>
    </Section>
  );
}
