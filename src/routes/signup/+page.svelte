<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import PublicPage from '#lib/ui/PublicPage.svelte';
  let { data, form } = $props();
</script>

<svelte:head><title>Create an account · JNS SPLIT</title></svelte:head>

<PublicPage width="narrow">
  <h1>Create an account</h1>
  <Card>
    {#if !data.configured}
      <p>
        This installation isn’t connected to a database yet. See <code>
          docs/supabase-setup.md
        </code>.
      </p>
    {:else if form?.sent}
      <div class="stack">
        <p class="feedback" role="status">{form.message}</p>
        <form method="POST" action="?/resend" class="stack">
          <input type="hidden" name="email" value={form.email} />
          <Button type="submit">Send the link again</Button>
        </form>
        <a href="/signup">Use a different email</a>
      </div>
    {:else}
      <form method="POST" action="?/create" class="stack">
        <label>
          Email<input
            name="email"
            type="email"
            autocomplete="email"
            required
            maxlength="254"
            value={form?.email ?? ''}
          />
        </label>
        <p class="hint">If your club has invited you, use the same email address they used.</p>
        <label>
          Password<input
            name="password"
            type="password"
            autocomplete="new-password"
            required
            minlength="12"
            maxlength="1024"
            aria-describedby="password-hint"
          />
        </label>
        <p class="hint" id="password-hint">
          At least 12 characters. A few words together works well.
        </p>
        <label>
          Password again<input
            name="confirmation"
            type="password"
            autocomplete="new-password"
            required
            minlength="12"
            maxlength="1024"
          />
        </label>
        {#if form?.message}<p class="feedback error" role="alert">{form.message}</p>{/if}
        <Button type="submit" variant="primary" size="lg" full>Create account</Button>
      </form>
    {/if}
  </Card>
  <p class="note">
    An account is for people your club has invited (parents, guardians, riders and coaches) and for
    anyone registering a club. Riders don’t need one to ride.
  </p>
  <a class="center" href="/login">Already have an account? Sign in</a>
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
  .hint {
    margin: -0.6rem 0 0;
    font-size: 0.8125rem;
    color: var(--muted);
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
