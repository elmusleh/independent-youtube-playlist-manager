<script lang="ts">
  import { onMount } from "svelte";
  import Fa from "svelte-fa";
  import { faArrowUp } from "@fortawesome/free-solid-svg-icons";

  let visible = $state(false);

  onMount(() => {
    let raf = 0;
    const update = () => {
      visible = window.scrollY > 400;
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      cancelAnimationFrame(raf);
    };
  });

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
</script>

<button
  class="back-to-top"
  class:visible
  onclick={scrollToTop}
  aria-label="Scroll to top"
  title="Scroll to top"
>
  <Fa icon={faArrowUp} />
</button>

<style>
  .back-to-top {
    position: fixed;
    right: 24px;
    bottom: 24px;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1px solid var(--border-color);
    background: var(--background-color);
    color: var(--text-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    cursor: pointer;
    z-index: var(--z-tooltip);
    opacity: 0;
    pointer-events: none;
    transform: translateY(12px);
    transition:
      opacity var(--transition-base),
      transform var(--transition-base),
      background-color var(--transition-base),
      box-shadow var(--transition-base);
  }

  .back-to-top.visible {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }

  .back-to-top:hover {
    transform: translateY(-2px);
    background: var(--hover-color);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.16);
  }

  .back-to-top:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  :global([data-theme="dark"]) .back-to-top {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }
</style>
