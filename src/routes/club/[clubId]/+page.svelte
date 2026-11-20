<script lang="ts">
  let { data, form } = $props();
  const date = (v: string) => new Date(v).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
</script>

<svelte:head><title>{data.club.name} · Club overview · JNS SPLIT</title></svelte:head>
<h1>Club overview</h1>
<p>Your register, at a glance.</p>
{#if form?.message}<p class="feedback" class:error={!form.ok} role="status">
    {form.message} <a href={`/club/${data.club.id}/riders`}>Open rider management</a>
  </p>{/if}
<div class="metrics">
  <div><span>Active riders</span><strong>{data.overview.active}</strong></div>
  <div><span>Active tags</span><strong>{data.overview.tagged}</strong></div>
  <div><span>Awaiting a tag</span><strong>{data.overview.untagged}</strong></div>
</div>
<div class="public-actions">
  <a class="solid link-button" href={`/club/${data.club.id}/riders`}>Register / manage riders</a><a
    class="link-button"
    href={`/club/${data.club.id}/riders?status=untagged`}
  >
    Riders awaiting tags
  </a>
</div>
<div class="feature-grid workspace-cards">
  <section class="panel">
    <h2>Club register</h2>
    <p>{data.overview.archived} archived riders. Archiving retains identity and tag history.</p>
    <a class="text-link" href={`/club/${data.club.id}/riders?status=archived`}>
      View archived riders
    </a>
  </section>
  <section class="panel">
    <h2>Session recording</h2>
    <p>Upcoming. Live sessions and timing uploads are not connected yet.</p>
    <a class="text-link" href="/bench">Open the bench simulator</a>
  </section>
  <section class="panel">
    <h2>Club defaults</h2>
    <p>
      Preferred speed unit: {data.club.speed_unit}. This is saved for future recorded-session
      displays; the simulator keeps its own settings.
    </p>
    <a class="text-link" href={`/club/${data.club.id}/settings`}>Edit club settings</a>
  </section>
</div>
<section class="panel">
  <h2>Recent changes</h2>
  <p>Latest 10 saved club actions.</p>
  {#each data.overview.audit as entry}<p class="event">
      {entry.action.replaceAll('_', ' ')} · {entry.display_name ?? 'Club'}<small class="block">
        {date(entry.created_at)}
      </small>
    </p>{:else}<p>No changes recorded yet.</p>{/each}
</section>
