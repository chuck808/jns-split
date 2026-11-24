<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import PublicPage from '#lib/ui/PublicPage.svelte';
  let { data, form } = $props();
</script>

<svelte:head><title>Forgotten password · JNS SPLIT</title></svelte:head>

<PublicPage width="narrow">
  <h1>Forgotten password</h1>
  <Card>
    {#if data.configured}
      <p>Enter your account email and we’ll send a link to choose a new password.</p>
      <form method="POST" class="stack">
        <label>
          Email<input name="email" type="email" autocomplete="email" maxlength="254" required />
        </label>
        <Button type="submit" variant="primary" size="lg" full>Send reset link</Button>
      </form>
    {:else}
      <p>Password recovery isn’t set up on this installation.</p>
    {/if}
    {#if form?.message}<p role="status" class="feedback">{form.message}</p>{/if}
  </Card>
  <a class="center" href="/login">Back to sign in</a>
</PublicPage>

<style>
  h1 {
    margin: 0;
    text-align: center;
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
  .center {
    text-align: center;
    font-size: 0.875rem;
  }
</style>
