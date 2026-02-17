/**
 * Root handler for Tazkarti Backend API
 * GET / or GET /api returns this; actual events are at /api/events/music
 */
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    name: 'Tazkarti Events API',
    status: 'ok',
    eventsEndpoint: '/api/events/music',
    message: 'Use GET /api/events/music to fetch music events from Tazkarti.com',
  });
};
