<script lang="ts">
  import ApplicationSummary from '#lib/components/ApplicationSummary.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import ChoiceGroup from '#lib/ui/ChoiceGroup.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  let { data, form } = $props();
  let decision = $state('');
</script>

<svelte:head><title>Review club application · JNS SPLIT</title></svelte:head>

<PageHeader eyebrow="Platform administration" title="Review application">
  {#snippet actions()}<Button href="/admin">Back to applications</Button>{/snippet}
</PageHeader>

{#if form?.message}<p class="feedback" class:error={!form.ok} role="status">{form.message}</p>{/if}

{#if data.detail.matchingClubs.length}
  <Card title="Possible duplicate" tone="warn">
    <p>A club with the same name already exists:</p>
    <ul class="matches">
      {#each data.detail.matchingClubs as club (club.id)}
        <li><strong>{club.name}</strong> <code>{club.id}</code></li>
      {/each}
    </ul>
    <p>Check this isn’t the same club before approving. Nothing is merged automatically.</p>
  </Card>
{/if}

<ApplicationSummary detail={data.detail} />

{#if data.detail.application.status === 'submitted'}
  <Card title="Decision" tone="highlight">
    <form method="POST" action="?/review" class="stack">
      <ChoiceGroup
        legend="Your decision"
        name="decision"
        variant="cards"
        bind:value={decision}
        options={[
          {
            value: 'approve',
            label: 'Approve',
            description: 'Creates the club and makes the applicant its first administrator.'
          },
          {
            value: 'decline',
            label: 'Decline',
            description: 'No club is created. The applicant can apply again later.'
          }
        ]}
      />
      <label>
        Reason (the applicant will see this)<textarea
          name="reason"
          rows="3"
          minlength="3"
          maxlength="500"
          required
          value={form?.reason ?? ''}></textarea>
      </label>
      <label class="checkbox-label">
        <input type="checkbox" name="confirm" value="yes" required />I’ve checked the application
        and confirm this decision
      </label>
      <div>
        <Button type="submit" variant="primary" disabled={!decision}>Save decision</Button>
      </div>
    </form>
  </Card>
{:else}
  <p class="note">This application has been decided. The decision can’t be changed.</p>
{/if}

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 0;
  }
  .stack label {
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted);
  }
  .matches {
    margin: 0;
    padding-left: 1.2rem;
  }
  .note {
    font-size: 0.875rem;
    color: var(--muted);
  }
</style>
