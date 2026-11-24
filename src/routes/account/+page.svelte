<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import CardGrid from '#lib/ui/CardGrid.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  let { data } = $props();
</script>

<svelte:head><title>Your account · JNS SPLIT</title></svelte:head>

<PageHeader eyebrow={data.email} title="Your account" />

{#if data.passwordUpdated}<p class="feedback" role="status">Your password has been updated.</p>{/if}

<CardGrid columns={2}>
  <Card title="Your roles">
    <p>
      One login can hold several roles — club admin, coach and more. Each one only gives access to
      what it has been granted.
    </p>
    <div><Button variant="primary" href="/app">Choose a workspace</Button></div>
  </Card>
  <Card title="Appearance">
    <p>
      Choose Light, Dark or Match device from the account menu at the top of the sidebar. It’s
      remembered on this browser.
    </p>
  </Card>
  <Card title="Password">
    <p>We’ll email you a link to choose a new one.</p>
    <div><Button href="/forgot-password">Send a reset link</Button></div>
  </Card>
  <Card title="Email and closing your account">
    <p>
      Changing your email or closing your account is handled by the person who runs your pilot for
      now.
    </p>
    <form method="POST" action="/logout"><Button type="submit">Sign out</Button></form>
  </Card>
</CardGrid>
