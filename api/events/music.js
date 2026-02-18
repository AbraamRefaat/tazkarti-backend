/**
 * Tazkarti Events API - Vercel Serverless Function
 *
 * Calls tazkarti.com's internal REST API directly (discovered from the JS bundle).
 * Endpoint: https://www.tazkarti.com/bookenter/Entertainment/get-events?allowPaging=false
 * No browser / Puppeteer needed. Fast, reliable, always returns 200.
 */

const https = require('https');

const TAZKARTI_EVENTS_API = 'https://www.tazkarti.com/bookenter/Entertainment/get-events?allowPaging=false';
const TAZKARTI_IMAGE_BASE = 'https://www.tazkarti.com/bookenter/Entertainment/events/';
const TAZKARTI_EVENT_BASE = 'https://www.tazkarti.com/#/events/category/3';

// Category 3 = Cairo Opera House (music events shown on the events page)
const MUSIC_CATEGORY_ID = 3;

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let cache = { data: null, timestamp: null };

/** Simple HTTPS GET, returns response body as string */
function fetchText(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          Origin: 'https://www.tazkarti.com',
          Referer: 'https://www.tazkarti.com/',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (ch) => (body += ch));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

/** Fetch and map events from the tazkarti.com internal API */
async function fetchEvents() {
  const { status, body } = await fetchText(TAZKARTI_EVENTS_API);
  if (status !== 200) throw new Error(`Tazkarti API returned status ${status}`);

  const raw = JSON.parse(body);
  if (!Array.isArray(raw)) throw new Error('Unexpected API response format');

  const now = new Date();

  return raw
    .filter((ev) => {
      // Only category 3 (Cairo Opera House music events)
      if (ev.eventCategoryId !== MUSIC_CATEGORY_ID) return false;
      // Only upcoming events
      const end = ev.endDate ? new Date(ev.endDate) : null;
      if (end && end < now) return false;
      return true;
    })
    .map((ev) => {
      const showId = ev.shows && ev.shows[0] ? ev.shows[0].id : null;
      return {
        id: String(ev.id),
        title: (ev.name || '').trim(),
        description: (ev.summary || '')
          .replace(/<[^>]*>/g, '') // strip HTML tags
          .trim(),
        location: ev.venue ? (ev.venue.name || ev.venue.location || '').trim() : '',
        startDate: ev.startDate || now.toISOString(),
        endDate: ev.endDate || null,
        time: ev.shows && ev.shows[0] ? ev.shows[0].startDate : null,
        imageUrl: ev.eventPhoto
          ? `${TAZKARTI_IMAGE_BASE}${ev.eventPhoto}`
          : null,
        eventUrl: `https://www.tazkarti.com/#/e/${ev.id}`,
        category: 'Music',
        price: ev.minimumPrice != null
          ? Number(ev.minimumPrice)
          : ev.eventPrice != null
          ? Number(ev.eventPrice)
          : null,
        isBookmarked: false,
      };
    });
}

function safeJson(res, status, body) {
  const json = JSON.stringify(body);
  res.setHeader('Content-Type', 'application/json');
  res.status(status).end(json);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const now = Date.now();

    // Serve from cache if fresh
    if (cache.data !== null && cache.timestamp && now - cache.timestamp < CACHE_TTL_MS) {
      return safeJson(res, 200, {
        success: true,
        cached: true,
        count: cache.data.length,
        events: cache.data,
        message: 'Events from cache',
      });
    }

    const events = await fetchEvents();
    cache.data = events;
    cache.timestamp = now;

    return safeJson(res, 200, {
      success: true,
      cached: false,
      count: events.length,
      events,
      message: 'Events fetched from tazkarti.com',
    });
  } catch (error) {
    console.error('API error:', error.message);
    return safeJson(res, 200, {
      success: false,
      error: 'Failed to fetch events',
      message: error.message || 'Server error',
      events: [],
      count: 0,
    });
  }
};
