#!/usr/bin/env node
// Claude Code command hook — receives events and forwards to the Pets monitor.
// Usage: node hook.js <event_name>
// Reads session JSON from stdin (piped by Claude Code).

const http = require("http");

const EVENT_TO_STATE = {
  SessionStart: "idle",
  SessionEnd: "sleeping",
  UserPromptSubmit: "thinking",
  PreToolUse: "working",
  PostToolUse: "working",
  PostToolUseFailure: "error",
  Stop: "done",
  StopFailure: "error",
  SubagentStart: "juggling",
  SubagentStop: "working",
  PreCompact: "sweeping",
  PostCompact: "done",
  Notification: "notification",
};

const HOSTNAME = "127.0.0.1";
const PORT = 3456;

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    process.stdin.on("error", () => resolve({}));
  });
}

function postState(body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: HOSTNAME,
        port: PORT,
        path: "/state",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: 2000,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end(payload);
  });
}

function extractPromptTitle(prompt) {
  if (typeof prompt !== "string") return null;
  const firstLine = prompt.split("\n")[0].trim();
  if (!firstLine) return null;
  return firstLine.length > 80 ? firstLine.slice(0, 77) + "..." : firstLine;
}

async function main() {
  const event = process.argv[2];
  const state = EVENT_TO_STATE[event];
  if (!state) process.exit(0);

  const payload = await readStdin();
  const sessionId = payload.session_id || "default";
  const cwd = payload.cwd || "";
  const toolName = payload.tool_name || null;
  const sessionTitle =
    payload.session_title ||
    extractPromptTitle(payload.prompt) ||
    null;

  const body = {
    event,
    state,
    session_id: sessionId,
    cwd,
    tool_name: toolName,
    session_title: sessionTitle,
  };

  await postState(body);
  process.exit(0);
}

main();
