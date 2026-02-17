# Tazkarti Events Backend

Serverless backend that scrapes events from Tazkarti.com and exposes them via REST API.

## 🚀 Deployed on Vercel

This backend runs on Vercel serverless functions.

## 📡 API Endpoint

```
GET /api/events/music
```

Returns upcoming music events from Tazkarti.com.

## 📦 Response Format

```json
{
  "success": true,
  "cached": false,
  "count": 4,
  "events": [
    {
      "id": "tazkarti_123_0",
      "title": "Concert Name",
      "description": "",
      "location": "Cairo Opera House Main Hall",
      "startDate": "2026-02-19T00:00:00.000Z",
      "time": null,
      "imageUrl": null,
      "eventUrl": "https://www.tazkarti.com",
      "category": "Music",
      "price": 160,
      "isBookmarked": false
    }
  ]
}
```

## 🔧 Technologies

- Node.js 18+
- Puppeteer Core (headless browser)
- @sparticuz/chromium (Chrome for serverless)
- Vercel Serverless Functions

## ⚡ Features

- Automatic web scraping from Tazkarti.com
- 30-minute caching for performance
- CORS enabled for Flutter app access
- Global CDN via Vercel
- Auto-scaling

## 🌐 Deploy Your Own

1. Fork this repository
2. Go to [Vercel](https://vercel.com)
3. Import this repository
4. Deploy!

Vercel will automatically detect the configuration.

## 📝 Notes

- Events are cached for 30 minutes
- First request may take longer (cold start)
- Subsequent requests are very fast (cached)

## 🔗 Used By

This API is used by the NileQuest Flutter mobile app to display upcoming events from Tazkarti.
