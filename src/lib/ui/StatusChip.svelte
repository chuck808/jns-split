<script lang="ts">
  import type { Snippet } from 'svelte';
  /** Status is always carried by the text; the tone only reinforces it. */
  let {
    tone = 'neutral',
    children
  }: { tone?: 'neutral' | 'info' | 'success' | 'warn' | 'danger'; children: Snippet } = $props();
</script>

<span class={['ui-chip', tone]}>{@render children()}</span>

<style>
  .ui-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.65rem;
    border-radius: 999px;
    font: 600 0.75rem/1.4 var(--font-body);
    white-space: nowrap;
    background: var(--raised);
    color: var(--text);
  }
  .info {
    background: var(--info-soft);
    color: var(--info-text);
  }
  .success {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .warn {
    background: var(--warn-soft);
    color: var(--warn-text);
  }
  .danger {
    background: var(--danger-soft);
    color: var(--danger-text);
  }
</style>
