<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head><title>Forgotten password · JNS SPLIT</title></svelte:head>
<main class="account-page">
  <section class="panel auth-panel">
    <h1>Forgotten password?</h1>
    <p>Enter your account email to request a reset link.</p>
    {#if data.configured}<form method="POST">
        <label>
          Email<input name="email" type="email" autocomplete="email" maxlength="254" required />
        </label><button class="solid">Request reset link</button>
      </form>{:else}<p>
        Account recovery is not configured on this installation.
      </p>{/if}{#if form?.message}<p role="status" class="feedback">{form.message}</p>{/if}<a
      class="text-link"
      href="/login"
    >
      Back to sign in
    </a>
  </section>
</main>
