<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import PublicPage from '#lib/ui/PublicPage.svelte';
  let { data, form } = $props();
</script>

<svelte:head><title>Sign in · JNS SPLIT</title></svelte:head>

<PublicPage width="narrow">
  <h1>Sign in</h1>
  <Card>
    {#if data.configured}
      <form method="POST" class="stack">
        <label>
          Email<input name="email" type="email" autocomplete="username" required maxlength="254" />
        </label>
        <label>
          Password<input
            name="password"
            type="password"
            autocomplete="current-password"
            required
            maxlength="1024"
          />
        </label>
        {#if form?.message}<p class="feedback error" role="alert">{form.message}</p>{/if}
        <Button type="submit" variant="primary" size="lg" full>Sign in</Button>
      </form>
      <div class="links">
        <a href="/forgot-password">Forgotten your password?</a>
        <a href="/signup">New here? Create an account</a>
      </div>
    {:else}
      <p>
        This installation isn’t connected to a database yet. Add your Supabase settings and apply
        the migrations — see <code>docs/supabase-setup.md</code>.
      </p>
      <p class="note">The bench simulator still works without one.</p>
    {/if}
  </Card>
  <p class="note">
    Invited by your club? Create an account with the email they used. Riders don’t need an account
    to ride.
  </p>
  <a class="center" href="/bench">Open the bench simulator</a>
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
  .links {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    font-size: 0.875rem;
  }
  .note {
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted);
    text-align: center;
  }
  .center {
    text-align: center;
    font-size: 0.875rem;
  }
</style>
