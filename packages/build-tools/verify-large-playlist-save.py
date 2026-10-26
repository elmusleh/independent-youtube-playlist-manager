"""Real Firefox sort/save/reload and failure/retry in a disposable profile."""
import json
import os
from pathlib import Path
import tempfile
import uuid
import zipfile
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.support.ui import WebDriverWait

os.environ["SE_AVOID_STATS"] = "true"
ROOT = Path(__file__).resolve().parents[2]
EXTENSION = ROOT / "dist/firefox"
OUTPUT = ROOT / "dist/verification"
OUTPUT.mkdir(parents=True, exist_ok=True)
addon_id = json.loads((EXTENSION / "manifest.json").read_text())["browser_specific_settings"]["gecko"]["id"]
addon_uuid = str(uuid.uuid4())
options = Options()
options.add_argument("-headless")
options.set_preference("extensions.webextensions.uuids", json.dumps({addon_id: addon_uuid}))
options.set_preference("permissions.default.image", 2)
report = {}

with tempfile.TemporaryDirectory(prefix="iypm-large-save-") as directory:
    archive = Path(directory) / "test.xpi"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as output:
        for file in EXTENSION.rglob("*"):
            if file.is_file():
                output.write(file, file.relative_to(EXTENSION))
    driver = webdriver.Firefox(options=options, service=Service(service_args=["--allow-system-access"]))
    driver.set_script_timeout(90)
    wait = WebDriverWait(driver, 90)

    def evaluate(script):
        result = driver.execute_async_script(
            "const done=arguments[arguments.length-1];(async()=>{" + script +
            "})().then(value=>done({value}),error=>done({error:String(error)}));"
        )
        assert "error" not in result, result
        return result.get("value")

    def click(text):
        wait.until(lambda d: d.find_element(By.XPATH, "//button[normalize-space(.)='" + text + "']")).click()

    try:
        driver.install_addon(str(archive), temporary=True)
        url = f"moz-extension://{addon_uuid}/editor/index.html#/saved"
        driver.set_context("chrome")
        driver.execute_script(
            "gBrowser.selectedBrowser.loadURI(Services.io.newURI(arguments[0]),"
            "{triggeringPrincipal:Services.scriptSecurityManager.getSystemPrincipal()})", url)
        driver.set_context("content")
        wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, "#app main"))
        evaluate("""
          await window.getPlaylists();
          const ids=Array.from({length:14000},(_,i)=>'vid'+String(i).padStart(8,'0'));
          await browser.storage.local.set({yph_local_playlists:[{
            id:'local-large',title:'Large sort verification',videos:ids,
            timestamp:Date.now(),isLocal:true,saved:true
          }]});
          await browser.storage.sync.set({autoFetchMetadata:false,autoSaveEditor:false,defaultPageSize:10});
          await window.videoService.cacheMetadata(Object.fromEntries(ids.map((id,i)=>[id,{
            videoId:id,title:'Video '+id,channel:i%2?'A channel':'Z channel',
            durationSeconds:120,lastCachedAt:Date.now()
          }])));
          window.location.hash='#/playlist?id=local-large'; return true;
        """)
        wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, ".playlist-video"))
        click("Sort")
        click("Channel (A-Z)")
        wait.until(lambda d: evaluate("""
          const p=(await browser.storage.local.get('yph_local_playlists')).yph_local_playlists[0];
          return p.sortRules?.[0]?.field==='channel' && p.videos[0]==='vid00000001';
        """))
        report["sortedVideoCount"] = evaluate("return (await window.getLocalPlaylists())[0].videos.length;")
        driver.refresh()
        wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, ".playlist-video"))
        assert evaluate("return (await window.getLocalPlaylists())[0].videos[0];") == "vid00000001"
        assert driver.find_elements(By.CSS_SELECTOR, ".sort-badge")
        report["reloadPreservesOrderAndRules"] = True
        # Fail the next playlist write at the service boundary, after the UI edit.
        evaluate("""
          window.testRejections=[];
          window.addEventListener('unhandledrejection',e=>window.testRejections.push(String(e.reason)));
          window.testOriginalSave=window.savePlaylist;
          window.savePlaylist=async()=>{throw new Error('Test storage unavailable');};
          return true;
        """)
        click("Sort")
        click("Channel (Z-A)")
        wait.until(lambda d: "Test storage unavailable" in d.find_element(By.CSS_SELECTOR, ".save-error").text)
        driver.save_screenshot(str(OUTPUT / "large-playlist-save-retry.png"))
        driver.set_window_size(390, 844)
        assert evaluate("""
          const r=document.querySelector('.save-error').getBoundingClientRect();
          return r.left>=0 && r.right<=innerWidth;
        """)
        driver.save_screenshot(str(OUTPUT / "large-playlist-save-retry-mobile.png"))
        assert evaluate("return (await window.getLocalPlaylists())[0].videos[0];") == "vid00000001"
        evaluate("window.savePlaylist=window.testOriginalSave; return true;")
        click("Retry")
        wait.until(lambda d: not d.find_elements(By.CSS_SELECTOR, ".save-error"))
        wait.until(lambda d: evaluate("return (await window.getLocalPlaylists())[0].videos[0];") == "vid00000000")
        assert evaluate("return (await window.getLocalPlaylists())[0].videos.length;") == 14000
        report["failedSavePreservesStoredDataAndRetrySavesEdits"] = True
        assert evaluate("return window.testRejections;") == []
        report["unhandledRejections"] = []
        report["browserVersion"] = driver.capabilities["browserVersion"]
        (OUTPUT / "large-playlist-save-report.json").write_text(json.dumps(report, indent=2))
        print(json.dumps(report, indent=2))
    finally:
        driver.quit()
