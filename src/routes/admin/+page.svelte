<script lang="ts">
  import ApplicationList from '#lib/components/ApplicationList.svelte';
  import { sessionDate } from '#lib/training-sessions';
  let { data } = $props();
</script>

<svelte:head><title>Platform administration · JNS SPLIT</title></svelte:head>
<main class="account-page wide">
  <span class="eyebrow">PLATFORM ADMINISTRATION</span>
  <h1>Club applications</h1>
  <a href="/app?choose=1">Switch workspace</a>
  <p>
    Review club registration requests. This role does not grant access to clubs' rider records,
    tags, sessions or test equipment.
  </p>
  <div class="metrics">
    <div><span>Awaiting review</span><strong>{data.overview.pending}</strong></div>
    <div><span>Existing clubs</span><strong>{data.overview.clubs}</strong></div>
  </div>
  <section class="panel">
    <h2>Review queue</h2>
    <ApplicationList list={data.list} status={data.filters.status} platform />
  </section>
  <section class="panel">
    <h2>Recent decisions</h2>
    {#each data.overview.decisions as decision}<p>
        <a href={`/admin/applications/${decision.application_id}`}>{decision.club_name}</a> · {decision.action}<small
          class="block"
        >
          {sessionDate(decision.created_at)}
        </small>
      </p>{:else}<p>No application decisions yet.</p>{/each}
  </section>
  <p class="caption">
    Account-role management, club suspension and service health monitoring are not part of this
    initial dashboard.
  </p>
</main>
