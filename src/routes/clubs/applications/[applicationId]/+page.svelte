<script lang="ts">
  import ApplicationSummary from '#lib/components/ApplicationSummary.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  let { data, form } = $props();
  const status = $derived(data.detail.application.status);
</script>

<svelte:head><title>Your club application · JNS SPLIT</title></svelte:head>

<PageHeader eyebrow="Club registration" title="Your application">
  {#snippet actions()}<Button href="/clubs/request">Back to your applications</Button>{/snippet}
</PageHeader>

{#if form?.message}<p class="feedback" class:error={!form.ok} role="status">{form.message}</p>{/if}

{#if status === 'submitted'}
  <p class="notice">
    Waiting for review. Your club isn’t set up yet — check back here for the decision.
  </p>
{:else if status === 'declined' || status === 'withdrawn'}
  <p class="notice">
    You can send a new application whenever you’re ready. This one and its history stay as they are.
  </p>
{/if}

<ApplicationSummary detail={data.detail} />

{#if status === 'submitted' && data.detail.isApplicant}
  <Card title="Withdraw">
    <form method="POST" action="?/withdraw" class="stack">
      <label class="checkbox-label">
        <input type="checkbox" name="confirm" value="yes" required />I want to withdraw this
        application
      </label>
      <div><Button type="submit" variant="danger">Withdraw application</Button></div>
    </form>
  </Card>
{/if}

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 0;
  }
</style>
