<script lang="ts">
  import { onDestroy } from 'svelte';
  import { connectReader } from '#lib/serial';
  import { parseScan } from '#lib/session';
  let { data, form } = $props();
  let selectedId = $state('');
  let editUid = $state(''),
    newUid = $state(''),
    lastUid = $state(''),
    pasted = $state('');
  let readerStatus = $state('Reader disconnected.'),
    connected = $state(false),
    connecting = $state(false);
  let stop: (() => Promise<void>) | undefined;
  let selected = $derived(data.riders.find((r) => r.id === selectedId));

  let activeTags = $derived(data.tags.filter((t) => !t.revoked_at));
  const activeTag = (id: string) => activeTags.find((t) => t.rider_id === id);

  const time = (value: string) =>
    new Date(value).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  async function connect() {
    connecting = true;
    try {
      stop = await connectReader(
        (scan) => {
          lastUid = scan.uid;
          readerStatus = 'Tag captured. Choose where to use it below.';
        },
        (message) => {
          readerStatus = message;
          if (message === 'USB reader disconnected.') connected = false;
        }
      );
      connected = true;
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
  }
  function parse() {
    try {
      lastUid = parseScan(pasted).uid;
      readerStatus = 'Tag captured. Choose where to use it below.';
    } catch {
      readerStatus = 'Paste a valid JSON scan line from the Core2 bench firmware.';
    }
  }
  const pageLink = (n: number) =>
    '?' +
    new URLSearchParams({ q: data.filters.query, status: data.filters.status, page: String(n) });
  onDestroy(() => {
    void stop?.();
  });
</script>

<svelte:head><title>{data.club.name} · JNS SPLIT</title></svelte:head>
<h1>Riders & tags</h1>
<div class="notice">
  <strong>Saved club records</strong><span>
    Changes are saved to Supabase. This register is not yet connected to the timing controller or
    bench simulator.
  </span>
</div>
{#if form?.message}<div class="feedback" class:error={!form.ok} role="status">
    {form.message}
  </div>{/if}
<section class="panel">
  <h2>Register a rider</h2>
  <p>
    Use the club’s existing registration and permissions process. Only a display name is needed
    here; do not enter safeguarding documents.
  </p>
  <form method="POST" action="?/register">
    <div class="form-row">
      <label>
        Rider display name<input name="name" required maxlength="60" placeholder="Rider name" />
      </label><label>
        Tag UID (optional)<input
          name="uid"
          bind:value={newUid}
          maxlength="40"
          placeholder="Issue a tag now or later"
        />
      </label>
    </div>
    <button class="solid">Save rider</button>
  </form>
</section>
<section class="panel">
  <div class="section-heading">
    <div>
      <h2>Club register</h2>
      <form method="GET" class="form-row">
        <label>
          Search name or active tag<input name="q" value={data.filters.query} maxlength="60" />
        </label>
        <label>
          Status<select name="status" value={data.filters.status}>
            <option value="active">Active</option><option value="untagged">
              Awaiting tag
            </option><option value="archived">Archived</option><option value="all">
              All riders
            </option>
          </select>
        </label>
        <button>Search</button><a class="text-link" href={`/club/${data.club.id}/riders`}>
          Clear filters
        </a>
      </form>
      <p>{data.total} matching riders · Page {data.page} of {data.pages}</p>
      <p>Each rider belongs to this club. Replacing a tag preserves their identity.</p>
    </div>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr><th>Rider</th><th>Status</th><th>Active tag</th><th>Manage</th></tr>
      </thead><tbody>
        {#each data.riders as rider}<tr>
            <td>{rider.display_name}</td><td>
              {rider.archived_at ? 'Archived' : 'Active'}
            </td><td><code>{activeTag(rider.id)?.uid ?? 'Not issued'}</code></td><td>
              <button
                onclick={() => {
                  selectedId = rider.id;
                  editUid = '';
                }}
              >
                Manage
              </button>
            </td>
          </tr>{/each}
      </tbody>
    </table>
  </div>
  {#if !data.riders.length}<div class="empty">
      No riders match these filters. Register a rider above or clear the filters.
    </div>{/if}
</section>
<nav class="pagination" aria-label="Rider pages">
  {#if data.page > 1}<a class="link-button" href={pageLink(data.page - 1)}>
      Previous
    </a>{/if}{#if data.page < data.pages}<a class="link-button" href={pageLink(data.page + 1)}>
      Next
    </a>{/if}
</nav>
{#if selected}
  <section class="panel">
    <div class="section-heading">
      <h2>{selected.display_name}</h2>
      <button onclick={() => (selectedId = '')}>Close</button>
    </div>
    {#if !selected.archived_at}
      <form method="POST" action="?/tag">
        <input type="hidden" name="riderId" value={selected.id} /><label>
          New tag UID<input name="uid" required maxlength="40" bind:value={editUid} />
        </label>
        <p class="caption">
          Saving replaces the current tag atomically. The old tag remains in history.
        </p>
        <button class="solid">Save tag</button>
      </form>
      <form method="POST" action="?/revoke">
        <input type="hidden" name="riderId" value={selected.id} /><button
          disabled={!activeTag(selected.id)}
        >
          Revoke active tag
        </button>
      </form>
      <details>
        <summary>Archive rider</summary>
        <p>
          Removes the rider from the active register and revokes their active tag. Historical
          records remain.
        </p>
        <form method="POST" action="?/archive">
          <input type="hidden" name="riderId" value={selected.id} /><label class="checkbox-label">
            <input type="checkbox" name="confirm" value="yes" required />Archive {selected.display_name}
            and revoke their tag
          </label><button>Archive rider</button>
        </form>
      </details>
    {:else}<p>
        Archived riders cannot receive new tags. Their records remain available to the club.
      </p>{/if}
    <h3>Tag history</h3>
    <p class="caption">Latest 50 assignments for this rider. Older history remains stored.</p>
    {#each data.tags.filter((t) => t.rider_id === selected.id) as tag}<p>
        <code>{tag.uid}</code> · {tag.revoked_at
          ? 'Retired ' + time(tag.revoked_at)
          : 'Active'}<small class="block">Issued {time(tag.assigned_at)}</small>
      </p>{:else}<p>No tags issued.</p>{/each}
  </section>
{/if}
<section class="panel">
  <h2>Read a tag for registration</h2>
  <p>
    Connect the Core2 bench reader by USB, or paste a scan from Serial Monitor. A scan only fills a
    UID; you still choose the rider and save.
  </p>
  <div class="equipment-status" role="status">{readerStatus}</div>
  <button class="solid" disabled={connected || connecting} onclick={connect}>
    {connecting ? 'Connecting…' : 'Connect USB reader'}
  </button><button disabled={!connected} onclick={disconnect}>Disconnect</button>
  <details>
    <summary>Paste a serial scan</summary><label>
      JSON scan<textarea rows="3" bind:value={pasted}></textarea>
    </label><button onclick={parse}>Read UID</button>
  </details>
  {#if lastUid}<div class="scan-detail">
      <strong>Captured UID: {lastUid}</strong>
      <div class="form-row">
        <button onclick={() => (newUid = lastUid)}>Use for new rider</button><button
          disabled={!selected || !!selected.archived_at}
          onclick={() => (editUid = lastUid)}
        >
          Use for selected rider
        </button>
      </div>
    </div>{/if}
</section>
