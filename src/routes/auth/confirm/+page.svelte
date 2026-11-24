<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import PublicPage from '#lib/ui/PublicPage.svelte';
  let { data, form } = $props();
  const kind = $derived(form?.kind ?? data.kind);
</script>

<svelte:head>
  <title>{kind === 'signup' ? 'Confirm your email' : 'Confirm password reset'} · JNS SPLIT</title>
  <meta name="referrer" content="same-origin" />
</svelte:head>

<PublicPage width="narrow">
  <h1>{kind === 'signup' ? 'Confirm your email' : 'Reset your password'}</h1>
  <Card>
    {#if data.ready && !form?.message}
      <p>
        {kind === 'signup'
          ? 'One more step: confirm this is your email address and you’ll be signed in.'
          : 'Continue to check your email link and choose a new password.'}
      </p>
      <form method="POST">
        <Button type="submit" variant="primary" size="lg" full>
          {kind === 'signup' ? 'Confirm and sign in' : 'Continue'}
        </Button>
      </form>
    {:else}
      <p role="alert">
        {form?.message ??
          'This link is missing or has expired. Open the newest email we sent, or ask for another.'}
      </p>
    {/if}
  </Card>
  {#if kind === 'signup'}
    <a class="center" href="/signup">Send another confirmation link</a>
  {:else}
    <a class="center" href="/forgot-password">Send another reset link</a>
  {/if}
</PublicPage>

<style>
  h1 {
    margin: 0;
    text-align: center;
  }
  .center {
    text-align: center;
    font-size: 0.875rem;
  }
</style>
