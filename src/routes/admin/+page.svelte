<script lang="ts">
  import ApplicationList from '#lib/components/ApplicationList.svelte';
  import Card from '#lib/ui/Card.svelte';
  import CardGrid from '#lib/ui/CardGrid.svelte';
  import EmptyState from '#lib/ui/EmptyState.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import Stat from '#lib/ui/Stat.svelte';
  import { sessionDate } from '#lib/training-sessions';
  let { data } = $props();
</script>

<svelte:head><title>Platform administration · JNS SPLIT</title></svelte:head>

<PageHeader
  eyebrow="Platform administration"
  title="Club applications"
  description="Review club registration requests. This role does not give access to any club's riders, tags, sessions or equipment."
/>

<CardGrid columns={2}>
  <Card tone={data.overview.pending > 0 ? 'highlight' : 'default'}>
    <Stat label="Waiting for review" value={data.overview.pending} />
  </Card>
  <Card>
    <Stat label="Clubs" value={data.overview.clubs} />
  </Card>
</CardGrid>

<Card title="Review queue">
  <ApplicationList list={data.list} status={data.filters.status} platform />
</Card>

<Card title="Recent decisions">
  {#each data.overview.decisions as decision}
    <p class="event">
      <a href={`/admin/applications/${decision.application_id}`}>{decision.club_name}</a> · {decision.action}<small
        class="block"
      >
        {sessionDate(decision.created_at)}
      </small>
    </p>
  {:else}
    <EmptyState title="No decisions yet" />
  {/each}
</Card>

<p class="caption">
  Managing platform access, suspending clubs and service-health monitoring are not part of this
  dashboard yet.
</p>
