<script lang="ts">
  import { laneColour, type Lane } from './format';
  let { lane, size = 'md' }: { lane: Lane; size?: 'sm' | 'md' | 'lg' } = $props();
</script>

<span class={['ui-lane', size]} style:background={laneColour(lane)} aria-label={`Lane ${lane}`}>
  {lane}
</span>

<style>
  .ui-lane {
    display: inline-grid;
    place-items: center;
    flex: none;
    color: var(--on-lane);
    font: 700 1.125rem/1 var(--font-display);
    border-radius: var(--radius-sm);
    width: 32px;
    height: 32px;
  }
  .sm {
    width: 24px;
    height: 24px;
    font-size: 0.9375rem;
    border-radius: 6px;
  }
  .lg {
    width: 52px;
    height: 52px;
    font-size: 2rem;
    border-radius: var(--radius);
  }
</style>
