<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import PublicPage from '#lib/ui/PublicPage.svelte';
  let { data, form } = $props();
</script>

<svelte:head>
  <title>Confirm password reset · JNS SPLIT</title><meta name="referrer" content="same-origin" />
</svelte:head>

<PublicPage width="narrow">
  <h1>Reset your password</h1>
  <Card>
    {#if data.ready && !form?.message}
      <p>Continue to check your email link and choose a new password.</p>
      <form method="POST">
        <Button type="submit" variant="primary" size="lg" full>Continue</Button>
      </form>
    {:else}
      <p role="alert">
        {form?.message ?? 'This link is missing or has expired. Ask for a new reset email.'}
      </p>
    {/if}
  </Card>
  <a class="center" href="/forgot-password">Send another link</a>
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
