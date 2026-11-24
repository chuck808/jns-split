<script lang="ts">
  import Card from '#lib/ui/Card.svelte';
  import EmptyState from '#lib/ui/EmptyState.svelte';
  import LaneBadge from '#lib/ui/LaneBadge.svelte';
  import StatusChip from '#lib/ui/StatusChip.svelte';
  import { formatTime, type Lane } from '#lib/ui/format';
  import {
    OUTCOME_LABELS,
    averageSpeed,
    seconds,
    sessionBests,
    type SessionEffort
  } from '#lib/results';
  let { efforts, distance }: { efforts: SessionEffort[] | null; distance: number } = $props();
  const bests = $derived(efforts ? sessionBests(efforts) : []);
  const anyDemo = $derived(!!efforts?.some((e) => e.is_test));
  const newest = $derived(efforts ? [...efforts].reverse() : []);
  const clock = (value: string) =>
    new Date(value).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
</script>

<Card title="Results">
  {#if efforts === null}
    <EmptyState title="Results aren’t set up yet">
      Apply the recorded results migration (013) to see results here.
    </EmptyState>
  {:else if !efforts.length}
    <EmptyState title="No results yet">
      Results appear here as timing equipment saves them.
    </EmptyState>
  {:else}
    {#if anyDemo}
      <p class="demo-note">
        <StatusChip tone="warn">Demo — simulated data</StatusChip>
        Rows marked demo came from a Test controller. Riders and families never see them, and they don’t
        count as bests.
      </p>
    {/if}

    {#if bests.length}
      <h3>Best in this session</h3>
      <ol class="bests">
        {#each bests as b, i (b.rider_id)}
          <li>
            <span class="place">{i + 1}</span>
            <span class="name">{b.rider_name}</span>
            <span class="note">{b.count} {b.count === 1 ? 'effort' : 'efforts'}</span>
            <span class="time">{formatTime(seconds(b.best_ms))}s</span>
          </li>
        {/each}
      </ol>
    {/if}

    <h3>Every effort, newest first</h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col" class="wide">Saved</th>
            <th scope="col">Lane</th>
            <th scope="col">Rider</th>
            <th scope="col" class="num">Time</th>
            <th scope="col" class="num wide">Avg km/h</th>
          </tr>
        </thead>
        <tbody>
          {#each newest as e (e.id)}
            <tr class:demo={e.is_test}>
              <td class="wide">{clock(e.recorded_at)}</td>
              <td><LaneBadge lane={e.lane as Lane} size="sm" /></td>
              <td>
                {e.rider_name}
                {#if e.is_test}<StatusChip tone="warn">Demo</StatusChip>{/if}
              </td>
              <td class="num">
                {e.outcome === 'completed'
                  ? `${formatTime(seconds(e.elapsed_ms))}s`
                  : OUTCOME_LABELS[e.outcome]}
              </td>
              <td class="num wide">
                {e.outcome === 'completed' ? averageSpeed(distance, e.elapsed_ms) : '—'}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="note">
      Times are as measured by the timing equipment and shown to the thousandth, never rounded up.
      Average speed is over the whole distance, not a top speed.
    </p>
  {/if}
</Card>

<style>
  h3 {
    margin: 1rem 0 0.5rem;
    font-size: 1rem;
  }
  .demo-note {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    flex-wrap: wrap;
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted);
  }
  .bests {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .bests li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: var(--raised);
    border-radius: var(--radius);
  }
  .place {
    font: 700 1.25rem var(--font-display);
    width: 1.5rem;
    color: var(--muted);
  }
  .name {
    flex: 1;
    font-weight: 600;
  }
  .time {
    font: italic 700 1.5rem var(--font-display);
    font-variant-numeric: tabular-nums;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9375rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.5rem 0.6rem;
    border-bottom: 1px solid var(--edge);
    white-space: nowrap;
  }
  th {
    font-size: 0.8125rem;
    color: var(--muted);
    font-weight: 600;
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  @media (max-width: 560px) {
    .wide {
      display: none;
    }
    td {
      white-space: normal;
    }
  }
  tr.demo td {
    color: var(--muted);
  }
  .note {
    margin: 0.75rem 0 0;
    font-size: 0.8125rem;
    color: var(--muted);
  }
</style>
