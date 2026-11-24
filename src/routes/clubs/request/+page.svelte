<script lang="ts">
  import ApplicationList from '#lib/components/ApplicationList.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  let { data, form } = $props();
</script>

<svelte:head><title>Register a club · JNS SPLIT</title></svelte:head>

<PageHeader
  eyebrow="Club registration"
  title="Register your club"
  description="We check every club before it goes live. When it’s approved, this account becomes the club’s first administrator."
/>

<div class="two">
  <Card title="Club details">
    {#if !data.verified}
      <p class="notice">
        Your email needs confirming before you can apply. Ask the person who runs your pilot to
        help.
      </p>
    {:else}
      <form method="POST" class="stack">
        <input type="hidden" name="requestId" value={form?.draft?.requestId ?? data.requestId} />
        <label>
          Club name<input
            name="clubName"
            maxlength="100"
            required
            value={form?.draft?.clubName ?? ''}
          />
        </label>
        <label>
          Town or region<input
            name="town"
            maxlength="100"
            required
            value={form?.draft?.town ?? ''}
          />
        </label>
        <label>
          Your name<input
            name="applicantName"
            maxlength="100"
            required
            autocomplete="name"
            value={form?.draft?.applicantName ?? ''}
          />
        </label>
        <p class="note">Contact email: <strong>{data.email}</strong> (from your account)</p>
        <label class="checkbox-label">
          <input
            type="checkbox"
            name="authorised"
            value="yes"
            required
            checked={form?.draft?.authorised ?? false}
          />I’m allowed to register this club on its behalf.
        </label>
        {#if form?.message}<p class="feedback error" role="alert">{form.message}</p>{/if}
        <div><Button type="submit" variant="primary">Submit for review</Button></div>
      </form>
    {/if}
  </Card>

  <Card title="Good to know">
    <ul class="points">
      <li>BMX clubs only during the pilot.</li>
      <li>We don’t ask for rider details, payment or safeguarding documents here.</li>
      <li>You can have one application waiting at a time.</li>
      <li>No emails are sent yet — check this page for the decision.</li>
    </ul>
  </Card>
</div>

<Card title="Your applications">
  <ApplicationList list={data.list} status={data.filters.status} />
</Card>

<style>
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }
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
  .note {
    font-size: 0.875rem;
    color: var(--muted);
  }
  .points {
    margin: 0;
    padding-left: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.9375rem;
  }
  @media (max-width: 860px) {
    .two {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
