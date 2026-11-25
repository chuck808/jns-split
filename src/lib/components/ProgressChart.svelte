<script lang="ts">
  import { formatTime } from '#lib/ui/format';
  import { seconds, timeTicks, type ProgressPoint } from '#lib/results';

  /** One distance and start type: each point is a session's best. Faster is drawn higher. */
  let { points, label }: { points: ProgressPoint[]; label: string } = $props();
  const id = $props.id();

  let width = $state(640);
  const height = 220;
  const m = { top: 18, right: 78, bottom: 30, left: 52 };
  let active: number | null = $state(null);

  const sorted = $derived([...points].sort((a, b) => a.day.localeCompare(b.day)));
  const times = $derived(sorted.map((p) => Date.parse(p.day)));
  const ticks = $derived(
    timeTicks(Math.min(...sorted.map((p) => p.best_ms)), Math.max(...sorted.map((p) => p.best_ms)))
  );
  const plotW = $derived(Math.max(120, width - m.left - m.right));
  const plotH = height - m.top - m.bottom;
  const x = (t: number) => {
    const [a, b] = [times[0], times[times.length - 1]];
    return m.left + (b === a ? plotW / 2 : ((t - a) / (b - a)) * plotW);
  };
  const y = (ms: number) => {
    const [lo, hi] = [ticks[0], ticks[ticks.length - 1]];
    return m.top + ((ms - lo) / (hi - lo || 1)) * plotH;
  };
  const xy = $derived(sorted.map((p, i) => ({ p, cx: x(times[i]), cy: y(p.best_ms) })));
  const path = $derived(
    xy.map((d, i) => `${i ? 'L' : 'M'}${d.cx.toFixed(1)},${d.cy.toFixed(1)}`).join('')
  );
  const bestIndex = $derived(
    sorted.reduce((best, p, i) => (p.best_ms < sorted[best].best_ms ? i : best), 0)
  );
  const lastIndex = $derived(sorted.length - 1);
  const day = (iso: string, withYear = false) =>
    new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
      timeZone: 'Europe/London'
    });
  const xTicks = $derived(
    sorted.length <= 3 ? sorted.map((_, i) => i) : [0, Math.floor(lastIndex / 2), lastIndex]
  );
  const summary = $derived(
    sorted.length
      ? `${label}: ${sorted.length} sessions from ${day(sorted[0].day, true)} to ${day(sorted[lastIndex].day, true)}. Best ${formatTime(seconds(sorted[bestIndex].best_ms))} seconds on ${day(sorted[bestIndex].day, true)}; latest ${formatTime(seconds(sorted[lastIndex].best_ms))} seconds.`
      : ''
  );

  const pointText = (i: number) => {
    const p = sorted[i];
    return p
      ? `Session ${i + 1} of ${sorted.length}: ${formatTime(seconds(p.best_ms))} seconds, ${p.session_name}, ${day(p.day, true)}${i === bestIndex ? ', best' : ''}`
      : '';
  };
  function pointer(event: PointerEvent) {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const px = event.clientX - box.left;
    let nearest = 0;
    for (let i = 1; i < xy.length; i++)
      if (Math.abs(xy[i].cx - px) < Math.abs(xy[nearest].cx - px)) nearest = i;
    active = nearest;
  }
  function keys(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Escape') active = null;
    else if (event.key === 'Home') active = 0;
    else if (event.key === 'End') active = lastIndex;
    else
      active = Math.min(
        lastIndex,
        Math.max(
          0,
          (active ?? (event.key === 'ArrowLeft' ? lastIndex + 1 : -1)) +
            (event.key === 'ArrowLeft' ? -1 : 1)
        )
      );
  }
</script>

<figure class="chart" aria-labelledby={`${id}-title`}>
  <figcaption id={`${id}-title`}>
    <strong>{label}</strong>
    <span class="note">Each point is a session’s best time. Higher is faster.</span>
  </figcaption>

  {#if sorted.length < 2}
    <p class="single">
      One session so far: <strong>{formatTime(seconds(sorted[0]?.best_ms ?? null))}s</strong>
      on {sorted[0] ? day(sorted[0].day, true) : ''}. The chart appears after the next session at
      this distance and start type.
    </p>
  {:else}
    <div
      class="plot"
      bind:clientWidth={width}
      role="slider"
      tabindex="0"
      aria-label={`${label}, session bests`}
      aria-valuemin={1}
      aria-valuemax={sorted.length}
      aria-valuenow={(active ?? lastIndex) + 1}
      aria-valuetext={pointText(active ?? lastIndex)}
      aria-describedby={`${id}-summary`}
      onpointermove={pointer}
      onpointerleave={() => (active = null)}
      onkeydown={keys}
      onblur={() => (active = null)}
    >
      <p class="sr-only" id={`${id}-summary`}>
        {summary} Use the left and right arrow keys to read each session.
      </p>
      <svg {width} {height} aria-hidden="true">
        {#each ticks as t (t)}
          <line class="grid" x1={m.left} x2={m.left + plotW} y1={y(t)} y2={y(t)} />
          <text class="axis" x={m.left - 8} y={y(t)} text-anchor="end" dominant-baseline="middle">
            {formatTime(seconds(t))}
          </text>
        {/each}
        {#each xTicks as i (i)}
          <text
            class="axis"
            x={xy[i].cx}
            y={height - 8}
            text-anchor={i === 0 ? 'start' : i === lastIndex ? 'end' : 'middle'}
          >
            {day(sorted[i].day)}
          </text>
        {/each}

        {#if active !== null}
          <line
            class="crosshair"
            x1={xy[active].cx}
            x2={xy[active].cx}
            y1={m.top}
            y2={m.top + plotH}
          />
        {/if}

        <path class="line" d={path} />
        {#each xy as d, i (d.p.session_id)}
          <circle
            class="dot"
            class:on={active === i}
            cx={d.cx}
            cy={d.cy}
            r={active === i ? 6 : 4}
          />
        {/each}

        <!-- Selective direct labels: the best, and the latest when it isn't crowded by the best. -->
        <!-- The best is the highest point, so the space above it is always clear. -->
        <text
          class="label"
          x={Math.min(Math.max(xy[bestIndex].cx, m.left + 30), m.left + plotW + 20)}
          y={xy[bestIndex].cy - 11}
          text-anchor="middle"
        >
          Best {formatTime(seconds(sorted[bestIndex].best_ms))}
        </text>
        {#if lastIndex !== bestIndex && xy[lastIndex].cx - xy[bestIndex].cx > 80}
          <text
            class="label"
            x={xy[lastIndex].cx + 9}
            y={xy[lastIndex].cy}
            dominant-baseline="middle"
          >
            {formatTime(seconds(sorted[lastIndex].best_ms))}
          </text>
        {/if}
      </svg>

      {#if active !== null}
        {@const d = xy[active]}
        <div
          class="tip"
          style:left={`${Math.min(Math.max(d.cx, 90), width - 90)}px`}
          style:top={`${Math.max(d.cy - 12, 0)}px`}
        >
          <strong>{formatTime(seconds(d.p.best_ms))}s</strong>
          <span>{d.p.session_name}</span>
          <span class="note">
            {day(d.p.day, true)} · {d.p.count}
            {d.p.count === 1 ? 'effort' : 'efforts'}
          </span>
        </div>
      {/if}
    </div>
  {/if}

  <details class="as-table">
    <summary>Show as a table</summary>
    <table>
      <caption class="sr-only">{label}: each session’s best time</caption>
      <thead>
        <tr>
          <th scope="col">Date</th><th scope="col">Session</th><th scope="col" class="num">
            Efforts
          </th><th scope="col" class="num">Best</th>
        </tr>
      </thead>
      <tbody>
        {#each [...sorted].reverse() as p (p.session_id)}
          <tr>
            <td>{day(p.day, true)}</td>
            <td>{p.session_name}</td>
            <td class="num">{p.count}</td>
            <td class="num">{formatTime(seconds(p.best_ms))}s</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </details>
</figure>

<style>
  .chart {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  figcaption {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .note {
    font-size: 0.8125rem;
    color: var(--muted);
  }
  .single {
    margin: 0;
    color: var(--muted);
  }
  .single strong {
    color: var(--text);
  }
  .plot {
    position: relative;
    width: 100%;
  }
  svg {
    display: block;
    overflow: visible;
    touch-action: pan-y;
  }
  .plot:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 4px;
    border-radius: 4px;
  }
  .grid {
    stroke: var(--edge);
    stroke-width: 1;
  }
  .axis {
    fill: var(--muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .crosshair {
    stroke: var(--edge-strong);
    stroke-width: 1;
  }
  .line {
    fill: none;
    stroke: var(--series-1);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .dot {
    fill: var(--series-1);
    stroke: var(--surface);
    stroke-width: 2;
  }
  .label {
    fill: var(--text);
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .tip {
    position: absolute;
    transform: translate(-50%, -100%);
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.5rem 0.7rem;
    background: var(--raised);
    border: 1px solid var(--edge);
    border-radius: var(--radius);
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.18);
    pointer-events: none;
    white-space: nowrap;
    font-size: 0.875rem;
  }
  .as-table {
    margin: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9375rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.45rem 0.6rem;
    border-bottom: 1px solid var(--edge);
  }
  th {
    font-size: 0.8125rem;
    color: var(--muted);
  }
  .num {
    text-align: right;
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
</style>
