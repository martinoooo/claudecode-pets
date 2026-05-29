#!/usr/bin/env node
// Register or unregister Claude Code hooks for claudecode-pets.
// Usage:
//   node install.js           — register hooks
//   node install.js --uninstall — remove hooks

const fs = require("fs");
const path = require("path");
const os = require("os");

const SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
const HOOK_SCRIPT = path.join(__dirname, "hook.js");
const MARKER = "claudecode-pets";

const HOOK_EVENTS = [
  "SessionStart",
  "SessionEnd",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "Stop",
  "SubagentStart",
  "SubagentStop",
  "Notification",
];

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw new Error(`Failed to read settings.json: ${err.message}`);
  }
}

function writeSettings(settings) {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

function registerHooks() {
  const settings = readSettings();
  if (!settings.hooks) settings.hooks = {};

  let added = 0;
  let skipped = 0;

  for (const event of HOOK_EVENTS) {
    if (!Array.isArray(settings.hooks[event])) {
      settings.hooks[event] = [];
    }

    // Check if already registered
    const alreadyRegistered = settings.hooks[event].some((entry) => {
      if (typeof entry.command === "string" && entry.command.includes(MARKER)) return true;
      if (Array.isArray(entry.hooks)) {
        return entry.hooks.some(
          (h) => typeof h.command === "string" && h.command.includes(MARKER)
        );
      }
      return false;
    });

    if (alreadyRegistered) {
      skipped++;
      continue;
    }

    settings.hooks[event].push({
      matcher: "",
      hooks: [
        {
          type: "command",
          command: `node "${HOOK_SCRIPT}" ${event}`,
        },
      ],
    });
    added++;
  }

  writeSettings(settings);

  console.log(`Claude Code Pets hooks installed to ${SETTINGS_PATH}`);
  console.log(`  Added: ${added}, Skipped (already registered): ${skipped}`);
  console.log(`  Events: ${HOOK_EVENTS.join(", ")}`);
  console.log(`\nRun 'npm start' and open http://localhost:3456 to see the dashboard.`);
}

function unregisterHooks() {
  const settings = readSettings();
  if (!settings.hooks) {
    console.log("No hooks found.");
    return;
  }

  let removed = 0;
  for (const [event, entries] of Object.entries(settings.hooks)) {
    if (!Array.isArray(entries)) continue;

    settings.hooks[event] = entries.filter((entry) => {
      if (typeof entry.command === "string" && entry.command.includes(MARKER)) {
        removed++;
        return false;
      }
      if (Array.isArray(entry.hooks)) {
        entry.hooks = entry.hooks.filter((h) => {
          if (typeof h.command === "string" && h.command.includes(MARKER)) {
            removed++;
            return false;
          }
          return true;
        });
        if (entry.hooks.length === 0 && !entry.command) {
          removed++;
          return false;
        }
      }
      return true;
    });

    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }

  writeSettings(settings);
  console.log(`Removed ${removed} hook(s) from ${SETTINGS_PATH}`);
}

const uninstall = process.argv.includes("--uninstall");

if (uninstall) {
  unregisterHooks();
} else {
  registerHooks();
}
