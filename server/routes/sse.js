// Server-Sent Events (SSE) Bus
// Broadcasts low-latency market ticks, sentiment shifts, and AI updates to connected institutional clients.

const sseClients = new Set();

export function sseHandler(req, res) {
  // Set required headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no'
  });

  // Send initial connection packet
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Connected to Aureus Pro Live Institutional Feed', timestamp: Date.now() })}\n\n`);

  sseClients.add(res);

  // Heartbeat ping every 25 seconds to keep SSE connection alive through reverse proxies/Render
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (e) {
      clearInterval(heartbeatTimer);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    sseClients.delete(res);
  });
}

export function broadcastToAll(eventType, payload) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

export function getClientCount() {
  return sseClients.size;
}
