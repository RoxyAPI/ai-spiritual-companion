import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * The one layout primitive. A section is full width, so whatever it paints behind itself runs edge
 * to edge exactly like the header and the footer do. The container INSIDE it owns the width, the
 * gutters, and the vertical rhythm.
 *
 * @remarks That split is the whole point. Because the container lives here rather than in the root
 * layout, a page never sets a width or a padding, and the content of every band lines up with the
 * wordmark above it whatever its background is doing. A container in the root layout would cap
 * every background at its edge, so a washed band would stop short of the viewport and read as a
 * floating strip.
 */
export function Section({
  wash,
  className,
  containerClassName,
  children,
  ...props
}: ComponentProps<'section'> & {
  /** A single soft radial wash bleeding from a corner. Never stack two: docs/design.md. */
  wash?: 'start' | 'end';
  /** Overrides on the inner container, for a narrower measure or to make it the grid itself. */
  containerClassName?: string;
}) {
  return (
    <section
      className={cn('relative', wash && 'wash', wash === 'end' && 'wash-end', className)}
      {...props}
    >
      <div className={cn('site-container py-16 sm:py-24', containerClassName)}>{children}</div>
    </section>
  );
}
