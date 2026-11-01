<script lang="ts">
  import { untrack } from "svelte";
  import type { Snippet } from "svelte";
  import { lockPageScroll } from "../utils/modal-scroll";
  import Fa from "svelte-fa";
  import { faXmark } from "@fortawesome/free-solid-svg-icons";

  let {
    display = $bindable(false),
    children,
    footer,
    title = "Dialog",
    size = "standard",
    dismissible = true,
    onclose,
    showHeader = true,
    headerAction,
  }: {
    display?: boolean;
    children?: Snippet;
    footer?: Snippet;
    title?: string;
    size?: "small" | "standard" | "wide" | "drawer";
    dismissible?: boolean;
    onclose?: () => void;
    showHeader?: boolean;
    headerAction?: Snippet;
  } = $props();

  let dialog: HTMLDialogElement;
  const headingId = $props.id();
  let pointerDownOnBackdrop = false;

  function handlePointerDown(event: PointerEvent) {
    pointerDownOnBackdrop = event.target === dialog;
  }

  function handleBackdropClick(event: MouseEvent) {
    if (pointerDownOnBackdrop && event.target === dialog) close();
    pointerDownOnBackdrop = false;
  }

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
  onpointerdown={handlePointerDown}
  onclick={handleBackdropClick}
  oncancel={(event) => {
    event.preventDefault();
    close();
  }}
  onclose={() => {
    if (display && dialog && !dialog.open) close();
  }}
>
  {#if display}
    {#if showHeader}
      <div class="modal-header">
        <h2 class="modal-title">{title}</h2>
        {#if dismissible}
          <button type="button" class="modal-close" aria-label="Close dialog" onclick={close}>
            <Fa icon={faXmark} size="lg" />
          </button>
        {/if}
        {@render headerAction?.()}
      </div>
    {/if}
    <div class="modal-body" tabindex="-1">
      {#if children}{@render children()}{/if}
      {@render footer?.()}
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
  /* Closed dialogs stay mounted, so an unconditional display here would beat the
     browser's dialog:not([open]) rule and leave empty bordered boxes on the page. */
  dialog:not([open]) {
    display: none;
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

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .modal-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color);
    line-height: 1.3;
  }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    margin: 0;
    padding: 0;
    font-size: 24px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;
  }
  .modal-close:hover {
    background: var(--hover-color);
    color: var(--text-color);
  }
  .modal-close:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  .modal-body {
    padding: 20px 24px;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    overflow-wrap: anywhere;
    flex: 1;
  }

  /* Sticky footer support for slotted footers */
  .modal-body :global(.modal-footer),
  .modal-body :global(.dialog-actions),
  .modal-body :global(.multisort-footer) {
    position: sticky;
    bottom: -20px;
    margin: 0 -24px;
    padding: 16px 24px;
    background: var(--background-color);
    border-top: 1px solid var(--border-color);
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
    /* Slide-in animation */
    transform: translateX(-100%);
    transition:
      transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      opacity 0.3s ease,
      display 0.3s allow-discrete,
      overlay 0.3s allow-discrete;
  }
  dialog.drawer[open] {
    transform: translateX(0);
  }
  @starting-style {
    dialog.drawer[open] {
      transform: translateX(-100%);
    }
  }
  dialog.drawer::backdrop {
    background: rgba(0, 0, 0, 0);
    transition: background 0.3s ease;
  }
  dialog.drawer[open]::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }
  @starting-style {
    dialog.drawer[open]::backdrop {
      background: rgba(0, 0, 0, 0);
    }
  }

  /* Fallback for browsers that don't support transition-behavior: allow-discrete */
  @supports not (transition-behavior: allow-discrete) {
    dialog.drawer {
      transform: none;
      transition: none;
    }
    dialog.drawer[open] {
      transform: none;
    }
    dialog.drawer::backdrop {
      background: rgba(0, 0, 0, 0.5);
      transition: none;
    }
  }
  .drawer .modal-body {
    padding: 0;
  }
  .drawer .modal-body :global(.modal-footer),
  .drawer .modal-body :global(.dialog-actions),
  .drawer .modal-body :global(.multisort-footer) {
    bottom: 0;
    margin: 0;
    border-radius: 0 0 16px 0;
  }

  @media (max-width: 600px) {
    .modal-header {
      padding: 12px 16px;
    }
    .modal-title {
      font-size: 16px;
    }
    .modal-body {
      padding: 16px;
    }
    .modal-body :global(.modal-footer),
    .modal-body :global(.dialog-actions),
    .modal-body :global(.multisort-footer) {
      bottom: -16px;
      margin: 0 -16px;
      padding: 12px 16px;
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
