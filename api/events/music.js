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

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Scraper timeout')), ms)),
  ]).catch((err) => (fallback !== undefined ? Promise.resolve(fallback) : Promise.reject(err)));
}

function parsePrice(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function parseDateFromText(text) {
  if (!text || typeof text !== 'string') return null;
  let s = text.trim();
  // Normalize "19-February 2026" -> "19 February 2026" for Date parsing
  s = s.replace(/(\d{1,2})-(\w+)-(\d{2,4})/, '$1 $2 $3');
  const d = new Date(s);
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

    // Wait for SPA to render event list (tazkarti loads content via JS)
    await delay(4000);

    const events = await page.evaluate((baseUrl) => {
      const result = [];
      const seenTitles = new Set();

      const pricePattern = /Prices?\s*From|^\s*\d+\s*EGP|\d+\s*ج\.م|EGP/i;
      const datePattern = /\d{1,2}[-/]\w+[-/]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}|(?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)|February|January|March|April|May|June|July|August|September|October|November|December/i;
      const buyTicketsPattern = /Buy\s*Tickets|شراء\s*التذاكر/i;

      function getCardRoot(el) {
        let node = el;
        for (let i = 0; i < 15 && node; i++) {
          const text = node.innerText || '';
          const hasPrice = pricePattern.test(text);
          const hasDate = datePattern.test(text);
          const hasBuyTickets = buyTicketsPattern.test(text);
          if (hasPrice && hasDate && hasBuyTickets && (text.length > 80 && text.length < 3000)) return node;
          node = node.parentElement;
        }
        return null;
      }

      const allElements = document.querySelectorAll('*');
      const cardRootsSet = new Set();
      allElements.forEach((el) => {
        const text = (el.innerText || '').trim();
        if (text.length < 80 || text.length > 4000) return;
        if (!pricePattern.test(text) || !datePattern.test(text) || !buyTicketsPattern.test(text)) return;
        const root = getCardRoot(el);
        if (root) cardRootsSet.add(root);
      });

      const cardRoots = Array.from(cardRootsSet);
      if (cardRoots.length === 0) return result;

      // Find the "main event list" container: the ancestor that contains the most cards.
      // The page shows only one list of events; nav/footer have at most 1 fake card each.
      let bestContainer = null;
      let bestCount = 0;
      cardRoots.forEach((card) => {
        let node = card.parentElement;
        for (let i = 0; i < 20 && node; i++) {
          const count = cardRoots.filter((c) => node.contains(c)).length;
          if (count > bestCount && count <= cardRoots.length) {
            bestCount = count;
            bestContainer = node;
          }
          node = node.parentElement;
        }
      });

      const mainListCards = bestContainer
        ? cardRoots.filter((c) => bestContainer.contains(c))
        : cardRoots;

      mainListCards.forEach((card, idx) => {
        const text = (card.innerText || '').trim();
        const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);

        let title = '';
        let dateStr = null;
        let priceStr = null;
        let locationStr = '';
        let eventUrl = baseUrl + '/#/events/category/3';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (/^\d+\s*EGP|Prices?\s*From\s*:\s*\d+|^\d+\s*ج\.م/i.test(line)) {
            const numMatch = line.match(/(\d+(?:\.\d+)?)/);
            if (numMatch) priceStr = numMatch[1];
          }
          if (datePattern.test(line) && !dateStr) dateStr = line.replace(/\s*\d+\s*EGP.*$/i, '').trim();
          if (/Main Hall|Small Theatre|Theatre|Opera|Cairo|المسرح|دار الأوبرا/i.test(line) && line.length < 80) locationStr = line;
        }

        for (const line of lines) {
          if (line.length < 10 || line.length > 180) continue;
          if (/Buy Tickets|Clear Search|Search|Event Name|Event Category|Event date|شراء/i.test(line)) continue;
          if (datePattern.test(line) && line.length < 30) continue;
          if (/^\d+\s*EGP/i.test(line)) continue;
          title = line;
          break;
        }
        if (!title) title = lines[0] || 'Event';

        const link = card.querySelector('a[href*="event"], a[href*="ticket"], a[href*="#/"]');
        if (link) {
          const href = link.getAttribute('href') || '';
          eventUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
        }

        const slug = (title + (dateStr || '') + locationStr).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
        const id = slug ? `tazkarti_${slug.substring(0, 40)}` : `tazkarti_${idx}`;
        const titleKey = (title + (dateStr || '')).toLowerCase();
        if (seenTitles.has(titleKey)) return;
        seenTitles.add(titleKey);

        result.push({
          id,
          title: title.substring(0, 200),
          description: '',
          location: locationStr || '',
          startDate: dateStr || null,
          time: null,
          imageUrl: null,
          eventUrl,
          category: 'Music',
          price: priceStr,
          isBookmarked: false,
        });
      });

      if (result.length === 0) {
        document.querySelectorAll('a[href*="event"], a[href*="#/"]').forEach((a) => {
          const href = a.getAttribute('href') || '';
          const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
          const card = a.closest('div, li, article') || a.parentElement;
          const text = (card ? card.innerText : a.innerText) || '';
          if (text.length < 30 || !buyTicketsPattern.test(text)) return;
          const title = (a.textContent || text.split('\n')[0] || 'Event').trim().substring(0, 200);
          const titleKey = title.toLowerCase();
          if (seenTitles.has(titleKey)) return;
          seenTitles.add(titleKey);
          let dateStr = null;
          let priceStr = null;
          const lines = text.split(/\n/).map((s) => s.trim()).filter(Boolean);
          for (const line of lines) {
            if (/\d{1,2}[-/]\w+[-/]\d{2,4}|\d+\s*(?:Jan|Feb|Mar|Feb|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(line)) dateStr = line;
            if (/\d+\s*EGP|Prices?\s*From/i.test(line)) { const m = line.match(/(\d+)/); if (m) priceStr = m[1]; }
          }
          result.push({
            id: `tazkarti_${result.length}`,
            title,
            description: '',
            location: '',
            startDate: dateStr,
            time: null,
            imageUrl: null,
            eventUrl: fullUrl,
            category: 'Music',
            price: priceStr,
            isBookmarked: false,
          });
        });
      }

      return result;
    }, TAZKARTI_BASE);

    await browser.close();

    const now = new Date();
    const normalized = events
      .map((ev) => {
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
      })
      );

    return normalized;
  } catch (err) {
    if (browser) try { await browser.close(); } catch (_) {}
    console.error('Scrape error:', err.message);
    throw err;
  }
}

function safeJson(res, status, body) {
  try {
    res.status(status).json(body);
  } catch (e) {
    res.status(500).end(JSON.stringify({ success: false, error: 'Response failed', events: [] }));
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
      return safeJson(res, 200, {
        success: true,
        cached: true,
        count: cache.data.length,
        events: cache.data,
        message: 'Events from cache',
      });
    }

    const events = await withTimeout(fetchEventsFromTazkarti(), 52000);
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
    console.error('API error:', error);
    // Return 200 with empty events so app gets valid JSON and can show "no events" instead of crash
    return safeJson(res, 200, {
      success: false,
      error: 'Failed to fetch events',
      message: error.message || 'Scraper error',
      events: [],
      count: 0,
    });
  }
};
