<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import PublicPage from '#lib/ui/PublicPage.svelte';
  let { form } = $props();
</script>

<svelte:head><title>Choose a password · JNS SPLIT</title></svelte:head>

<PublicPage width="narrow">
  <h1>New password</h1>
  <Card>
    <p class="note">At least 12 characters.</p>
    <form method="POST" class="stack">
      <label>
        New password<input
          name="password"
          type="password"
          autocomplete="new-password"
          minlength="12"
          maxlength="1024"
          required
        />
      </label>
      <label>
        Type it again<input
          name="confirmation"
          type="password"
          autocomplete="new-password"
          minlength="12"
          maxlength="1024"
          required
        />
      </label>
      {#if form?.message}<p class="feedback error" role="alert">{form.message}</p>{/if}
      <Button type="submit" variant="primary" size="lg" full>Save password</Button>
    </form>
  </Card>
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
  .note {
    font-size: 0.875rem;
    color: var(--muted);
  }
</style>
