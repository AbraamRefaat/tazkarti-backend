/**
 * Tazkarti Events API - Vercel Serverless Function
 * Returns upcoming music events from Tazkarti
 */

// Cache for events (persists during function warm state)
let eventsCache = {
  data: null,
  timestamp: null,
  ttl: 30 * 60 * 1000 // 30 minutes
};

/**
 * Get Tazkarti events
 * For now, returns curated events from Tazkarti.com
 * TODO: Implement web scraping when serverless browser is properly configured
 */
function getTazkartiEvents() {
  const now = new Date();
  
  // Curated events from Tazkarti.com - Update these periodically
  const allEvents = [
    {
      id: 'tazkarti_1',
      title: 'Talents Development Center Concert',
      description: 'Musical performance at Cairo Opera House Main Hall',
      location: 'Cairo Opera House Main Hall',
      startDate: new Date(2026, 1, 19).toISOString(), // Feb 19, 2026
      time: null,
      imageUrl: null,
      eventUrl: 'https://www.tazkarti.com',
      category: 'Music',
      price: 160,
      isBookmarked: false
    },
    {
      id: 'tazkarti_2',
      title: 'Cairo Symphony Orchestra (Arabic Perspectives)',
      description: 'Arabic music perspectives by Cairo Symphony Orchestra',
      location: 'Cairo Opera House Main Hall',
      startDate: new Date(2026, 1, 21).toISOString(), // Feb 21, 2026
      time: null,
      imageUrl: null,
      eventUrl: 'https://www.tazkarti.com',
      category: 'Music',
      price: 130,
      isBookmarked: false
    },
    {
      id: 'tazkarti_3',
      title: 'Talents Development Center Concert',
      description: 'Musical performance at Small Theatre',
      location: 'Small Theatre',
      startDate: new Date(2026, 1, 27).toISOString(), // Feb 27, 2026
      time: null,
      imageUrl: null,
      eventUrl: 'https://www.tazkarti.com',
      category: 'Music',
      price: 160,
      isBookmarked: false
    },
    {
      id: 'tazkarti_4',
      title: 'Cairo Symphony Orchestra - Arabic Perspectives',
      description: 'Arabic music perspectives by Cairo Symphony Orchestra',
      location: 'Cairo Opera House Main Hall',
      startDate: new Date(2026, 1, 28).toISOString(), // Feb 28, 2026
      time: null,
      imageUrl: null,
      eventUrl: 'https://www.tazkarti.com',
      category: 'Music',
      price: 130,
      isBookmarked: false
    },
    {
      id: 'tazkarti_5',
      title: 'Classical Music Evening',
      description: 'Experience the finest classical music performances',
      location: 'Cairo Opera House',
      startDate: new Date(2026, 2, 5).toISOString(), // Mar 5, 2026
      time: null,
      imageUrl: null,
      eventUrl: 'https://www.tazkarti.com/#/events/category/3',
      category: 'Music',
      price: null,
      isBookmarked: false
    },
    {
      id: 'tazkarti_6',
      title: 'Contemporary Music Festival',
      description: 'Modern Egyptian music festival featuring top artists',
      location: 'Cairo Opera House',
      startDate: new Date(2026, 2, 12).toISOString(), // Mar 12, 2026
      time: null,
      imageUrl: null,
      eventUrl: 'https://www.tazkarti.com/#/events/category/3',
      category: 'Music',
      price: null,
      isBookmarked: false
    }
  ];
  
  // Filter to only return upcoming events
  const upcomingEvents = allEvents.filter(event => {
    const eventDate = new Date(event.startDate);
    return eventDate > now;
  });
  
  return upcomingEvents;
}

/**
 * Vercel Serverless Function Handler
 */
module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const now = Date.now();
    
    // Check cache
    if (eventsCache.data && eventsCache.timestamp) {
      const age = now - eventsCache.timestamp;
      if (age < eventsCache.ttl) {
        console.log('Returning cached events');
        return res.status(200).json({
          success: true,
          cached: true,
          count: eventsCache.data.length,
          events: eventsCache.data,
          message: 'Events from cache'
        });
      }
    }

    console.log('Getting fresh events...');
    const events = getTazkartiEvents();
    
    // Update cache
    eventsCache.data = events;
    eventsCache.timestamp = now;
    
    return res.status(200).json({
      success: true,
      cached: false,
      count: events.length,
      events: events,
      message: 'Events fetched successfully',
      note: 'Events are curated from Tazkarti.com. Updated regularly.'
    });

  } catch (error) {
    console.error('Error fetching events:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch events',
      message: error.message
    });
  }
};
