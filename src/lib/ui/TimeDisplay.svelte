<script lang="ts">
  import { formatTime } from './format';
  /**
   * The time is the hero: condensed italic numerals with tabular figures so
   * digits don't jump between updates. `best` marks a new personal best in
   * text as well as colour.
   */
  let {
    seconds,
    size = 'md',
    best = false,
    unit = true,
    decimals = 3
  }: {
    seconds: number | null | undefined;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    best?: boolean;
    unit?: boolean;
    decimals?: number;
  } = $props();

  const text = $derived(formatTime(seconds, decimals));
  const missing = $derived(text === '—');
</script>

<span
  class={['ui-time', size, best && 'best', missing && 'missing']}
  aria-label={missing ? 'No time' : `${text} seconds${best ? ', new best' : ''}`}
>
  <span aria-hidden="true">
    {text}{#if unit && !missing}<span class="unit">&nbsp;s</span>{/if}
  </span>
</span>

<style>
  .ui-time {
    font-family: var(--font-display);
    font-style: italic;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 0.95;
    letter-spacing: -0.01em;
    color: var(--text);
    white-space: nowrap;
  }
  .sm {
    font-size: 1.25rem;
    font-style: normal;
    font-weight: 600;
  }
  .md {
    font-size: 2rem;
  }
  .lg {
    font-size: 3.5rem;
  }
  .xl {
    font-size: 5.25rem;
  }
  .unit {
    font-size: 0.4em;
    font-style: normal;
    color: var(--muted);
  }
  .best {
    color: var(--accent-text);
  }
  .missing {
    color: var(--muted);
  }
</style>
