<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { connectReader } from '#lib/serial';
  import { parseScan } from '#lib/session';
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import EmptyState from '#lib/ui/EmptyState.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import StatusChip from '#lib/ui/StatusChip.svelte';
  import { tagSuffix } from '#lib/ui/format';
  import RiderDetailsFields from '#lib/components/RiderDetailsFields.svelte';

  let { data, form } = $props();
  let selectedId = $state('');
  let editUid = $state(''),
    newUid = $state(''),
    lastUid = $state(''),
    pasted = $state('');
  let readerStatus = $state('Connect the base station to read tags instead of typing them.'),
    connected = $state(false),
    connecting = $state(false);
  let stop: (() => Promise<void>) | undefined;
  let manageHeading: HTMLHeadingElement | undefined = $state();
  let selected = $derived(data.riders.find((r) => r.id === selectedId));

  let activeTags = $derived(data.tags.filter((t) => !t.revoked_at));
  const activeTag = (id: string) => activeTags.find((t) => t.rider_id === id);
  const fieldValues = (id: string) =>
    Object.fromEntries(
      data.fieldValues.filter((v) => v.rider_id === id).map((v) => [v.field_id, v.value])
    );
  const born = (r: { birth_year: number | null; birth_date: string | null }) =>
    r.birth_date
      ? 'Born ' +
        new Date(r.birth_date + 'T00:00:00Z').toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC'
        })
      : r.birth_year
        ? `Born ${r.birth_year}`
        : null;
  const time = (value: string) =>
    new Date(value).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

  async function connect() {
    connecting = true;
    try {
      stop = await connectReader(
        (scan) => {
          lastUid = scan.uid;
          readerStatus = 'Tag read. Choose where to use it.';
        },
        (message) => {
          readerStatus = message;
          if (message === 'USB reader disconnected.') connected = false;
        }
      );
      connected = true;
      readerStatus = 'Ready. Tap a tag on the base station.';
    } catch (e) {
      readerStatus = (e as Error).message;
    } finally {
      connecting = false;
    }
  }
  async function disconnect() {
    await stop?.();
    stop = undefined;
    connected = false;
    readerStatus = 'Base station disconnected.';
  }
  function parse() {
    try {
      lastUid = parseScan(pasted).uid;
      readerStatus = 'Tag read. Choose where to use it.';
    } catch {
      readerStatus = 'Paste a valid JSON scan line from the Core2 bench firmware.';
    }
  }
  async function manage(id: string) {
    selectedId = id;
    editUid = '';
    await tick();
    manageHeading?.focus();
  }
  const pageLink = (n: number) =>
    '?' +
    new URLSearchParams({ q: data.filters.query, status: data.filters.status, page: String(n) });
  onDestroy(() => {
    void stop?.();
  });
</script>

<svelte:head><title>Riders & tags · {data.club.name} · JNS SPLIT</title></svelte:head>

<PageHeader
  eyebrow={data.club.name}
  title="Riders & tags"
  description="Each rider belongs to the club. Results stay with the rider, so replacing a lost tag never loses their history."
/>

{#if form?.message}<p class="feedback" class:error={!form.ok} role="status">{form.message}</p>{/if}
{#if data.corrections.length}
  <p class="notice corrections" role="status">
    <strong>
      {data.corrections.length === 1
        ? '1 correction request'
        : `${data.corrections.length} correction requests`}
    </strong>
    from families:
    {#each data.corrections.filter((c, i, all) => all.findIndex((x) => x.rider_id === c.rider_id) === i) as c, i (c.rider_id)}
      {i ? ', ' : ''}<a href={`/club/${data.club.id}/riders/${c.rider_id}`}>{c.display_name}</a>
    {/each}
  </p>
{/if}

<div class="top">
  <Card title="Base station" tone={lastUid ? 'highlight' : 'default'}>
    {#snippet actions()}
      {#if connected}<StatusChip tone="success">Connected · USB</StatusChip>
      {:else}<StatusChip>Not connected</StatusChip>{/if}
    {/snippet}
    <p class="status" role="status">{readerStatus}</p>
    {#if lastUid}
      <div class="captured">
        <span class="label">Tag read</span>
        <span class="suffix tabular">{tagSuffix(lastUid)}</span>
        <code>{lastUid}</code>
      </div>
      <div class="row">
        <Button onclick={() => (newUid = lastUid)}>Use for a new rider</Button>
        <Button disabled={!selected || !!selected.archived_at} onclick={() => (editUid = lastUid)}>
          {selected ? `Use for ${selected.display_name}` : 'Use for the selected rider'}
        </Button>
      </div>
    {/if}
    <div class="row">
      {#if connected}
        <Button onclick={disconnect}>Disconnect</Button>
      {:else}
        <Button variant="primary" disabled={connecting} onclick={connect}>
          {connecting ? 'Connecting…' : 'Connect base station'}
        </Button>
      {/if}
    </div>
    <details class="fallback">
      <summary>No reader? Paste a scan line instead</summary>
      <label>
        JSON scan from Serial Monitor<textarea rows="3" bind:value={pasted}></textarea>
      </label>
      <Button onclick={parse}>Read tag</Button>
    </details>
  </Card>

  <Card title="Register a rider">
    <p class="hint">
      Use your club’s own registration and permissions process first. Don’t enter safeguarding
      documents here.
    </p>
    <form method="POST" action="?/register" class="stack">
      <label>
        Display name<input
          name="name"
          required
          maxlength="60"
          autocomplete="off"
          placeholder="How the rider appears, e.g. Alex M."
        />
      </label>
      <RiderDetailsFields settings={data.riderSettings} />
      <label>
        Tag (optional — read it with the base station)<input
          name="uid"
          bind:value={newUid}
          maxlength="40"
          placeholder="Leave blank to issue a tag later"
          autocomplete="off"
        />
      </label>
      <div><Button type="submit" variant="primary">Save rider</Button></div>
    </form>
  </Card>
</div>

<div class="register" class:with-panel={!!selected}>
  <Card title="Club register">
    <form method="GET" class="filters">
      <label class="grow">
        Search name or tag<input name="q" value={data.filters.query} maxlength="60" />
      </label>
      <label>
        Show<select name="status" value={data.filters.status}>
          <option value="active">Active</option>
          <option value="untagged">Waiting for a tag</option>
          <option value="archived">Archived</option>
          <option value="all">All riders</option>
        </select>
      </label>
      <Button type="submit">Search</Button>
      <a href={`/club/${data.club.id}/riders`}>Clear</a>
    </form>
    <p class="hint">{data.total} riders · page {data.page} of {data.pages}</p>

    {#if data.riders.length}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Rider</th><th scope="col" class="wide-only">Status</th><th
                scope="col"
                class="wide-only"
              >
                Tag
              </th><th scope="col"><span class="visually-hidden">Manage</span></th>
            </tr>
          </thead>
          <tbody>
            {#each data.riders as rider (rider.id)}
              {@const tag = activeTag(rider.id)}
              <tr class:current={rider.id === selectedId}>
                <th scope="row">
                  {rider.display_name}
                  {#if born(rider)}<span class="born">{born(rider)}</span>
                  {:else if !rider.archived_at}<span class="born missing">
                      No year of birth
                    </span>{/if}
                  <span class="mobile-meta">
                    {rider.archived_at
                      ? 'Archived'
                      : tag
                        ? `Tag ${tagSuffix(tag.uid)}`
                        : 'Waiting for a tag'}
                  </span>
                </th>
                <td class="wide-only">
                  {#if rider.archived_at}<StatusChip>Archived</StatusChip>
                  {:else if tag}<StatusChip tone="success">Active</StatusChip>
                  {:else}<StatusChip tone="warn">Waiting for a tag</StatusChip>{/if}
                </td>
                <td class="tabular wide-only" title={tag?.uid}>{tag ? tagSuffix(tag.uid) : '—'}</td>
                <td class="end">
                  <Button
                    variant={rider.id === selectedId ? 'primary' : 'secondary'}
                    aria-pressed={rider.id === selectedId}
                    aria-label={`Manage ${rider.display_name}`}
                    onclick={() => manage(rider.id)}
                  >
                    Manage
                  </Button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <EmptyState title="No riders match">
        Register a rider, or clear the search and filters.
      </EmptyState>
    {/if}

    {#if data.pages > 1}
      <nav class="pagination" aria-label="Rider pages">
        {#if data.page > 1}<Button href={pageLink(data.page - 1)}>Previous</Button>{/if}
        {#if data.page < data.pages}<Button href={pageLink(data.page + 1)}>Next</Button>{/if}
      </nav>
    {/if}
  </Card>

  {#if selected}
    {@const tag = activeTag(selected.id)}
    <section class="manage" aria-labelledby="manage-heading">
      <div class="manage-head">
        <h2 id="manage-heading" tabindex="-1" bind:this={manageHeading}>
          {selected.display_name}
        </h2>
        <Button variant="quiet" onclick={() => (selectedId = '')}>Close</Button>
      </div>
      <a class="family-link" href={`/club/${data.club.id}/riders/${selected.id}`}>
        Family access and invitations →
      </a>
      {#if !selected.archived_at}
        <details class="edit" open={!selected.birth_year}>
          <summary>
            {selected.birth_year ? 'Edit details' : 'Add year of birth and details'}
          </summary>
          {#key selected.id}
            <form method="POST" action="?/details" class="stack">
              <input type="hidden" name="riderId" value={selected.id} />
              <label>
                Display name<input
                  name="name"
                  required
                  maxlength="60"
                  autocomplete="off"
                  value={selected.display_name}
                />
              </label>
              <RiderDetailsFields
                settings={data.riderSettings}
                birthYear={selected.birth_year}
                birthDate={selected.birth_date}
                values={fieldValues(selected.id)}
              />
              <div><Button type="submit" variant="primary">Save details</Button></div>
            </form>
          {/key}
        </details>
        {#if data.riderSettings.fields.length || born(selected)}
          <dl class="facts">
            {#if born(selected)}<div>
                <dt>Born</dt>
                <dd>{born(selected)?.replace('Born ', '')}</dd>
              </div>{/if}
            {#each data.riderSettings.fields as field (field.id)}
              <div>
                <dt>{field.label}</dt>
                <dd>{fieldValues(selected.id)[field.id] || '—'}</dd>
              </div>
            {/each}
          </dl>
        {/if}
      {/if}
      {#if selected.archived_at}
        <StatusChip>Archived</StatusChip>
        <p class="hint">Archived riders can’t receive tags. Their records stay with the club.</p>
      {:else}
        <div class="current-tag">
          <span class="label">Current tag</span>
          <span class="suffix tabular">{tag ? tagSuffix(tag.uid) : 'None'}</span>
          {#if tag}<span class="hint">Issued {time(tag.assigned_at)}</span>{/if}
        </div>
        <form method="POST" action="?/tag" class="stack">
          <input type="hidden" name="riderId" value={selected.id} />
          <label>
            {tag ? 'Replace with a new tag' : 'Issue a tag'}<input
              name="uid"
              required
              maxlength="40"
              bind:value={editUid}
              placeholder="Tap the tag on the base station"
              autocomplete="off"
            />
          </label>
          <p class="hint">
            {tag
              ? 'The current tag stops working the moment the new one is saved. It stays in the history.'
              : 'The rider can use the tag at the lane readers straight away.'}
          </p>
          <div><Button type="submit" variant="primary">Save tag</Button></div>
        </form>
        {#if tag}
          <form method="POST" action="?/revoke">
            <input type="hidden" name="riderId" value={selected.id} />
            <Button type="submit" variant="danger">Revoke current tag</Button>
          </form>
        {/if}
        <details>
          <summary>Archive rider</summary>
          <p class="hint">
            Removes the rider from the active register and revokes their tag. Their history is kept.
          </p>
          <form method="POST" action="?/archive" class="stack">
            <input type="hidden" name="riderId" value={selected.id} />
            <label class="checkbox-label">
              <input type="checkbox" name="confirm" value="yes" required />Archive {selected.display_name}
              and revoke their tag
            </label>
            <div><Button type="submit" variant="danger">Archive rider</Button></div>
          </form>
        </details>
      {/if}
      <h3>Tag history</h3>
      <ul class="history">
        {#each data.tags.filter((t) => t.rider_id === selected.id) as entry (entry.id)}
          <li>
            <span class="tabular" title={entry.uid}>{tagSuffix(entry.uid)}</span>
            <span>
              {#if entry.revoked_at}Retired {time(entry.revoked_at)}{:else}<StatusChip
                  tone="success"
                >
                  Active
                </StatusChip>{/if}
              <small class="block">Issued {time(entry.assigned_at)}</small>
            </span>
          </li>
        {:else}
          <li class="hint">No tags issued yet.</li>
        {/each}
      </ul>
      <p class="hint">Latest 50 assignments. Older history is kept.</p>
    </section>
  {/if}
</div>

<p class="caption">Saved to your club register. Not yet connected to lane readers or timing.</p>

<style>
  .top {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }
  .register {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }
  .register.with-panel {
    grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
  }
  .row {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 0;
  }
  .stack label,
  .filters label {
    color: var(--muted);
    font-size: 0.875rem;
    font-weight: 500;
  }
  .hint,
  .status {
    font-size: 0.875rem;
    color: var(--muted);
  }
  .captured,
  .current-tag {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.9rem 1rem;
    border-radius: var(--radius);
    background: var(--raised);
  }
  .captured {
    background: var(--accent-soft);
    border: 1px solid var(--accent-edge);
  }
  .label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }
  .suffix {
    font: 700 2.25rem/1 var(--font-display);
  }
  .captured code {
    font-size: 0.75rem;
    color: var(--muted);
    word-break: break-all;
  }
  .fallback {
    margin: 0;
    padding: 0.5rem 0 0;
  }
  .filters {
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
    flex-wrap: wrap;
    margin: 0;
  }
  .filters label {
    flex: 0 1 180px;
  }
  .filters .grow {
    flex: 1 1 220px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    text-align: left;
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--edge);
    vertical-align: middle;
  }
  thead th {
    font-size: 0.75rem;
    color: var(--muted);
  }
  tbody th {
    font-weight: 600;
    font-size: 0.9375rem;
    color: var(--text);
  }
  td.end {
    text-align: right;
  }
  tr.current {
    background: var(--accent-soft);
  }
  .pagination {
    display: flex;
    gap: 0.5rem;
  }
  .manage {
    background: var(--surface);
    border: 1px solid var(--accent-edge);
    border-radius: var(--radius-lg);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    position: sticky;
    top: 1rem;
  }
  .family-link {
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
    font-weight: 600;
  }
  .manage-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }
  .manage h2 {
    margin: 0;
  }
  .manage h3 {
    margin: 0.5rem 0 0;
    font-size: 1rem;
  }
  .manage details {
    margin: 0;
  }
  .history {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .history li {
    display: flex;
    gap: 0.9rem;
    align-items: baseline;
    font-size: 0.875rem;
  }
  .history li > span:first-child {
    font: 700 1.125rem var(--font-display);
    min-width: 4rem;
  }
  .mobile-meta {
    display: none;
  }
  .born {
    display: block;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--muted);
  }
  .born.missing {
    color: var(--warn-text);
  }
  .edit {
    margin: 0;
  }
  .edit .stack {
    margin-top: 0.75rem;
  }
  .facts {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem 1rem;
    font-size: 0.875rem;
  }
  .facts dt {
    color: var(--muted);
    font-size: 0.75rem;
  }
  .facts dd {
    margin: 0;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  @media (max-width: 600px) {
    .wide-only {
      display: none;
    }
    .mobile-meta {
      display: block;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--muted);
    }
  }
  @media (max-width: 960px) {
    .top,
    .register.with-panel {
      grid-template-columns: minmax(0, 1fr);
    }
    .manage {
      position: static;
    }
  }
</style>
