<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faKey,
    faCheckCircle,
    faExclamationTriangle,
    faExternalLinkAlt,
    faCopy,
    faInfoCircle,
    faCheck,
  } from "@fortawesome/free-solid-svg-icons";
  import ViewHeader from "../components/ViewHeader.svelte";
  import SimpleButton from "../components/SimpleButton.svelte";
  import SaveStatus from "../components/SaveStatus.svelte";
  import { StatusManager } from "../services/status-manager.svelte";
  import { onDestroy, tick } from "svelte";

  const browser = (window as any).browser || (window as any).chrome;

  let clientId = $state("");
  let apiKey = $state("");
  const status = new StatusManager();
  let testStatus: "idle" | "testing" | "success" | "error" = $state("idle");
  let testMessage = $state("");
  let redirectUri = $state("");
  let chromeRedirectUri = $state("");

  async function refresh() {
    await status.refresh(async () => {
      // Re-load logic
      const result = await browser.storage.local.get("custom_yt_credentials");
      const creds = result.custom_yt_credentials || {
        clientId: "",
        apiKey: "",
      };
      clientId = creds.clientId || "";
      apiKey = creds.apiKey || "";
    });
  }

  (async () => {
    try {
      // Firefox URI: derive from the gecko ID in the loaded manifest
      const manifest = browser.runtime.getManifest();
      const geckoId = manifest?.browser_specific_settings?.gecko?.id;
      if (geckoId) {
        // UUID-style IDs (e.g. {abcd-...}) get the braces stripped for the URL
        const cleanId = geckoId.replace(/^\{|\}$/g, "");
        redirectUri = `https://${cleanId}.extensions.allizom.org/`;
      } else {
        // Fallback if gecko ID not found in manifest
        redirectUri = "";
      }
      // Chrome URI is derived from the actual runtime extension ID Chrome assigned
      const isFirefox = navigator.userAgent.includes("Firefox");
      if (!isFirefox) {
        const extId = browser.runtime.id;
        chromeRedirectUri = `https://${extId}.chromiumapp.org/`;
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error("[DEV-SETUP] Failed to build redirect URIs:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "ERROR",
          `[DEV-SETUP] Failed to build redirect URIs: ${errMsg}`,
        );
    }
  })();

  // Load existing credentials
  (async () => {
    if (window.logSystemEvent)
      await window.logSystemEvent(
        "INFO",
        "[DEV-SETUP] Loading custom credentials",
      );
    try {
      const result = await browser.storage.local.get("custom_yt_credentials");
      const creds = result.custom_yt_credentials || {
        clientId: "",
        apiKey: "",
      };
      clientId = creds.clientId || "";
      apiKey = creds.apiKey || "";
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          `[DEV-SETUP] Credentials loaded: clientId=${clientId ? "set" : "empty"}, apiKey=${apiKey ? "set" : "empty"}`,
        );
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error("Failed to load custom credentials", e);
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "ERROR",
          `[DEV-SETUP] Failed to load credentials: ${errMsg}`,
        );
    }
  })();

  let _debounce: ReturnType<typeof setTimeout> | null = null;
  function handleInput() {
    if (_debounce) clearTimeout(_debounce);
    _debounce = setTimeout(() => {
      saveCredentials();
    }, 500);
  }

  async function saveCredentials() {
    await status.save(async () => {
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          "[DEV-SETUP] Saving custom credentials",
        );
      
      const result = await browser.storage.local.get("custom_yt_credentials");
      const oldCreds = result.custom_yt_credentials || {
        clientId: "",
        apiKey: "",
      };
      if (oldCreds.clientId !== clientId && oldCreds.clientId) {
        if (window.logSystemEvent)
          await window.logSystemEvent(
            "INFO",
            "[DEV-SETUP] Client ID changed, invalidating auth token",
          );
        // Token is likely invalid now
        await browser.storage.local.remove("yt_auth_token_cache");
      }

      await browser.storage.local.set({
        custom_yt_credentials: {
          clientId: clientId.trim(),
          apiKey: apiKey.trim(),
        },
      });
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          "[DEV-SETUP] Credentials saved successfully",
        );

      // Give the storage a moment to save, then notify to update auth and sidebars
      setTimeout(() => {
        window.invalidateCacheAndNotify();
      }, 100);
    });
  }

  async function testConnection() {
    testStatus = "testing";
    testMessage = "Starting authentication flow...";
    if (window.logSystemEvent)
      await window.logSystemEvent(
        "INFO",
        "[DEV-SETUP] Testing connection with custom credentials",
      );

    try {
      // Force sign in to ensure token with new client ID is fetched
      await window.signIn();

      testMessage = "Authentication successful. Fetching channel data...";
      const channel = await window.ytGetMyChannel();

      if (channel && channel.title) {
        testStatus = "success";
        testMessage = `Success! Connected as: ${channel.title}`;
        if (window.logSystemEvent)
          await window.logSystemEvent(
            "INFO",
            `[DEV-SETUP] Connection test successful: ${channel.title}`,
          );
      } else {
        testStatus = "error";
        testMessage =
          "Failed to fetch channel data. Check your API Key and quotas.";
        if (window.logSystemEvent)
          await window.logSystemEvent(
            "ERROR",
            "[DEV-SETUP] Connection test failed: no channel data returned",
          );
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      const code = (e as any)?.code;
      console.error("Connection test failed:", e);
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "ERROR",
          `[DEV-SETUP] Connection test failed: ${errMsg}`,
        );
      testStatus = "error";
      if (code === "redirect_uri_mismatch") {
        testMessage = "Redirect URI mismatch: Copy the redirect URI(s) shown below and add them to your Google Cloud Console OAuth client under Authorized redirect URIs.";
      } else if (code === "credentials_missing") {
        testMessage = "No credentials set. Enter your Client ID and API Key above first.";
      } else {
        testMessage = "Connection failed: " + errMsg;
      }
    }
  }

  async function copyRedirectUri() {
    try {
      await navigator.clipboard.writeText(redirectUri);
      window.success("Copied to clipboard");
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "INFO",
          "[DEV-SETUP] Redirect URI copied to clipboard",
        );
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      window.error("Failed to copy");
      if (window.logSystemEvent)
        await window.logSystemEvent(
          "ERROR",
          `[DEV-SETUP] Failed to copy redirect URI: ${errMsg}`,
        );
    }
  }

  async function copyChromeRedirectUri() {
    try {
      await navigator.clipboard.writeText(chromeRedirectUri);
      window.success("Copied to clipboard");
    } catch (e) {
      window.error("Failed to copy");
    }
  }
</script>

<main>
  <div class="view-header">
    <div class="top-left">
      <ViewHeader icon={faKey} title="API Setup" />
    </div>

    <div class="btn-group right-align">
      <SaveStatus onclick={refresh} {status} />
    </div>
  </div>

  <div class="view-body">
    <div class="content">
      <section class="card intro-card">
        <div class="intro-header">
          <Fa icon={faKey} size="2x" />
          <h2>Use Your Own YouTube API Quota</h2>
        </div>
        <p>
          To prevent hitting the extension's shared usage limits, you can
          configure the extension to use your own Google Cloud Console
          credentials. This requires setting up a project and generating your
          own Client ID and API Key.
        </p>
      </section>

      <div class="columns">
        <section class="card instructions-card">
          <h3>Step-by-Step Guide</h3>
          <ol class="steps">
            <li>
              Go to the
              <a
                href="https://console.cloud.google.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Cloud Console <Fa icon={faExternalLinkAlt} />
              </a>
            </li>
            <li>Create a new Project or select an existing one.</li>
            <li>
              Navigate to <strong>APIs & Services > Library</strong>, search for
              <strong>YouTube Data API v3</strong>, and click
              <strong>Enable</strong>.
            </li>
            <li>
              Go to <strong>APIs & Services > OAuth consent screen</strong>.
              Choose <strong>Internal</strong> (if available) or
              <strong>External</strong>. Set an App Name (e.g., "YPH Editor").
              <br />
              <strong>CRITICAL:</strong> Keep the Publishing Status as
              <strong>"Testing"</strong>. Do NOT click "Publish App".
            </li>
            <li>
              On the same screen, scroll down to <strong>Test users</strong>.
              Click <strong>Add Users</strong> and enter your
              <strong>own personal Gmail address</strong>.
              <br />
              <span class="step-note"
                >Without this, login will fail with a "Project not verified"
                error.</span
              >
            </li>
            <li>
              Go to <strong>APIs & Services > Credentials</strong>.
            </li>
            <li>
              Click <strong>Create Credentials > API Key</strong>. Copy the
              generated key.
            </li>
            <li>
              Click <strong>Create Credentials > OAuth client ID</strong>.
            </li>
            <li>
              Select <strong>Web application</strong> as the Application type.
            </li>
            <li>
              Under <strong>Authorized redirect URIs</strong>, add the URI(s)
              for your browser(s):
              {#if !chromeRedirectUri}
                <div class="uri-label">Firefox</div>
                <div class="uri-box">
                  <code>{redirectUri || "Loading…"}</code>
                  <button
                    class="copy-btn"
                    onclick={copyRedirectUri}
                    title="Copy to clipboard"
                    disabled={!redirectUri}
                  >
                    <Fa icon={faCopy} />
                  </button>
                </div>
              {/if}
              {#if chromeRedirectUri}
                <div class="uri-label">Chrome</div>
                <div class="uri-box">
                  <code>{chromeRedirectUri}</code>
                  <button
                    class="copy-btn"
                    onclick={copyChromeRedirectUri}
                    title="Copy to clipboard"
                  >
                    <Fa icon={faCopy} />
                  </button>
                </div>
              {/if}
              <span class="step-note">Add all URIs that apply to your target browser(s).</span>
            </li>
            <li>
              <strong>Note:</strong> After adding the redirect URI(s), it may take a few minutes for the changes to take effect. If you get a "redirect_uri_mismatch" error immediately after setup, please wait a few minutes and try again.
            </li>
            <li>
              Click <strong>Create</strong> and copy the generated
              <strong>Client ID</strong>.
            </li>
          </ol>

          <div class="pro-tip">
            <Fa icon={faInfoCircle} />
            <p>
              <strong>Pro-Tip:</strong> Make sure your status is set to 'Testing'
              and your email is added under 'Test Users' in the Google Console, or
              the login will be blocked.
            </p>
          </div>
        </section>

        <section class="card input-card">
          <h3>Your Credentials</h3>
          <p class="privacy-note">
            <Fa icon={faInfoCircle} />
            These keys are stored ONLY in your local browser storage and are never
            sent to any servers.
          </p>

          <div class="field">
            <label for="clientId">Client ID</label>
            <input
              aria-label="Client ID"
              id="clientId"
              type="text"
              bind:value={clientId}
              oninput={handleInput}
              placeholder="e.g. 123456789-abc...apps.googleusercontent.com"
            />
          </div>

          <div class="field">
            <label for="apiKey">API Key / Client Secret</label>
            <input
              aria-label="API Key or Client Secret"
              id="apiKey"
              type="text"
              bind:value={apiKey}
              oninput={handleInput}
              placeholder="e.g. AIzaSyB..."
            />
          </div>

          <div class="test-connection-box">
            <SimpleButton
              onclick={testConnection}
              primary
              disabled={testStatus === "testing"}
            >
              Test Connection
            </SimpleButton>

            {#if testStatus !== "idle"}
              <div class="test-result {testStatus}">
                {#if testStatus === "testing"}
                  <div class="spinner"></div>
                {:else if testStatus === "success"}
                  <Fa icon={faCheckCircle} />
                {:else}
                  <Fa icon={faExclamationTriangle} />
                {/if}
                <span>{testMessage}</span>
              </div>
            {/if}
          </div>
        </section>
      </div>
    </div>
  </div>
</main>

<style>

  .status-container {
    height: 32px;
    display: flex;
    align-items: center;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .card {
    background: var(--background-color);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }

  .intro-card {
    background: linear-gradient(
      to right,
      rgba(62, 166, 255, 0.05),
      transparent
    );
    border-left: 4px solid var(--primary-color);
  }

  .intro-header {
    display: flex;
    align-items: center;
    gap: 16px;
    color: var(--primary-color);
    margin-bottom: 12px;
  }

  .intro-header h2 {
    margin: 0;
    font-size: 20px;
    color: var(--text-color);
  }

  .intro-card p {
    margin: 0;
    line-height: 1.6;
    color: var(--text-muted);
    font-size: 15px;
  }

  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  @media (max-width: 900px) {
    .columns {
      grid-template-columns: 1fr;
    }
  }

  h3 {
    margin-top: 0;
    margin-bottom: 20px;
    font-size: 18px;
    color: var(--text-color);
  }

  .steps {
    margin: 0;
    padding-left: 20px;
    color: var(--text-color);
    line-height: 1.6;
    font-size: 15px;
  }

  .steps li {
    margin-bottom: 12px;
  }

  .steps li::marker {
    color: var(--primary-color);
    font-weight: bold;
  }

  .steps a {
    color: var(--primary-color);
    text-decoration: none;
    font-weight: 500;
  }

  .steps a:hover {
    text-decoration: underline;
  }

  .step-note {
    font-size: 13px;
    color: var(--text-muted);
    font-style: italic;
  }

  .uri-box {
    display: flex;
    align-items: center;
    background: var(--hover-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 8px 12px;
    margin-top: 8px;
    gap: 12px;
  }

  .uri-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    margin-top: 8px;
    margin-bottom: 2px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .uri-box code {
    flex: 1;
    font-family: monospace;
    font-size: 13px;
    color: var(--text-color);
    word-break: break-all;
  }

  .copy-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 6px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      background 0.2s,
      color 0.2s;
  }

  .copy-btn:hover {
    background: var(--border-color);
    color: var(--text-color);
  }

  .pro-tip {
    margin-top: 24px;
    padding: 16px;
    background: rgba(255, 193, 7, 0.1);
    border: 1px solid rgba(255, 193, 7, 0.3);
    border-radius: 12px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    color: var(--text-color);
    font-size: 14px;
  }

  .pro-tip :global(svg) {
    color: #ffa000;
    margin-top: 3px;
    flex-shrink: 0;
  }

  .pro-tip p {
    margin: 0;
    line-height: 1.5;
  }

  .privacy-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    color: #2ba640;
    background: rgba(43, 166, 64, 0.05);
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    line-height: 1.5;
    margin-top: 0;
    margin-bottom: 24px;
  }

  .privacy-note :global(svg) {
    margin-top: 2px;
    flex-shrink: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }

  .field label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color);
  }

  .field input {
    width: 100%;
    padding: 12px 16px;
    border-radius: 10px;
    border: 1px solid var(--border-color);
    background: var(--hover-color);
    color: var(--text-color);
    font-size: 14px;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
    box-sizing: border-box;
  }

  .field input:focus,
  .field input:focus-visible {
    outline: none;
    border-color: var(--primary-color);
    background: var(--background-color);
    box-shadow: 0 0 0 3px rgba(62, 166, 255, 0.15);
  }

  .test-connection-box {
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .test-result {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    line-height: 1.4;
  }

  .test-result.testing {
    background: rgba(62, 166, 255, 0.1);
    color: var(--text-color);
  }

  .test-result.success {
    background: rgba(43, 166, 64, 0.1);
    color: #2ba640;
    border: 1px solid rgba(43, 166, 64, 0.2);
  }

  .test-result.error {
    background: rgba(244, 67, 54, 0.1);
    color: #f44336;
    border: 1px solid rgba(244, 67, 54, 0.2);
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(62, 166, 255, 0.3);
    border-top-color: #3ea6ff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
