<script lang="ts">
  import SessionFields from '#lib/components/SessionFields.svelte';
  import SessionList from '#lib/components/SessionList.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import ChoiceGroup from '#lib/ui/ChoiceGroup.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  let { data, form } = $props();
  let activity = $state('coached');
</script>

<svelte:head><title>Sessions · {data.club.name} · JNS SPLIT</title></svelte:head>

<PageHeader
  eyebrow={data.club.name}
  title="Sessions"
  description="Plan coached sessions and open practice. Timing and check-in at the lanes come later."
>
  {#snippet actions()}<Button variant="primary" href="#plan">Plan a session</Button>{/snippet}
</PageHeader>

<Card title="Club sessions">
  <SessionList list={data.list} status={data.filters.status} />
</Card>

<div id="plan">
  <Card title="Plan a session">
    <form method="POST" class="plan">
      <ChoiceGroup
        legend="Type of session"
        name="activity"
        variant="cards"
        bind:value={activity}
        options={[
          {
            value: 'coached',
            label: 'Coached session',
            description: 'Choose the riders taking part. They still scan for every effort.'
          },
          {
            value: 'free_ride',
            label: 'Open practice',
            description: 'Any active club rider with a tag can scan in. No list needed.'
          }
        ]}
      />
      <SessionFields />
      {#if form?.message}<p class="feedback error" role="alert">{form.message}</p>{/if}
      <div><Button type="submit" variant="primary">Save plan</Button></div>
    </form>
  </Card>
</div>

<style>
  .plan {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    margin: 0;
  }
  #plan {
    scroll-margin-top: 1rem;
  }
</style>
