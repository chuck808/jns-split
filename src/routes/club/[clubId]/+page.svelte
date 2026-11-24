<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import CardGrid from '#lib/ui/CardGrid.svelte';
  import EmptyState from '#lib/ui/EmptyState.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import Stat from '#lib/ui/Stat.svelte';
  import StatusChip from '#lib/ui/StatusChip.svelte';
  let { data, form } = $props();
  const base = $derived(`/club/${data.club.id}`);
  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());
  const date = (v: string) => new Date(v).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
</script>

<svelte:head><title>{data.club.name} · Club home · JNS SPLIT</title></svelte:head>

<PageHeader eyebrow={today} title={data.club.name}>
  {#snippet actions()}
    <Button href={`${base}/riders`}>Register a rider</Button>
    <Button variant="primary" href={`${base}/sessions`}>Plan a session</Button>
  {/snippet}
</PageHeader>

{#if form?.message}<p class="feedback" class:error={!form.ok} role="status">
    {form.message} <a href={`${base}/riders`}>Open rider management</a>
  </p>{/if}

<CardGrid columns={3}>
  <Card title="Riders">
    <Stat label="Active riders" value={data.overview.active} />
    <a href={`${base}/riders`}>Manage riders</a>
  </Card>
  <Card title="Tags" tone={data.overview.untagged > 0 ? 'highlight' : 'default'}>
    <Stat
      label="Riders waiting for a tag"
      value={data.overview.untagged}
      hint={`${data.overview.tagged} riders have an active tag`}
    />
    <a href={`${base}/riders?status=untagged`}>Issue tags</a>
  </Card>
  <Card title="Equipment">
    <div><StatusChip>Not connected</StatusChip></div>
    <p>
      No timing controller has reported in yet. Bench and test devices are under Test equipment.
    </p>
    <a href={`${base}/equipment`}>Test equipment</a>
  </Card>
</CardGrid>

<CardGrid columns={2}>
  <Card title="Sessions">
    <p>Plan coached sessions or open practice, choose riders and give coaches access.</p>
    <p class="note">Timing and result uploads are not connected yet.</p>
    <div><Button href={`${base}/sessions`}>Open sessions</Button></div>
  </Card>
  <Card title="Club settings">
    <p>Preferred speed unit: <strong>{data.club.speed_unit}</strong>.</p>
    <p class="note">
      {data.overview.archived} archived riders keep their identity and tag history.
    </p>
    <div class="links">
      <a href={`${base}/settings`}>Edit settings</a>
      <a href={`${base}/riders?status=archived`}>Archived riders</a>
    </div>
  </Card>
</CardGrid>

<Card title="Recent changes">
  {#each data.overview.audit as entry}
    <p class="event">
      {entry.action.replaceAll('_', ' ')} · {entry.display_name ?? 'Club'}<small class="block">
        {date(entry.created_at)}
      </small>
    </p>
  {:else}
    <EmptyState title="No changes recorded yet">
      Registering riders, issuing tags and inviting coaches will appear here.
    </EmptyState>
  {/each}
</Card>

<style>
  .note {
    font-size: 0.875rem;
    color: var(--muted);
  }
  .links {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
</style>
