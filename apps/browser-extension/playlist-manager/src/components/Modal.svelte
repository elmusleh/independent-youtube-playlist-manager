<script lang="ts">
  import { untrack } from "svelte";
  import type { Snippet } from "svelte";
  import { lockPageScroll } from "../utils/modal-scroll";

  let {
    display = $bindable(false),
    children,
    title = "Dialog",
    size = "standard",
    dismissible = true,
    onclose,
  }: {
    display?: boolean;
    children?: Snippet;
    title?: string;
    size?: "small" | "standard" | "wide" | "drawer";
    dismissible?: boolean;
    onclose?: () => void;
  } = $props();

  let dialog: HTMLDialogElement;
  const headingId = $props.id();

  function close() {
    if (!dismissible) return;
    display = false;
    onclose?.();
  }

  $effect(() => {
    if (!display || !dialog) return;
    const node = dialog;
    const previousFocus = document.activeElement as HTMLElement | null;
    node.showModal();
    const unlockScroll = lockPageScroll();
    const heading = node.querySelector<HTMLElement>("h1, h2, h3");
    if (heading) {
      heading.id ||= headingId;
      node.setAttribute("aria-labelledby", heading.id);
    }
    untrack(() => {
      const target =
        node.querySelector<HTMLElement>("[data-initial-focus]") ||
        (!dismissible ? node.querySelector<HTMLElement>(".modal-body") : null);
      target?.focus();
    });
    return () => {
      node.close();
      unlockScroll();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  });

  function containFocus(event: KeyboardEvent) {
    if (event.key !== "Tab") return;
    const controls = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(
      (element) =>
        element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden"
    );
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

<dialog
  bind:this={dialog}
  class:drawer={size === "drawer"}
  class:small={size === "small"}
  class:wide={size === "wide"}
  aria-label={title}
  onkeydown={containFocus}
  oncancel={(event) => {
    event.preventDefault();
    close();
  }}
  onclose={() => {
    if (display && dialog && !dialog.open) close();
  }}
>
  {#if display}
    {#if dismissible}
      <div class="modal-chrome">
        <button type="button" class="modal-close" aria-label="Close dialog" onclick={close}
          >×</button
        >
      </div>
    {/if}
    <div class="modal-body" tabindex="-1">
      {#if children}{@render children()}{/if}
    </div>
  {/if}
</dialog>

<style>
  dialog {
    padding: 0;
    margin: auto;
    width: min(560px, calc(100% - 32px));
    max-width: calc(100% - 24px);
    max-height: calc(100vh - 32px);
    max-height: calc(100dvh - 32px);
    overflow: hidden;
    color: var(--text-color);
    background: var(--background-color, #fff);
    border: 1px solid var(--border-color, #ddd);
    border-radius: 16px;
    box-shadow: 0 12px 48px #0005;
  }
  dialog[open] {
    display: flex;
    flex-direction: column;
  }
  dialog::backdrop {
    background: #0009;
  }
  dialog.small {
    width: min(400px, calc(100% - 32px));
  }
  dialog.wide {
    width: min(800px, calc(100% - 32px));
  }
  .modal-chrome {
    display: flex;
    justify-content: flex-end;
    flex-shrink: 0;
    padding: 4px 8px;
    border-bottom: 1px solid var(--border-color);
  }
  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin: 0;
    padding: 0;
    font-size: 28px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .modal-close:hover {
    background: var(--hover-color);
  }
  .modal-body {
    padding: 24px;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    overflow-wrap: anywhere;
  }
  .modal-body :global(.modal-footer),
  .modal-body :global(.dialog-actions),
  .modal-body :global(.multisort-footer) {
    position: sticky;
    bottom: -24px;
    padding-block: 12px;
    background: var(--background-color);
    flex-wrap: wrap;
    z-index: 1;
  }
  dialog.drawer {
    margin: 0 auto 0 0;
    width: min(320px, calc(100% - 44px));
    height: 100vh;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0 16px 16px 0;
  }
  .drawer .modal-body {
    padding: 0;
  }
  @media (max-width: 600px) {
    .modal-body {
      padding: 16px;
    }
    .modal-body :global(.modal-footer),
    .modal-body :global(.dialog-actions),
    .modal-body :global(.multisort-footer) {
      bottom: -16px;
    }
    dialog.wide {
      height: calc(100dvh - 24px);
    }
  }
  @media (max-height: 480px) {
    dialog {
      max-height: calc(100dvh - 16px);
    }
    .modal-body {
      padding: 12px 16px;
    }
  }
</style>
