<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import ChoiceGroup from '#lib/ui/ChoiceGroup.svelte';
  import EmptyState from '#lib/ui/EmptyState.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import StatusChip from '#lib/ui/StatusChip.svelte';
  import { scoreboardPreview } from '#lib/family';
  import { SCOREBOARD_NAMES } from '#lib/rider-details';
  import { OUTCOME_LABELS, averageSpeed, groupLabel, seconds } from '#lib/results';
  import { formatTime } from '#lib/ui/format';
  import ProgressChart from '#lib/components/ProgressChart.svelte';
  import type { ProgressPoint } from '#lib/results';
  let { data, form } = $props();
  const ws = $derived(data.workspace);
  const rider = $derived(data.selected);
  const self = $derived(rider?.kind === 'rider');
  const latest = $derived(data.results?.efforts[0] ?? null);
  // One chart per distance, start type and activity, most recently ridden first.
  const progressGroups = $derived.by(() => {
    const map = new Map<string, ProgressPoint[]>();
    for (const p of data.results?.progress ?? []) {
      const key = groupLabel(p);
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()].sort((a, b) =>
      Math.max(...b[1].map((p) => Date.parse(p.day))) >
      Math.max(...a[1].map((p) => Date.parse(p.day)))
        ? 1
        : -1
    );
  });
  let scoreboard = $derived(rider?.scoreboard_name ?? 'first_initial');
  const day = (value: string) =>
    new Date(value).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    });
  const born = $derived(
    rider?.birth_date
      ? day(rider.birth_date + 'T00:00:00Z')
      : rider?.birth_year
        ? String(rider.birth_year)
        : 'Not recorded'
  );
</script>

<svelte:head>
  <title>{rider ? rider.display_name + ' · ' : ''}Riders and family · JNS SPLIT</title>
</svelte:head>

{#if form?.message}<p class="feedback" class:error={!form.ok} role="status">{form.message}</p>{/if}
{#if !ws.emailConfirmed}<p class="notice">
    Your account email needs confirming before you can see or accept invitations. Check your inbox
    for the confirmation link.
  </p>{/if}

{#if ws.invitations.length}
  <Card title="Invitations" tone="highlight">
    <ul class="invites">
      {#each ws.invitations as invite (invite.id)}
        <li>
          <h3>
            {invite.kind === 'rider'
              ? `${invite.club_name}: this is you, ${invite.rider_name}`
              : `${invite.club_name}: see ${invite.rider_name} as their parent or guardian`}
          </h3>
          <p class="note">
            {invite.kind === 'rider'
              ? 'Accept to link your account to your rider record at the club.'
              : 'Accept to see this rider’s details and, later, their results. You can only see riders the club links to you.'}
            Expires {day(invite.expires_at)}.
          </p>
          <form method="POST" action="?/respond" class="choices">
            <input type="hidden" name="invitationId" value={invite.id} />
            <Button type="submit" variant="primary" name="choice" value="accept">Accept</Button>
            <Button type="submit" name="choice" value="decline">Not me, decline</Button>
          </form>
        </li>
      {/each}
    </ul>
  </Card>
{/if}

{#if !rider}
  {#if !ws.invitations.length}
    <PageHeader eyebrow="Riders and family" title="No riders yet" />
    <EmptyState title="Nobody is linked to your account yet">
      Ask your club to send an invitation to the email address you sign in with. Riders can ride
      with just their tag in the meantime.
    </EmptyState>
  {/if}
{:else}
  {#if ws.riders.length > 1}
    <nav class="picker" aria-label="Choose a rider">
      {#each ws.riders as r (r.rider_id)}
        <a
          href={`?rider=${r.rider_id}`}
          aria-current={r.rider_id === rider.rider_id ? 'page' : undefined}
        >
          {r.display_name}
          <span class="sub">{r.kind === 'rider' ? 'You' : 'Your child'}</span>
        </a>
      {/each}
    </nav>
  {/if}

  <PageHeader
    eyebrow={`${self ? 'You' : 'Your child'} · ${rider.club_name}`}
    title={rider.display_name}
  >
    {#snippet actions()}
      {#if rider.has_tag}
        <StatusChip tone="success">Tag active, ready to ride</StatusChip>
      {:else}
        <StatusChip tone="warn">No tag yet, ask the club</StatusChip>
      {/if}
    {/snippet}
  </PageHeader>

  <div class="grid">
    <Card title="Results">
      {#if !latest}
        <EmptyState title="No results yet">
          {self ? 'Your' : `${rider.display_name}’s`} times will appear here after the first recorded
          session.
        </EmptyState>
      {:else}
        <div class="results">
          <section class="latest" aria-label="Most recent effort">
            <span class="label">Most recent</span>
            <span class="big">
              {latest.outcome === 'completed'
                ? `${formatTime(seconds(latest.elapsed_ms))}s`
                : OUTCOME_LABELS[latest.outcome]}
            </span>
            <span class="note">
              {groupLabel(latest)} · {latest.session_name} · {day(latest.recorded_at)}
              {#if latest.outcome === 'completed'}
                · {averageSpeed(latest.distance_metres, latest.elapsed_ms)} km/h average{/if}
            </span>
          </section>
          {#if data.results?.groups.length}
            <section aria-label="Best times">
              <span class="label">Best times</span>
              <ul class="bests">
                {#each data.results.groups as g (groupLabel(g))}
                  <li>
                    <span>{groupLabel(g)}</span>
                    <span class="note">
                      {g.valid_count}
                      {g.valid_count === 1 ? 'effort' : 'efforts'}
                    </span>
                    <strong class="time">{formatTime(seconds(g.best_ms))}s</strong>
                  </li>
                {/each}
              </ul>
            </section>
          {/if}
        </div>
        {#if progressGroups.length}
          <section class="progress" aria-label="Progress over time">
            <span class="label">Progress</span>
            {#each progressGroups as [label, points] (label)}
              <ProgressChart {label} {points} />
            {/each}
          </section>
        {/if}
        <details class="all">
          <summary>All efforts ({data.results?.efforts.length})</summary>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Session</th>
                  <th scope="col">Effort</th>
                  <th scope="col" class="num">Time</th>
                </tr>
              </thead>
              <tbody>
                {#each data.results?.efforts ?? [] as e (e.id)}
                  <tr>
                    <td>{day(e.recorded_at)}</td>
                    <td>{e.session_name}</td>
                    <td>{groupLabel(e)}</td>
                    <td class="num">
                      {e.outcome === 'completed'
                        ? `${formatTime(seconds(e.elapsed_ms))}s`
                        : OUTCOME_LABELS[e.outcome]}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </details>
        <p class="note">
          Best times compare like with like: the same distance and start type. Average speed is over
          the whole distance, not a top speed.
        </p>
      {/if}
    </Card>

    <Card title="Name on the scoreboard">
      <form method="POST" action="?/scoreboard" class="stack">
        <input type="hidden" name="riderId" value={rider.rider_id} />
        <ChoiceGroup
          legend={self ? 'How should your name appear?' : 'How should their name appear?'}
          name="scoreboardName"
          variant="cards"
          bind:value={scoreboard}
          options={SCOREBOARD_NAMES.map((n) => ({
            value: n.value,
            label: n.label,
            description: scoreboardPreview(rider.display_name, n.value)
          }))}
          hint={rider.scoreboard_chosen
            ? undefined
            : 'Until you choose, the club’s default is used.'}
        />
        <div><Button type="submit" variant="primary">Save choice</Button></div>
      </form>
    </Card>

    <Card title="What the club holds">
      <dl class="facts">
        <div>
          <dt>Name</dt>
          <dd>{rider.display_name}</dd>
        </div>
        <div>
          <dt>Born</dt>
          <dd>{born}</dd>
        </div>
        <div>
          <dt>Club</dt>
          <dd>{rider.club_name}</dd>
        </div>
        {#each rider.fields as field (field.label)}
          <div>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        {/each}
      </dl>
      <details>
        <summary>Something wrong? Ask the club to correct it</summary>
        {#if rider.open_corrections >= 3}
          <p class="note">You have three requests waiting. The club will look at those first.</p>
        {:else}
          <form method="POST" action="?/correction" class="stack">
            <input type="hidden" name="riderId" value={rider.rider_id} />
            <label>
              What needs changing?<textarea name="message" required maxlength="500" rows="3"
              ></textarea>
            </label>
            <div><Button type="submit">Send to the club</Button></div>
          </form>
        {/if}
        {#if rider.open_corrections}<p class="note">
            {rider.open_corrections === 1
              ? 'One request is waiting for the club.'
              : `${rider.open_corrections} requests are waiting for the club.`}
          </p>{/if}
      </details>
    </Card>
  </div>

  <details class="leave">
    <summary>Stop seeing {rider.display_name}</summary>
    <form method="POST" action="?/leave" class="stack">
      <input type="hidden" name="linkId" value={rider.link_id} />
      <label class="checkbox-label">
        <input type="checkbox" name="confirm" value="yes" required />Remove {rider.display_name} from
        my account. The club keeps their record, and they can still ride.
      </label>
      <div><Button type="submit" variant="danger">Remove</Button></div>
    </form>
  </details>
{/if}

<style>
  .invites {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .invites li {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.9rem;
    border-radius: var(--radius);
    background: var(--raised);
  }
  .invites h3 {
    margin: 0;
    font-size: 1rem;
  }
  .choices {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin: 0;
  }
  .note {
    font-size: 0.875rem;
    color: var(--muted);
    margin: 0;
  }
  .picker {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin: 1rem 0 0.5rem;
  }
  .picker a {
    display: inline-flex;
    flex-direction: column;
    justify-content: center;
    min-height: var(--touch);
    padding: 0.4rem 1rem;
    border: 1px solid var(--edge);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
    font-weight: 600;
  }
  .picker a[aria-current='page'] {
    border-color: var(--accent-edge);
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .picker .sub {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--muted);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    align-items: start;
  }
  .grid > :global(:first-child) {
    grid-column: 1 / -1;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 0;
  }
  .facts {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .facts div {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--edge);
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
    font-weight: 600;
    text-align: right;
    overflow-wrap: anywhere;
  }
  textarea {
    width: 100%;
  }
  .results {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    gap: 1.5rem;
    align-items: start;
  }
  .results section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .label {
    font-size: 0.8125rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }
  .big {
    font: italic 800 3.5rem/1 var(--font-display);
    font-variant-numeric: tabular-nums;
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
  .bests li span:first-child {
    flex: 1;
  }
  .time {
    font: italic 700 1.5rem var(--font-display);
    font-variant-numeric: tabular-nums;
  }
  .all {
    margin-top: 1rem;
  }
  .progress {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    margin-top: 1.5rem;
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
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .leave {
    margin-top: 1.5rem;
  }
  @media (max-width: 760px) {
    .results {
      grid-template-columns: minmax(0, 1fr);
    }
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
