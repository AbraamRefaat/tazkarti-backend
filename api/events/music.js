/**
 * Tazkarti Events API - Vercel Serverless Function
 * Fetches events from tazkarti.com using HTTP only (no Puppeteer/Chromium).
 * Always returns 200 with valid JSON so the app never gets a crash.
 */

const https = require('https');

const TAZKARTI_ORIGIN = 'https://www.tazkarti.com';
const TAZKARTI_EVENTS_PATH = '/';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let cache = { data: null, timestamp: null };

function parsePrice(text) {
  if (!text || typeof text !== 'string') return null;
  const match = String(text).replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function parseDateFromText(text) {
  if (!text || typeof text !== 'string') return null;
  let s = String(text).trim();
  s = s.replace(/(\d{1,2})-(\w+)-(\d{2,4})/, '$1 $2 $3');
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TazkartiAPI/1.0)',
          Accept: 'text/html',
        },
        timeout: 15000,
      },
      (res) => {
        let body = '';
        res.on('data', (ch) => (body += ch));
        res.on('end', () => resolve(body));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.setTimeout(15000);
    req.end();
  });
}

/**
 * Try to extract event-like data from HTML (SPA may embed state in script tags).
 * Falls back to regex for known patterns so we never crash.
 */
function extractEventsFromHtml(html) {
  const events = [];
  const seen = new Set();

  // 1) Look for embedded JSON in script tags (e.g. __NUXT__, window.__DATA__, events: [...])
  const scriptJsonMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  if (scriptJsonMatch) {
    for (const block of scriptJsonMatch) {
      const inner = block.replace(/<\/?script[^>]*>/gi, '');
      const eventsMatch = inner.match(/"events"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
      if (eventsMatch) {
        try {
          const arr = JSON.parse(eventsMatch[1]);
          if (Array.isArray(arr) && arr.length) {
            arr.forEach((item) => {
              const title = item.name || item.title || item.eventName || '';
              const startDate = item.startDate || item.date || item.eventDate || '';
              const price = item.price ?? item.pricesFrom ?? parsePrice(item.priceText);
              const location = item.location || item.venue || item.place || '';
              const id = item.id || item.eventId || ('ev_' + events.length);
              const key = (title + startDate).toLowerCase();
              if (title && !seen.has(key)) {
                seen.add(key);
                events.push({
                  id: String(id),
                  title: String(title).substring(0, 200),
                  description: '',
                  location: String(location).substring(0, 200),
                  startDate: startDate || null,
                  time: null,
                  imageUrl: item.imageUrl || item.image || null,
                  eventUrl: item.url || item.eventUrl || TAZKARTI_ORIGIN + '/#/events/category/3',
                  category: 'Music',
                  price: price != null ? (typeof price === 'number' ? price : parsePrice(price)) : null,
                  isBookmarked: false,
                });
              }
            });
            if (events.length) return events;
          }
        } catch (_) {}
      }
    }
  }

  // 2) Regex fallback: find "Title ... Date ... Prices From: X EGP" style text in HTML
  const datePattern = /\d{1,2}[-/]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*[-/]\s*\d{2,4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/gi;
  const pricePattern = /Prices?\s*From\s*:\s*(\d+)\s*EGP|(\d+)\s*EGP/gi;
  const titleCandidates = [
    /Talents\s+Development\s+Center\s+Concert[\s\S]*?\d{1,2}[-/]\w+[-/]\d{2,4}/gi,
    /Cairo\s+Symphony\s+Orchestra[\s\S]*?\d{1,2}[-/]\w+[-/]\d{2,4}/gi,
  ];
  const combined = html.replace(/\s+/g, ' ');
  let m;
  const dateMatches = [];
  while ((m = datePattern.exec(combined)) !== null) dateMatches.push(m[0].trim());
  const priceMatches = [];
  while ((m = pricePattern.exec(combined)) !== null) priceMatches.push(m[1] || m[2]);
  for (const re of titleCandidates) {
    re.lastIndex = 0;
    while ((m = re.exec(combined)) !== null) {
      const full = m[0].trim();
      const title = full.replace(/\d{1,2}[-/]\w+[-/]\d{2,4}.*$/i, '').trim().substring(0, 200);
      const datePart = full.match(/\d{1,2}[-/]\w+[-/]\d{2,4}/);
      const dateStr = datePart ? datePart[0] : null;
      const key = (title + (dateStr || '')).toLowerCase();
      if (title.length > 5 && !seen.has(key)) {
        seen.add(key);
        const priceNum = priceMatches.length ? parsePrice(priceMatches[events.length % priceMatches.length]) : null;
        events.push({
          id: 'tazkarti_' + events.length + '_' + Date.now(),
          title,
          description: '',
          location: 'Cairo Opera House',
          startDate: dateStr,
          time: null,
          imageUrl: null,
          eventUrl: TAZKARTI_ORIGIN + '/#/events/category/3',
          category: 'Music',
          price: priceNum,
          isBookmarked: false,
        });
      }
    }
  }

  return events;
}

async function fetchEvents() {
  const url = TAZKARTI_ORIGIN + TAZKARTI_EVENTS_PATH;
  const html = await fetchHtml(url);
  const raw = extractEventsFromHtml(html);
  const now = new Date().toISOString();
  return raw.map((ev) => ({
    id: ev.id,
    title: ev.title,
    description: ev.description || '',
    location: ev.location || '',
    startDate: parseDateFromText(ev.startDate) || ev.startDate || now,
    time: ev.time || null,
    imageUrl: ev.imageUrl || null,
    eventUrl: ev.eventUrl || TAZKARTI_ORIGIN + '/#/events/category/3',
    category: ev.category || 'Music',
    price: ev.price != null ? (typeof ev.price === 'number' ? ev.price : parsePrice(ev.price)) : null,
    isBookmarked: false,
  }));
}

function safeJson(res, status, body) {
  try {
    res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));
  } catch (e) {
    res.status(200).setHeader('Content-Type', 'application/json').end(JSON.stringify({ success: false, events: [], count: 0, message: 'Response error' }));
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const now = Date.now();
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
      message: 'Events from tazkarti.com',
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
