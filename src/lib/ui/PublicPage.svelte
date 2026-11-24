<script lang="ts">
  import type { Snippet } from 'svelte';
  /** Content column for public and signed-out pages (outside the app shell). */
  let { width = 'normal', children }: { width?: 'narrow' | 'normal' | 'wide'; children: Snippet } =
    $props();
</script>

<div class={['ui-public', width]}>{@render children()}</div>

<style>
  .ui-public {
    margin: 0 auto;
    padding: 2.5rem 1.5rem 4rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 880px;
  }
  .narrow {
    max-width: 460px;
    padding-top: 3.5rem;
  }
  .wide {
    max-width: 1180px;
  }
  @media (max-width: 640px) {
    .ui-public {
      padding: 1.5rem 1rem 3rem;
    }
    .narrow {
      padding-top: 2rem;
    }
  }
</style>
