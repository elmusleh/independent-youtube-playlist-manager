// sw-init.js must be first — it sets globalThis.window = globalThis before
// any other module runs (ES module imports execute before the body, so the
// polyfill must live in its own module imported first).
import "./sw-init.js";
import "./browser-polyfill.min.js";
import "./editor/youtube-auth.js";
import "./editor/youtube-api.js";
import "./editor/storage-service.js";
import "./editor/utils.js";
import "./editor/video-service.js";
import "./editor/supabase-sync.js";
import "./background.js";

