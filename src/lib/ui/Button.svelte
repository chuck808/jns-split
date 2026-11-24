<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

  type Common = {
    variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
    size?: 'md' | 'lg';
    full?: boolean;
    children: Snippet;
  };
  type Props = Common &
    ((HTMLAnchorAttributes & { href: string }) | (HTMLButtonAttributes & { href?: undefined }));

  let { variant = 'secondary', size = 'md', full = false, children, ...rest }: Props = $props();
</script>

{#if rest.href !== undefined}
  <a
    {...rest as HTMLAnchorAttributes}
    class={['ui-button', variant, size, full && 'full', rest.class]}
  >
    {@render children()}
  </a>
{:else}
  <button
    type="button"
    {...rest as HTMLButtonAttributes}
    class={['ui-button', variant, size, full && 'full', rest.class]}
  >
    {@render children()}
  </button>
{/if}

<style>
  .ui-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: var(--touch);
    padding: 0 1.1rem;
    border-radius: 10px;
    border: 1px solid var(--edge-strong);
    background: var(--raised);
    color: var(--text);
    font: 600 0.9375rem/1.2 var(--font-body);
    text-decoration: none;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }
  .ui-button:hover:not(:disabled) {
    background: var(--edge);
    color: var(--text);
  }
  .ui-button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .lg {
    min-height: 52px;
    padding: 0 1.4rem;
    font-size: 1rem;
  }
  .full {
    width: 100%;
  }
  .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .primary:hover:not(:disabled) {
    background: var(--accent-hover);
    color: var(--on-accent);
  }
  .quiet {
    background: transparent;
    border-color: transparent;
    color: var(--muted);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .quiet:hover:not(:disabled) {
    background: transparent;
    color: var(--text);
  }
  .danger {
    background: var(--danger-soft);
    border-color: var(--danger-edge);
    color: var(--danger-text);
  }
  .danger:hover:not(:disabled) {
    background: var(--danger-soft);
    color: var(--danger-text);
    filter: brightness(1.1);
  }
</style>
