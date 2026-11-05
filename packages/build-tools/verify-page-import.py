"""Exercise Firefox's real action/activeTab path in disposable test profiles.

The privileged driver activates the browser's own action handler, not a permanent
host grant. A negative build omits activeTab and must fail on the same local page.
Never connects to a user's Firefox profile or changes marketplace submissions.
"""
import json
import os
from pathlib import Path
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import uuid
import zipfile

from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.support.ui import WebDriverWait

os.environ["SE_AVOID_STATS"] = "true"
ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "dist/verification"
OUTPUT.mkdir(parents=True, exist_ok=True)
EXTENSION = ROOT / "dist/firefox"
ADDON_ID = "independent-yt-playlist-manager@elmusleh.github.io"

class Fixture(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.send_header("Content-Security-Policy", "frame-src 'none'; img-src 'none'")
        self.end_headers()
        links = "".join(f'<a href="https://youtu.be/vid{i:08d}">Video {i}</a>' for i in range(40))
        body = '<title>Article fixture</title><h1>Article with videos</h1>' + links
        body += '<a href="https://youtu.be/vid00000000">Duplicate</a>'
        body += '<iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe>'
        body += '<p>https://www.youtube.com/watch?v=dQw4w9WgXcQ</p>'
        self.wfile.write(body.encode())
    def log_message(self, *_):
        pass

server = ThreadingHTTPServer(("127.0.0.1", 0), Fixture)
threading.Thread(target=server.serve_forever, daemon=True).start()
source_url = f"http://127.0.0.1:{server.server_port}/article"
report = []
try:
    for without_active_tab in [False, True]:
        uid = str(uuid.uuid4())
        options = Options()
        options.add_argument("-headless")
        options.set_preference("extensions.webextensions.uuids", json.dumps({ADDON_ID: uid}))
        with tempfile.TemporaryDirectory(prefix="iypm-page-import-") as directory:
            archive = Path(directory) / "extension.xpi"
            with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
                for file in EXTENSION.rglob("*"):
                    if not file.is_file():
                        continue
                    relative = str(file.relative_to(EXTENSION))
                    if relative == "manifest.json" and without_active_tab:
                        manifest = json.loads(file.read_text())
                        manifest["permissions"].remove("activeTab")
                        bundle.writestr(relative, json.dumps(manifest))
                    else:
                        bundle.write(file, relative)
            driver = webdriver.Firefox(options=options, service=Service(service_args=["--allow-system-access"]))
            driver.set_script_timeout(30)
            wait = WebDriverWait(driver, 20)
            def evaluate(script, *args):
                result = driver.execute_async_script(
                    "const done=arguments[arguments.length-1];const args=Array.from(arguments).slice(0,-1);"
                    "(async()=>{" + script + "})().then(value=>done({value}),error=>done({error:String(error)}));",
                    *args,
                )
                assert "error" not in result, result
                return result.get("value")
            def extension_page(path):
                url = f"moz-extension://{uid}/{path}"
                driver.set_context("chrome")
                driver.execute_script(
                    "gBrowser.selectedBrowser.loadURI(Services.io.newURI(arguments[0]),{triggeringPrincipal:Services.scriptSecurityManager.getSystemPrincipal()});",
                    url,
                )
                driver.set_context("content")
                wait.until(lambda d: d.current_url == url)
            try:
                driver.install_addon(str(archive), temporary=True)
                extension_page("popup/popup.html")
                wait.until(lambda d: d.execute_script("return typeof window.getSettings==='function'"))
                evaluate("await browser.storage.sync.set({autoFetchMetadata:false}); return true;")
                driver.switch_to.new_window("tab")
                driver.get(source_url)
                driver.set_context("chrome")
                driver.execute_script(
                    "const {ExtensionParent}=ChromeUtils.importESModule('resource://gre/modules/ExtensionParent.sys.mjs');"
                    "ExtensionParent.apiManager.global.browserActionFor(WebExtensionPolicy.getByID(arguments[0]).extension).triggerAction(window);",
                    ADDON_ID,
                )
                driver.set_context("content")
                driver.switch_to.new_window("tab")
                extension_page("popup/popup.html")
                wait.until(lambda d: d.execute_script("return !!document.getElementById('import-channel').onclick"))
                result = evaluate(
                    "window.close=()=>{};"
                    "const tabs=await browser.tabs.query({});const tab=tabs.find(t=>t.url===args[0]);"
                    "if(!tab)throw new Error('Fixture tab missing: '+JSON.stringify(tabs.map(t=>({id:t.id,url:t.url}))));"
                    "await browser.tabs.update(tab.id,{active:true});"
                    "await document.getElementById('import-channel').onclick();"
                    "const opened=document.getElementById('channel-page').style.display==='block';"
                    "document.getElementById('input-quantity').value='0';"
                    "await document.getElementById('confirm-import').onclick();"
                    "const playlists=await window.getPlaylists();"
                    "return {opened,playlists:playlists.map(p=>({title:p.title,videos:p.videos})),"
                    "error:document.getElementById('page-import-error').textContent,"
                    "retryEnabled:!document.getElementById('confirm-import').disabled,"
                    "origins:(await browser.permissions.getAll()).origins};",
                    source_url,
                )
                assert result["opened"], result
                assert not any("127.0.0.1" in origin or "<all_urls>" in origin for origin in result["origins"]), result
                if without_active_tab:
                    assert not result["playlists"], result
                    assert "toolbar button" in result["error"] and result["retryEnabled"], result
                else:
                    assert len(result["playlists"]) == 1, result
                    videos = result["playlists"][0]["videos"]
                    assert len(videos) == 42 and len(set(videos)) == 42, result
                    assert videos[0] == "vid00000000" and "abcdefghijk" in videos and "dQw4w9WgXcQ" in videos, result
                report.append({"withoutActiveTab":without_active_tab,"browserVersion":driver.capabilities["browserVersion"],**result})
                driver.save_screenshot(str(OUTPUT / ("page-import-no-activeTab.png" if without_active_tab else "page-import-success.png")))
            finally:
                driver.quit()
finally:
    server.shutdown()
(OUTPUT / "page-import-firefox-report.json").write_text(json.dumps(report, indent=2))
print("PASS: Firefox action activation imports 42 unique links locally; removing activeTab blocks access and leaves a retryable error. No permanent fixture-host permission.")
