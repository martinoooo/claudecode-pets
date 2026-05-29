const http = require("http");

const PORT = 3456;

// SSE clients
const clients = new Set();

// Latest state snapshot (sent to new clients on connect)
let currentState = {
  event: null,
  state: null,
  sessionId: null,
  toolName: null,
  sessionTitle: null,
  cwd: null,
  timestamp: null,
};

// Recent event timeline (last 50)
const recentEvents = [];
const MAX_EVENTS = 50;

function addEvent(event) {
  recentEvents.unshift(event);
  if (recentEvents.length > MAX_EVENTS) recentEvents.length = MAX_EVENTS;
}

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    res.write(msg);
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // SSE endpoint
  if (req.method === "GET" && url.pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    // Send initial snapshot
    res.write(`data: ${JSON.stringify({ type: "snapshot", ...currentState, recentEvents })}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  // State update from hook
  if (req.method === "POST" && url.pathname === "/state") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        currentState = {
          event: data.event,
          state: data.state,
          sessionId: data.session_id,
          toolName: data.tool_name || null,
          sessionTitle: data.session_title || null,
          cwd: data.cwd || null,
          timestamp: new Date().toISOString(),
        };
        addEvent(currentState);
        broadcast({ type: "update", ...currentState, recentEvents });
        console.log(`[${currentState.timestamp}] ${data.event} | ${data.state}${data.tool_name ? " | " + data.tool_name : ""}`);
      } catch (e) {
        console.error("Invalid state payload:", e.message);
      }
      res.writeHead(200);
      res.end("ok");
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Claude Code Pets — server listening on http://localhost:${PORT}`);
  console.log(`Waiting for hook events...`);
});
