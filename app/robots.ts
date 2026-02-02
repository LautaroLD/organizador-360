import type { MetadataRoute } from 'next'

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl()

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/auth/callback',
        '/auth/confirm',
        '/dashboard',
        '/invitations',
        '/projects',
        '/settings',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
