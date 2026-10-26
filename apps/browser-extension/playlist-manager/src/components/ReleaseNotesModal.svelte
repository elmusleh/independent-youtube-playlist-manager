<script lang="ts">
  import Modal from "./Modal.svelte";
  import Fa from "svelte-fa";
  import { faXmark, faFileLines } from "@fortawesome/free-solid-svg-icons";
  import { releaseNotes } from "../generated/release-notes";

  let { display = $bindable(false) }: { display?: boolean } = $props();

  function closeModal() {
    display = false;
  }

  function label(entry: { version: string; date: string }) {
    return entry.date ? `[${entry.version}] - ${entry.date}` : `[${entry.version}]`;
  }
</script>

<Modal bind:display size="wide" title="Release Notes">
  <div class="modal-content">
    <div class="modal-header">
      <h2 id="release-notes-title">
        <Fa icon={faFileLines} fw />
        Release Notes
      </h2>
      <button class="close-btn" onclick={closeModal} aria-label="Close">
        <Fa icon={faXmark} size="lg" />
      </button>
    </div>
    <div class="modal-body">
      <div class="release-notes">
        <h3>All notable changes to this project are documented here.</h3>
        <p>
          Format follows <a
            href="https://keepachangelog.com/en/1.0.0/"
            target="_blank"
            rel="noopener noreferrer">Keep a Changelog</a
          >. Generated from <code>CHANGELOG.md</code>.
        </p>

        {#each releaseNotes as entry (entry.version)}
          <hr />
          <section>
            <h4>{label(entry)}</h4>
            {#each entry.sections as section (section.heading)}
              <h5>{section.heading}</h5>
              <ul>
                {#each section.items as item}
                  <li>{item}</li>
                {/each}
              </ul>
            {/each}
          </section>
        {/each}
      </div>
    </div>
  </div>
</Modal>

<style>
  .modal-content {
    background-color: var(--background-color);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    width: 100%;
    max-width: 700px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-color);
    cursor: pointer;
    padding: 6px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s ease;
  }

  .close-btn:hover {
    background-color: var(--hover-color);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .release-notes {
    font-size: 14px;
    color: var(--text-color);
    line-height: 1.6;
  }

  .release-notes h3 {
    font-size: 14px;
    font-weight: 400;
    color: var(--text-muted);
    margin: 0 0 8px 0;
  }

  .release-notes p {
    margin: 0 0 8px 0;
    color: var(--text-muted);
  }

  .release-notes a {
    color: #3ea6ff;
    text-decoration: none;
  }

  .release-notes a:hover {
    text-decoration: underline;
  }

  .release-notes hr {
    border: none;
    border-top: 1px solid var(--border-color);
    margin: 20px 0;
  }

  .release-notes section {
    margin-bottom: 8px;
  }

  .release-notes h4 {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 12px 0;
  }

  .release-notes h5 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-color);
    margin: 12px 0 8px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .release-notes ul {
    margin: 0;
    padding-left: 20px;
    list-style-type: disc;
  }

  .release-notes li {
    margin-bottom: 6px;
  }

  .release-notes code {
    background-color: var(--hover-color);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
  }

  @media (max-width: 600px) {
    .modal-content {
      width: 100%;
      height: 100%;
      max-height: 100%;
      border-radius: 0;
    }

    .release-notes {
      font-size: 13px;
    }
  }
</style>
