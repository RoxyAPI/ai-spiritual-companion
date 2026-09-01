import type { MetadataRoute } from 'next';
import { config } from '@/config/companion.config';

/** The landing page and nothing else. Everything past sign in has nothing to offer a crawler. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: config.siteUrl, lastModified: new Date(), priority: 1 }];
}
