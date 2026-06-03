const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// ── 1. Lock module resolution to this project only ───────────────────────────
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
];

// ── 2. Top-level shims for Node.js-only packages ─────────────────────────────
const emptyShim = path.resolve(projectRoot, "shims/empty.js");
const wsShim    = path.resolve(projectRoot, "shims/ws.js");

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  // ws → native global.WebSocket shim
  ws: wsShim,
  // Node.js built-ins → empty shim
  stream:           emptyShim,
  "readable-stream": emptyShim,
  "stream-browserify": emptyShim,
  zlib:             emptyShim,
  net:              emptyShim,
  tls:              emptyShim,
  fs:               emptyShim,
  crypto:           emptyShim,
  http:             emptyShim,
  https:            emptyShim,
  os:               emptyShim,
  "perf_hooks":     emptyShim,
  // Optional ws peer-deps that require native binaries
  bufferutil:       emptyShim,
  "utf-8-validate": emptyShim,
};

// ── 3. Custom resolveRequest: block ws/* subpaths AND all Node built-ins ──────
//
// extraNodeModules only catches require('ws').
// But ws/lib/permessage-deflate.js (and other ws/* subpaths) still get bundled
// when imported directly. This hook intercepts EVERYTHING.
//
const wsDir = path.resolve(projectRoot, "node_modules", "ws");

const ALWAYS_SHIM = new Set([
  "zlib", "net", "tls", "fs", "stream", "http", "https",
  "crypto", "util", "events", "os", "path", "url", "buffer",
  "perf_hooks", "child_process", "worker_threads", "v8", "vm",
  "assert", "readline", "string_decoder", "querystring",
  "bufferutil", "utf-8-validate",
]);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Block the entire ws package and any ws/* subpath
  if (moduleName === "ws" || moduleName.startsWith("ws/")) {
    return { type: "sourceFile", filePath: wsShim };
  }

  // Block all Node.js built-ins everywhere
  if (ALWAYS_SHIM.has(moduleName)) {
    return { type: "sourceFile", filePath: emptyShim };
  }

  // Block any require originating FROM WITHIN the ws package dir
  if (
    context.originModulePath &&
    context.originModulePath.startsWith(wsDir)
  ) {
    return { type: "sourceFile", filePath: emptyShim };
  }

  // Default Metro resolution for everything else
  return context.resolveRequest(context, moduleName, platform);
};

// ── 4. Watch only this project root ─────────────────────────────────────────
config.watchFolders = [projectRoot];

module.exports = config;
