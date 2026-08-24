const http = require("http");
const httpProxy = require("http-proxy");

// Create a proxy server with custom configuration
const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  autoRewrite: true,
  followRedirects: true,
});

const server = http.createServer((req, res) => {
  // Add CORS headers to every response
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With, content-type, Authorization");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // The target URL is expected to be the first part of the path
  // e.g., http://localhost:4444/https://www.youtube.com/...
  // or http://localhost:4444/www.youtube.com:443/...
  let target = req.url.slice(1);

  if (!target) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("CORS Proxy is running. Usage: /http://target-url.com/path");
    return;
  }

  // Prepend https:// if not present
  if (!target.startsWith("http")) {
    target = "https://" + target;
  }

  // Validate target URL against whitelist to prevent arbitrary SSRF
  try {
    const parsedTarget = new URL(target);
    let host = parsedTarget.hostname.toLowerCase();

    // Remove trailing dot if present
    if (host.endsWith(".")) {
      host = host.slice(0, -1);
    }

    // Split off port if present (e.g., 'youtube.com:443' -> 'youtube.com')
    if (host.includes(":")) {
      host = host.split(":")[0];
    }

    // Reject IP addresses and localhost
    const ipRegex =
      /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/ |
      /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/ |
      /^::1$/ |
      /^fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}$/ |
      /^::(ffff(:0{1,4}){0,1}:){0,1}(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/ |
      /^([0-9a-fA-F]{1,4}:){1,4}:(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;
    if (ipRegex.test(host) || host === "localhost") {
      console.warn(`[PROXY BLOCKED] Attempted request to IP address or localhost: ${host}`);
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden: Target domain is not allowed.");
      return;
    }

    const allowedHosts = [
      "youtube.com",
      "youtubei.googleapis.com",
      "pipedapi.kavin.rocks",
      "api.piped.private.coffee",
      "inv.nadeko.net",
      "yewtu.be",
      "api.spotify.com",
    ];

    const isAllowed = allowedHosts.some(
      (allowed) => host === allowed || host.endsWith("." + allowed)
    );

    if (!isAllowed) {
      console.warn(`[PROXY BLOCKED] Attempted request to non-whitelisted domain: ${host}`);
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden: Target domain is not whitelisted in CORS proxy.");
      return;
    }
  } catch (e) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Invalid target URL.");
    return;
  }

  // Reconstruct the target from the validated parsed URL to prevent
  // URL manipulation bypass (SSRF). The raw user-supplied target string
  // could contain encoded characters or null bytes that re-resolve after the check.
  const safeTarget = parsedTarget.origin + parsedTarget.pathname + parsedTarget.search;

  // Log the request
  console.log(`[PROXY] ${req.method} ${req.url} -> ${safeTarget}`);

  // Perform the proxying
  proxy.web(req, res, { target: safeTarget }, (err) => {
    console.error(`[PROXY ERROR] ${err.message}`);
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(`Proxy Error: ${err.message}`);
  });
});

const PORT = 4444;
server.listen(PORT, () => {
  console.log(`CORS Proxy running on http://localhost:${PORT}`);
  console.log("To test: http://localhost:4444/https://www.google.com");
});
