/* eslint-disable no-console */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const fixture = fs.readFileSync(
  path.resolve(__dirname, "../../docs/testing/native-context-menu.html")
);
http
  .createServer((_request, response) => {
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(fixture);
  })
  .listen(43177, "127.0.0.1", () =>
    console.log("Native menu fixture: http://127.0.0.1:43177/ (Ctrl+C to stop)")
  );
