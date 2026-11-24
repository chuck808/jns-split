<script lang="ts">
  import { laneColour, type Lane } from '../format';
  /** An illustration of the start-hill scoreboard. Always dark, like the real screen. */
  const lanes: { name: string; time: string; best?: boolean }[] = [
    { name: 'Alex M.', time: '1.405' },
    { name: 'Sam K.', time: '1.468', best: true },
    { name: 'Charlie R.', time: '1.531' },
    { name: 'Priya S.', time: '1.495' }
  ];
</script>

<figure class="board">
  <div class="top" aria-hidden="true"><span>Flying 20 m · Heat 1</span><span>Example</span></div>
  <ol aria-label="Example results: Sam K. sets a new best">
    {#each lanes as lane, i (lane.name)}
      <li>
        <span class="lane" style:background={laneColour((i + 1) as Lane)}>{i + 1}</span>
        <span class="name">{lane.name}</span>
        {#if lane.best}<span class="best">New best</span>{/if}
        <span class="time" class:is-best={lane.best}>{lane.time}</span>
      </li>
    {/each}
  </ol>
  <figcaption>Made-up riders and times, for illustration.</figcaption>
</figure>

<style>
  .board {
    margin: 0;
    background: #12181a;
    color: #eef2f3;
    border: 1px solid #222c2f;
    border-radius: 22px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    box-shadow: 0 30px 80px rgb(0 0 0 / 0.35);
  }
  .top {
    display: flex;
    justify-content: space-between;
    padding: 0 0.25rem 0.35rem;
    font: 700 1.125rem var(--font-display);
    text-transform: uppercase;
    color: #a3b1b7;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  li {
    display: flex;
    align-items: center;
    height: 76px;
    background: #0b0f10;
    border-radius: 12px;
    overflow: hidden;
  }
  .lane {
    width: 64px;
    align-self: stretch;
    display: grid;
    place-items: center;
    color: #0b0f10;
    font: 800 2.5rem var(--font-display);
  }
  .name {
    flex: 1;
    min-width: 0;
    padding: 0 1rem;
    font: 700 1.75rem var(--font-display);
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .best {
    margin-right: 0.75rem;
    padding: 0.2rem 0.6rem;
    border-radius: 8px;
    background: #c8ef45;
    color: #0b0f10;
    font: 800 1rem var(--font-display);
    text-transform: uppercase;
    white-space: nowrap;
  }
  .time {
    padding-right: 1.25rem;
    font: italic 800 3.25rem/1 var(--font-display);
    font-variant-numeric: tabular-nums;
  }
  .time.is-best {
    color: #c8ef45;
  }
  figcaption {
    font-size: 0.8125rem;
    color: #a3b1b7;
    padding: 0.25rem 0.25rem 0;
  }
  @media (max-width: 640px) {
    li {
      height: 60px;
    }
    .lane {
      width: 46px;
      font-size: 1.875rem;
    }
    .name {
      font-size: 1.25rem;
      padding: 0 0.6rem;
    }
    .best {
      display: none;
    }
    .time {
      font-size: 2.25rem;
      padding-right: 0.75rem;
    }
  }
</style>
