<script lang="ts">
  import Fa from "svelte-fa";
  import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
  import type { DeviceCapabilities } from "../../services/sync/capabilities.js";

  let { caps }: { caps: DeviceCapabilities } = $props();
</script>

<section class="card">
  <h3><Fa icon={faCircleInfo} /> Where sync works</h3>
  <div class="compat-table">
    <div class="compat-row compat-head">
      <span>Platform</span>
      <span>Cloud sync</span>
      <span>File sync</span>
    </div>
    <div class="compat-row" class:you={caps.platform === "chrome" || caps.platform === "edge"}>
      <span>Chrome / Edge</span><span class="compat-ok">✅</span><span class="compat-ok">✅</span>
    </div>
    <div class="compat-row" class:you={caps.platform === "firefox"}>
      <span>Firefox</span><span class="compat-ok">✅</span><span class="compat-no">❌</span>
    </div>
    <div class="compat-row" class:you={caps.platform === "firefox-android"}>
      <span>Firefox Android</span><span class="compat-ok">✅</span><span class="compat-no">❌</span>
    </div>
    <div class="compat-row">
      <span>Chrome Android</span><span class="compat-na">—</span><span class="compat-na">—</span>
    </div>
    <div class="compat-row">
      <span>Safari</span><span class="compat-na">—</span><span class="compat-na">—</span>
    </div>
  </div>
  <p class="sub-text">
    You're on {caps.platformLabel}. Cloud sync works everywhere the extension runs; file sync needs
    Chrome or Edge on a desktop.
  </p>
</section>
