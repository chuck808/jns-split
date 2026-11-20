<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head><title>Club sign-in · JNS SPLIT</title></svelte:head>
<main class="account-page">
  <a class="brand" href="/">
    <img src="/favicon.svg" alt="" /><span><small>JNS</small><strong>SPLIT</strong></span>
  </a>
  <section class="panel auth-panel">
    <span class="eyebrow">CLUB WORKSPACE</span>
    <h1>Welcome back.</h1>
    {#if data.configured}
      <p>Sign in with your club administrator account.</p>
      <form method="POST">
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
        <button class="solid">Sign in</button>
      </form>
      {#if form?.message}<p class="feedback error" role="alert">{form.message}</p>{/if}
      <a class="text-link" href="/forgot-password">Forgotten your password?</a>
      <p class="caption">
        Accounts are provisioned for club staff. Riders do not need an account to train. Contact the
        person managing your club’s system if you need access.
      </p>
    {:else}
      <p>
        Club registration is ready to connect. Add your Supabase project settings and apply the
        database migration using <code>docs/supabase-setup.md</code>.
      </p>
      <div class="notice">No backend is configured. The bench simulator is still available.</div>
    {/if}
    <a class="text-link" href="/bench">Open bench simulator</a>
  </section>
</main>
