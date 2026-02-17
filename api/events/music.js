/**
 * Tazkarti Events API - Vercel Serverless Function
 * Fetches events dynamically from https://www.tazkarti.com/#/events/category/3
 * No fixed data - uses headless browser to scrape the live page.
 */

const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium-min');

const TAZKARTI_EVENTS_URL = 'https://www.tazkarti.com/#/events/category/3';
const TAZKARTI_BASE = 'https://www.tazkarti.com';
const CHROMIUM_PACK_URL = 'https://github.com/Sparticuz/chromium/releases/download/v138.0.2/chromium-v138.0.2-pack.x64.tar';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let cache = { data: null, timestamp: null };

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function parsePrice(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function parseDateFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const d = new Date(text.trim());
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Scrape events from tazkarti.com events page (SPA).
 * Uses flexible DOM selectors to extract event links and card content.
 */
async function fetchEventsFromTazkarti() {
  let browser;
  try {
    const executablePath = await chromium.executablePath(CHROMIUM_PACK_URL);
    const viewport = { width: 1280, height: 800, deviceScaleFactor: 1 };
    browser = await puppeteer.launch({
      headless: 'shell',
      args: chromium.args,
      defaultViewport: viewport,
      executablePath,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport(viewport);

    await page.goto(TAZKARTI_EVENTS_URL, {
      waitUntil: 'networkidle2',
      timeout: 25000,
    });

    // Wait for SPA to render event list
    await delay(5000);

    const events = await page.evaluate((baseUrl) => {
      const result = [];
      const seen = new Set();

      // Try multiple strategies to find event links/cards
      const selectors = [
        'a[href*="/event/"]',
        'a[href*="#/event/"]',
        '[class*="event"] a[href]',
        'a[href*="ticketor"][href*="event"]',
      ];

      let links = [];
      for (const sel of selectors) {
        try {
          const els = document.querySelectorAll(sel);
          els.forEach((a) => {
            const href = a.getAttribute('href') || '';
            const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
            if (fullUrl.includes('event') && !seen.has(fullUrl)) {
              seen.add(fullUrl);
              links.push({ a, fullUrl });
            }
          });
        } catch (_) {}
      }

      // Dedupe by normalized event path
      const byPath = new Map();
      links.forEach(({ a, fullUrl }) => {
        const path = fullUrl.replace(/#\/?/, '').replace(/\/$/, '');
        if (byPath.has(path)) return;
        byPath.set(path, { a, fullUrl });
      });

      byPath.forEach(({ a, fullUrl }) => {
        const card = a.closest('div[class*="card"], div[class*="event"], li, article, [class*="item"]') || a.parentElement;
        const text = (card ? card.innerText : a.innerText) || '';
        const title = (a.textContent || '').trim() || text.split('\n')[0]?.trim() || 'Event';
        const id = fullUrl.split('/event/')[1]?.split(/[#?/]/)[0] || `ev_${result.length}`;

        let dateStr = null;
        let priceStr = null;
        let locationStr = null;
        const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
        for (const line of lines) {
          if (!dateStr && (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(line) || /\d{4}-\d{2}-\d{2}/.test(line) || /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(line))) dateStr = line;
          if (!priceStr && /(\d+\s*(?:egp|le|ج\.م|lb)|^\d+(?:\.\d+)?\s*$)/i.test(line)) priceStr = line;
          if (!locationStr && line.length > 3 && line.length < 120 && !/^\d+$/.test(line) && line !== title) locationStr = line;
        }

        result.push({
          id: id.replace(/[^a-zA-Z0-9_-]/g, '_') || `tazkarti_${result.length}`,
          title: title.substring(0, 200),
          description: '',
          location: locationStr || '',
          startDate: dateStr || null,
          time: null,
          imageUrl: null,
          eventUrl: fullUrl,
          category: 'Music',
          price: priceStr,
          isBookmarked: false,
        });
      });

      return result;
    }, TAZKARTI_BASE);

    await browser.close();

    const now = new Date();
    const normalized = events.map((ev) => {
      const startDate = parseDateFromText(ev.startDate) || ev.startDate;
      const price = typeof ev.price === 'number' ? ev.price : parsePrice(ev.price);
      return {
        id: ev.id,
        title: ev.title,
        description: ev.description || '',
        location: ev.location || '',
        startDate: startDate || now.toISOString(),
        time: ev.time || null,
        imageUrl: ev.imageUrl || null,
        eventUrl: ev.eventUrl,
        category: ev.category || 'Music',
        price: price,
        isBookmarked: false,
      };
    });

    return normalized;
  } catch (err) {
    if (browser) try { await browser.close(); } catch (_) {}
    console.error('Scrape error:', err.message);
    throw err;
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
    if (cache.data && cache.timestamp && now - cache.timestamp < CACHE_TTL_MS) {
      return res.status(200).json({
        success: true,
        cached: true,
        count: cache.data.length,
        events: cache.data,
        message: 'Events from cache',
      });
    }

    const events = await fetchEventsFromTazkarti();
    cache.data = events;
    cache.timestamp = now;

    return res.status(200).json({
      success: true,
      cached: false,
      count: events.length,
      events,
      message: 'Events fetched from tazkarti.com',
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch events',
      message: error.message,
      events: [],
    });
  }
};
