<script lang="ts">
  import { laneColour, type Lane } from '../format';
  /** Numbered steps, each coloured with the next lane colour. */
  let { steps }: { steps: { title: string; text: string }[] } = $props();
</script>

<ol class="steps" style:--count={Math.min(steps.length, 4)}>
  {#each steps as step, i (step.title)}
    <li style:--lane={laneColour(((i % 4) + 1) as Lane)}>
      <span class="n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
      <h3>{step.title}</h3>
      <p>{step.text}</p>
    </li>
  {/each}
</ol>

<style>
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(var(--count), minmax(0, 1fr));
    gap: 1.5rem;
  }
  li {
    background: var(--surface);
    border: 1px solid var(--edge);
    border-top: 6px solid var(--lane);
    border-radius: var(--radius-lg);
    padding: 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .n {
    font: italic 800 4.5rem/1 var(--font-display);
    color: var(--lane);
  }
  h3 {
    margin: 0;
    font: 700 1.875rem/1 var(--font-display);
    text-transform: uppercase;
  }
  p {
    margin: 0;
    font-size: 1.0625rem;
    line-height: 1.55;
    color: var(--muted);
  }
  @media (max-width: 860px) {
    .steps {
      grid-template-columns: minmax(0, 1fr);
    }
    .n {
      font-size: 3.25rem;
    }
  }
</style>
