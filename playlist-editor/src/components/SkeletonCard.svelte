<div class="skeleton-card">
  <div class="skeleton-thumbnail shimmer"></div>
  <div class="skeleton-details">
    <div class="skeleton-line title shimmer"></div>
    <div class="skeleton-actions">
      <div class="skeleton-btn shimmer"></div>
      <div class="skeleton-btn shimmer"></div>
    </div>
  </div>
</div>

<style>
  .skeleton-card {
    flex: 1 1 250px;
    max-width: 320px;
    border-radius: 12px;
    overflow: hidden;
    background: var(--background-color);
    border: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    align-self: flex-start;
  }

  .skeleton-thumbnail {
    aspect-ratio: 16 / 9;
    background: var(--hover-color);
    width: 100%;
  }

  .skeleton-details {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .skeleton-line {
    height: 14px;
    background: var(--hover-color);
    border-radius: 4px;
  }

  .skeleton-line.title {
    width: 80%;
    height: 18px;
    margin-bottom: 4px;
  }

  .skeleton-actions {
    display: flex;
    gap: 8px;
  }

  .skeleton-btn {
    flex: 1;
    height: 34px;
    border-radius: 18px;
    background: var(--hover-color);
  }

  .shimmer {
    position: relative;
    overflow: hidden;
  }

  .shimmer::after {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    transform: translateX(-100%);
    background-image: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0,
      rgba(255, 255, 255, 0.05) 20%,
      rgba(255, 255, 255, 0.1) 60%,
      rgba(255, 255, 255, 0)
    );
    animation: shimmer 2s infinite;
    content: "";
  }

  :global([data-theme="light"]) .shimmer::after {
    background-image: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0,
      rgba(0, 0, 0, 0.02) 20%,
      rgba(0, 0, 0, 0.05) 60%,
      rgba(255, 255, 255, 0)
    );
  }

  @keyframes shimmer {
    100% {
      transform: translateX(100%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .shimmer::after {
      animation: none;
    }
  }
</style>
