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

  // Coach notes: one shared note per effort, for the session's coaches and club admins.
  let noteFor: string | null = $state(null);
  let noteText = $state('');
  let noteSaving = $state(false);
  let noteMessage = $state('');
  const noteCell = $derived(
    noteFor ? (rows.flatMap((r) => r.cells).find((c) => c.id === noteFor) ?? null) : null
  );
  const notes = $derived(
    rows
      .flatMap((r) => r.cells.map((c, i) => ({ ...c, n: i + 1, name: r.name })))
      .filter((c) => c.note)
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
  );
  function openNote(id: string, existing: string | null | undefined) {
    noteFor = id;
    noteText = existing ?? '';
    noteMessage = '';
    queueMicrotask(() => document.getElementById('note-text')?.focus());
  }
  async function saveNote(clear = false) {
    if (!noteFor) return;
    noteSaving = true;
    noteMessage = '';
    try {
      const response = await fetch(`/sessions/${snapshot.session.id}/trackside/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ effortId: noteFor, note: clear ? '' : noteText })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? 'The note couldn’t be saved.');
      const id = noteFor;
      snapshot = {
        ...snapshot,
        efforts: snapshot.efforts.map((e) => (e.id === id ? { ...e, note: body.note } : e))
      };
      noteFor = null;
    } catch (e) {
      noteMessage = (e as Error).message;
    } finally {
      noteSaving = false;
    }
  }

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
    {#if noteCell}
      <form
        class="note-editor"
        onsubmit={(e) => {
          e.preventDefault();
          void saveNote();
        }}
      >
        <label for="note-text">
          Note for <strong>{rows.find((r) => r.cells.some((c) => c.id === noteFor))?.name}</strong>,
          {noteCell.outcome === 'completed'
            ? `${time(noteCell.elapsed_ms)}s`
            : OUTCOME_LABELS[noteCell.outcome]}
          in lane {noteCell.lane}
        </label>
        <textarea
          id="note-text"
          bind:value={noteText}
          maxlength="280"
          rows="2"
          placeholder="e.g. Late off the gate"></textarea>
        <div class="note-actions">
          <span class="note">
            {280 - noteText.length} left · seen by this session’s coaches and club admins only
          </span>
          <span class="note-buttons">
            {#if noteCell.note}<Button
                type="button"
                variant="quiet"
                disabled={noteSaving}
                onclick={() => saveNote(true)}
              >
                Clear note
              </Button>{/if}
            <Button type="button" variant="quiet" onclick={() => (noteFor = null)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={noteSaving}>Save note</Button>
          </span>
        </div>
        {#if noteMessage}<p class="feedback error" role="alert">{noteMessage}</p>{/if}
      </form>
    {/if}
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
                  class:selected={c && noteFor === c.id}
                >
                  {#if c}
                    <button
                      type="button"
                      class="cell-button"
                      onclick={() => openNote(c.id, c.note)}
                      title={`Lane ${c.lane}${c.newBest ? ' · new best' : ''}${c.is_test ? ' · demo' : ''}${c.note ? ` · note: ${c.note}` : ' · add a note'}`}
                      aria-label={`${row.name}, effort ${i + 1}, ${c.outcome === 'completed' ? time(c.elapsed_ms) + ' seconds' : OUTCOME_LABELS[c.outcome]}${c.newBest ? ', new best' : ''}${c.is_test ? ', demo' : ''}${c.note ? ', has a note. Edit note' : '. Add a note'}`}
                    >
                      {c.outcome === 'completed' ? time(c.elapsed_ms) : short[c.outcome]}
                      {#if c.note}<span class="note-dot" aria-hidden="true"></span>{/if}
                    </button>
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
    {#if snapshot.total > snapshot.efforts.length}
      <p class="note">
        Showing the latest {snapshot.efforts.length} of {snapshot.total} efforts. Best today, gaps and
        new-best marks cover the whole session.
      </p>
    {/if}
    <ul class="legend">
      <li><span class="key best">1.390</span> New best</li>
      {#if anyDemo}<li>
          <span class="key demo">0.999</span> Demo — simulated data, never a best
        </li>{/if}
      <li>DNF did not finish · CXL cancelled · INV invalid</li>
    </ul>
    {#if notes.length}
      <h3 class="notes-heading">Notes</h3>
      <ul class="notes-list">
        {#each notes as n (n.id)}
          <li>
            <button type="button" class="link-button" onclick={() => openNote(n.id, n.note)}>
              {n.name} · effort {n.n} ·
              {n.outcome === 'completed' ? `${time(n.elapsed_ms)}s` : OUTCOME_LABELS[n.outcome]}
            </button>
            <span>{n.note}</span>
          </li>
        {/each}
      </ul>
    {/if}
    <p class="note">
      Tap a time to add a note. Times in seconds, never rounded up. <strong>Previous</strong> is the
      rider’s best Live time at this distance and start type before today, from sessions you can
      open.
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
  .cell {
    padding: 0;
  }
  .cell-button {
    position: relative;
    width: 100%;
    min-height: var(--touch);
    padding: 0.55rem 0.6rem;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-style: inherit;
    font-weight: inherit;
    text-align: right;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }
  .cell-button:hover {
    background: var(--raised);
  }
  .cell-button:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: -3px;
  }
  .cell.selected {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  .note-dot {
    position: absolute;
    top: 6px;
    right: 4px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--info-text);
  }
  .note-editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0 0 1rem;
    padding: 0.9rem;
    border-radius: var(--radius);
    background: var(--raised);
  }
  .note-editor label {
    margin: 0;
  }
  .note-editor textarea {
    width: 100%;
  }
  .note-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .note-buttons {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .notes-heading {
    margin: 1rem 0 0.4rem;
    font-size: 1rem;
  }
  .notes-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .notes-list li {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .link-button {
    align-self: flex-start;
    padding: 0;
    border: 0;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: 0.8125rem;
    text-decoration: underline;
    cursor: pointer;
    min-height: auto;
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
