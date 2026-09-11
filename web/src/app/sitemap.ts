// Description: Simple static sitemap entries for primary pages.
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://otm-fpl.vercel.app'
  const now = new Date()
  return [
    { url: `${base}/`, lastModified: now },
    { url: `${base}/form`, lastModified: now },
    { url: `${base}/terms`, lastModified: now },
    { url: `${base}/privacy`, lastModified: now },
  ]
}


