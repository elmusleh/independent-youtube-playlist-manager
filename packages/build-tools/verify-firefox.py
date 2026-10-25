"""Verify the real Firefox add-on in a disposable Selenium profile.

Install selenium in a virtual environment, then run this file with that Python.
--android tests Android user-agent branches; it does not replace a physical phone.
"""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import uuid
import zipfile

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.support.ui import WebDriverWait

os.environ["SE_AVOID_STATS"] = "true"
ROOT = Path(__file__).resolve().parents[2]
EXTENSION = ROOT / "dist/firefox"
OUTPUT = ROOT / "dist/verification"
OUTPUT.mkdir(parents=True, exist_ok=True)
ADDON_ID = json.loads((EXTENSION / "manifest.json").read_text())["browser_specific_settings"]["gecko"]["id"]
ADDON_UUID = str(uuid.uuid4())
ANDROID = "--android" in sys.argv
fixture = json.loads(subprocess.check_output([
    "node", "-e",
    "const f=require('./packages/build-tools/extension-fixture.js'); console.log(JSON.stringify({fixture:f.createFixture(),routes:f.routes,sizes:f.sizes}))",
], cwd=ROOT))

options = Options()
options.add_argument("-headless")
options.page_load_strategy = "eager"
options.set_preference("extensions.webextensions.uuids", json.dumps({ADDON_ID: ADDON_UUID}))
options.set_preference("permissions.default.image", 2)
if ANDROID:
    options.set_preference("general.useragent.override", "Mozilla/5.0 (Android 15; Mobile; rv:158.0) Gecko/158.0 Firefox/158.0")

report = {"androidUserAgent": ANDROID, "routeChecks": [], "interactions": []}
with tempfile.TemporaryDirectory(prefix="iypm-firefox-test-") as directory:
    archive_path = Path(directory) / "extension.xpi"
    with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for file in EXTENSION.rglob("*"):
            if file.is_file():
                archive.write(file, file.relative_to(EXTENSION))
    # Privileged navigation is limited to this fresh, disposable test profile.
    driver = webdriver.Firefox(options=options, service=Service(service_args=["--allow-system-access"]))
    driver.set_script_timeout(20)
    wait = WebDriverWait(driver, 20)
    base = f"moz-extension://{ADDON_UUID}"

    def evaluate_async(script, *args):
        result = driver.execute_async_script(
            "const done=arguments[arguments.length-1]; const args=Array.from(arguments).slice(0,-1);"
            "(async()=>{" + script + "})().then(value=>done({value}),error=>done({error:String(error)}));",
            *args,
        )
        assert "error" not in result, result
        return result.get("value")

    def visit(route):
        url = base + "/editor/index.html#" + route
        driver.set_context("chrome")
        driver.execute_script(
            "gBrowser.selectedBrowser.loadURI(Services.io.newURI(arguments[0]), {triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()})",
            url,
        )
        driver.set_context("content")
        wait.until(lambda browser: browser.current_url == url)
        wait.until(lambda browser: browser.find_elements(By.CSS_SELECTOR, "#app main"))
        if route in ["/playlist?id=local-release", "/favorite", "/playlist-builder"]:
            wait.until(lambda browser: browser.find_elements(By.CSS_SELECTOR, ".playlist-video"))

    try:
        assert driver.install_addon(str(archive_path), temporary=True) == ADDON_ID
        report["browserVersion"] = driver.capabilities["browserVersion"]
        visit("/saved")
        evaluate_async("await window.getPlaylists(); return true;")
        evaluate_async(
            "const data=args[0]; await browser.storage.local.set(data.local);"
            "await browser.storage.sync.set(data.settings); await window.videoService.cacheMetadata(data.metadata); return true;",
            fixture["fixture"],
        )
        for width, height in fixture["sizes"]:
            driver.set_window_size(width, height)
            for route in fixture["routes"]:
                visit(route)
                bounds = driver.execute_script("return {content:document.documentElement.scrollWidth,width:innerWidth,height:innerHeight}")
                assert bounds["content"] <= bounds["width"] + 1, (route, width, bounds)
                report["routeChecks"].append({"route": route, "requestedWidth": width, **bounds})
                if width in [390, 1440]:
                    suffix = "android-ua" if ANDROID else "desktop"
                    driver.save_screenshot(str(OUTPUT / f"firefox-{suffix}-{width}-{route.split('?')[0][1:]}.png"))
        driver.set_window_size(390, 844)
        visit("/playlist?id=local-release")
        assert len(driver.find_elements(By.CSS_SELECTOR, ".playlist-video")) == 10
        opener = driver.find_element(By.CSS_SELECTOR, 'button[title="Add videos from URLs or IDs"]')
        opener.click()
        wait.until(lambda browser: browser.find_elements(By.CSS_SELECTOR, "dialog[open]"))
        for _ in range(12):
            driver.switch_to.active_element.send_keys(Keys.TAB)
            assert driver.execute_script("return !!document.activeElement.closest('dialog[open]')")
        driver.switch_to.active_element.send_keys(Keys.ESCAPE)
        wait.until(lambda browser: not browser.find_elements(By.CSS_SELECTOR, "dialog[open]"))
        assert driver.execute_script("return document.activeElement.getAttribute('title')") == "Add videos from URLs or IDs"
        report["interactions"].append("Import modal, keyboard focus containment, Escape, focus restoration")
        driver.find_elements(By.CSS_SELECTOR, 'button[title="Delete video"]')[0].click()
        wait.until(lambda browser: browser.find_elements(By.CSS_SELECTOR, "dialog[open] .cancel"))
        assert driver.execute_script("return document.activeElement.classList.contains('cancel')")
        driver.switch_to.active_element.send_keys(Keys.ENTER)
        wait.until(lambda browser: not browser.find_elements(By.CSS_SELECTOR, "dialog[open]"))
        report["interactions"].append("Safe destructive confirmation and keyboard cancellation")
        if not ANDROID:
            assert driver.execute_script("return browser.identity.getRedirectURL()") == "https://3e620d879f8d5cd15ced330a480af23c64165099.extensions.allizom.org/"
            report["interactions"].append("Firefox native OAuth redirect agrees with Android derivation")
        filename = "firefox-android-ua-report.json" if ANDROID else "firefox-report.json"
        (OUTPUT / filename).write_text(json.dumps(report, indent=2))
        print(f"PASS: Firefox {report['browserVersion']}; {len(report['routeChecks'])} route/viewport checks; {len(report['interactions'])} interaction groups; Android UA={ANDROID}")
    finally:
        driver.quit()
