<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import EmptyState from '#lib/ui/EmptyState.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import StatusChip from '#lib/ui/StatusChip.svelte';
  import { formatGap, formatTime, laneColour, type Lane } from '#lib/ui/format';
  import { OUTCOME_LABELS, seconds, startLabel } from '#lib/results';
  import { buildGrid, latestByLane, sinceLabel, type TracksideData } from '#lib/trackside';
  let { data } = $props();

  // svelte-ignore state_referenced_locally
  let snapshot: TracksideData = $state(data.initial);
  let status: 'live' | 'paused' | 'stale' | 'ended' = $state('live');
  let message = $state('');
  let updatedAt: Date | null = $state(null);
  // Server minus browser clock, so rest timers don't depend on the tablet's clock being right.
  // svelte-ignore state_referenced_locally
  let skew = $state(Date.parse(data.initial.now) - Date.now());
  let nowMs = $state(Date.now());
  let announcement = $state('');
  // svelte-ignore state_referenced_locally
  let known = new Set(data.initial.efforts.map((e) => e.id));
  let fresh: Set<string> = $state(new Set());

  const rows = $derived(buildGrid(snapshot));
  const lanes = $derived(latestByLane(rows, snapshot.session.lane_count));
  const columns = $derived(Math.max(1, ...rows.map((r) => r.cells.length)));
  const anyDemo = $derived(snapshot.efforts.some((e) => e.is_test));
  const sessionUrl = $derived(`/sessions/${snapshot.session.id}`);
  const short: Record<string, string> = { dnf: 'DNF', cancelled: 'CXL', invalid: 'INV' };
  const time = (ms: number | null) => `${formatTime(seconds(ms))}`;

  $effect(() => {
    const tick = setInterval(() => (nowMs = Date.now() + skew), 1000);
    return () => clearInterval(tick);
  });

  $effect(() => {
    const id = snapshot.session.id;
    let stopped = false;
    let polling = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    async function poll() {
      if (stopped || polling || document.hidden || status === 'ended') return;
      polling = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10000);
      try {
        const response = await fetch(`/sessions/${id}/trackside/data`, {
          signal: controller.signal,
          cache: 'no-store'
        });
        const body = await response.json().catch(() => ({}));
        if (stopped) return;
        if (!response.ok) {
          if ([401, 404].includes(response.status)) status = 'ended';
          throw new Error(body.message ?? 'Couldn’t refresh.');
        }
        const next = body as TracksideData;
        if (next.session?.id !== id) throw new Error('Unexpected reply.');
        const arrived = next.efforts.filter((e) => !known.has(e.id));
        for (const e of arrived) known.add(e.id);
        if (arrived.length) {
          fresh = new Set(arrived.map((e) => e.id));
          setTimeout(() => (fresh = new Set()), 6000);
        }
        snapshot = next;
        skew = Date.parse(next.now) - Date.now();
        updatedAt = new Date();
        status = 'live';
        message = '';
        if (arrived.length) {
          const grid = buildGrid(next);
          const parts = arrived.map((e) => {
            const cell = grid.flatMap((r) => r.cells).find((c) => c.id === e.id);
            const result =
              e.outcome === 'completed'
                ? `${time(e.elapsed_ms)} seconds`
                : OUTCOME_LABELS[e.outcome];
            return `${e.rider_name}, lane ${e.lane}, ${result}${cell?.newBest ? ', new best' : ''}${e.is_test ? ', demo' : ''}`;
          });
          announcement = parts.join('. ');
        }
      } catch (e) {
        if (stopped) return;
        if (status !== 'ended') status = 'stale';
        message =
          (e as Error).name === 'AbortError'
            ? 'Refresh timed out. What you see may be out of date.'
            : (e as Error).message;
      } finally {
        clearTimeout(timeout);
        polling = false;
        if (!stopped && status !== 'ended' && !document.hidden) timer = setTimeout(poll, 2000);
      }
    }
    function visibility() {
      clearTimeout(timer);
      if (document.hidden) {
        if (status === 'live') status = 'paused';
      } else void poll();
    }
    updatedAt = new Date();
    timer = setTimeout(poll, 2000);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', visibility);
    };
  });

  const clock = (d: Date | null) =>
    d
      ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '';
</script>

<svelte:head><title>Trackside · {snapshot.session.name} · JNS SPLIT</title></svelte:head>

<PageHeader
  eyebrow="Trackside"
  title={snapshot.session.name}
  description={`${Number(snapshot.session.distance_metres)} m ${startLabel(snapshot.session.start_mode).toLowerCase()} · ${snapshot.session.lane_count} ${snapshot.session.lane_count === 1 ? 'lane' : 'lanes'}`}
>
  {#snippet actions()}
    <span class="status" role="status">
      {#if status === 'live'}
        <StatusChip tone="success">Live</StatusChip>
        <span class="note">Updated {clock(updatedAt)}</span>
      {:else if status === 'paused'}
        <StatusChip>Paused</StatusChip>
        <span class="note">Resumes when this tab is shown</span>
      {:else if status === 'stale'}
        <StatusChip tone="warn">Out of date</StatusChip>
        <span class="note">Last updated {clock(updatedAt)}</span>
      {:else}
        <StatusChip tone="danger">Stopped</StatusChip>
      {/if}
    </span>
    <Button href={sessionUrl}>Back to session</Button>
  {/snippet}
</PageHeader>

{#if message}<p class="feedback" class:error={status !== 'live'}>{message}</p>{/if}
{#if snapshot.session.status !== 'planned'}
  <p class="notice">This session is {snapshot.session.status}. It takes no more results.</p>
{/if}
<p class="sr-only" aria-live="polite">{announcement}</p>

<section class="lanes" aria-label="Latest effort in each lane">
  {#each lanes as { lane, latest } (lane)}
    {@const cell = latest}
    <article
      class="lane"
      class:fresh={cell && fresh.has(cell.id)}
      style:--lane={laneColour(lane as Lane)}
    >
      <header><span class="lane-no">Lane {lane}</span></header>
      {#if cell}
        <span class="rider">{cell.rider_name}</span>
        <span class="big" class:best={cell.newBest}>
          {cell.outcome === 'completed' ? time(cell.elapsed_ms) : OUTCOME_LABELS[cell.outcome]}
        </span>
        <span class="tags">
          {#if cell.newBest}<StatusChip tone="success">New best</StatusChip>{/if}
          {#if cell.is_test}<StatusChip tone="warn">Demo</StatusChip>{/if}
          <span class="note">{sinceLabel(cell.recorded_at, nowMs)} ago</span>
        </span>
      {:else}
        <span class="waiting">Waiting for the first effort</span>
      {/if}
    </article>
  {/each}
</section>

<Card title="Squad">
  {#if !rows.length}
    <EmptyState title="No efforts yet">
      Times appear here within a couple of seconds of the timing equipment saving them.
    </EmptyState>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col" class="sticky">Rider</th>
            {#each Array(columns) as _, i (i)}<th scope="col" class="num">{i + 1}</th>{/each}
            <th scope="col" class="num">Best today</th>
            <th scope="col" class="num">Previous</th>
            <th scope="col" class="num">Gap</th>
            <th scope="col" class="num">Rest</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.rider_id)}
            <tr>
              <th scope="row" class="sticky">{row.name}</th>
              {#each Array(columns) as _, i (i)}
                {@const c = row.cells[i]}
                <td
                  class="num cell"
                  class:best={c?.newBest}
                  class:demo={c?.is_test}
                  class:fresh={c && fresh.has(c.id)}
                  title={c
                    ? `Lane ${c.lane}${c.newBest ? ' · new best' : ''}${c.is_test ? ' · demo' : ''}`
                    : undefined}
                >
                  {#if c}
                    {c.outcome === 'completed'
                      ? time(c.elapsed_ms)
                      : short[c.outcome]}{#if c.newBest}<span class="sr-only">
                        new best
                      </span>{/if}{#if c.is_test}<span class="sr-only"> demo</span>{/if}
                  {/if}
                </td>
              {/each}
              <td class="num strong">{row.bestToday !== null ? time(row.bestToday) : '—'}</td>
              <td class="num">{row.previousBest !== null ? time(row.previousBest) : '—'}</td>
              <td
                class="num"
                class:faster={row.bestToday !== null &&
                  row.previousBest !== null &&
                  row.bestToday < row.previousBest}
              >
                {formatGap(seconds(row.bestToday), seconds(row.previousBest)) || '—'}
              </td>
              <td class="num">{sinceLabel(row.lastAt, nowMs)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <ul class="legend">
      <li><span class="key best">1.390</span> New best</li>
      {#if anyDemo}<li>
          <span class="key demo">0.999</span> Demo — simulated data, never a best
        </li>{/if}
      <li>DNF did not finish · CXL cancelled · INV invalid</li>
    </ul>
    <p class="note">
      Times in seconds, never rounded up. <strong>Previous</strong> is the rider’s best Live time at
      this distance and start type before today, from sessions you can open.
      <strong>Rest</strong> is time since their last effort.
    </p>
  {/if}
</Card>

<style>
  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-right: 0.5rem;
  }
  .note {
    font-size: 0.8125rem;
    color: var(--muted);
  }
  .lanes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
    margin: 1rem 0;
  }
  .lane {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 1rem 1.25rem 1.25rem;
    background: var(--surface);
    border: 1px solid var(--edge);
    border-top: 6px solid var(--lane);
    border-radius: var(--radius-lg);
    min-height: 168px;
    transition: box-shadow 0.4s;
  }
  .lane.fresh {
    box-shadow: 0 0 0 3px var(--accent-edge);
  }
  .lane-no {
    font: 700 1rem var(--font-display);
    text-transform: uppercase;
    color: var(--muted);
    letter-spacing: 0.06em;
  }
  .rider {
    font: 700 1.5rem/1.1 var(--font-display);
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }
  .big {
    font: italic 800 3.25rem/1 var(--font-display);
    font-variant-numeric: tabular-nums;
  }
  .big.best {
    color: var(--accent-text);
  }
  .tags {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .waiting {
    margin-top: auto;
    color: var(--muted);
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 1rem;
  }
  th,
  td {
    padding: 0.55rem 0.6rem;
    border-bottom: 1px solid var(--edge);
    white-space: nowrap;
    text-align: left;
  }
  thead th {
    font-size: 0.8125rem;
    color: var(--muted);
    font-weight: 600;
  }
  .sticky {
    position: sticky;
    left: 0;
    background: var(--surface);
    z-index: 1;
  }
  tbody th {
    font-weight: 600;
    font-size: 1rem;
    color: var(--text);
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .strong {
    font-weight: 700;
  }
  .cell.best,
  .key.best {
    background: var(--accent-soft);
    color: var(--accent-text);
    font-weight: 700;
  }
  .cell.demo,
  .key.demo {
    color: var(--muted);
    font-style: italic;
  }
  .cell.fresh {
    outline: 2px solid var(--accent-edge);
    outline-offset: -2px;
  }
  .faster {
    color: var(--accent-text);
    font-weight: 700;
  }
  .legend {
    list-style: none;
    margin: 0.9rem 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.25rem;
    font-size: 0.8125rem;
    color: var(--muted);
  }
  .key {
    display: inline-block;
    padding: 0 0.35rem;
    border-radius: 4px;
    font-variant-numeric: tabular-nums;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @media (prefers-reduced-motion: reduce) {
    .lane {
      transition: none;
    }
  }
</style>
