<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head>
  <title>Confirm password reset · JNS SPLIT</title><meta name="referrer" content="no-referrer" />
</svelte:head>
<main class="account-page">
  <section class="panel auth-panel">
    <h1>Reset your password</h1>
    {#if data.ready && !form?.message}<p>
        Continue to verify your email link and choose a new password.
      </p>
      <form method="POST"><button class="solid">Continue to reset password</button></form>{:else}<p
        role="alert"
      >
        {form?.message ?? 'This link is missing or has expired. Request a new reset email.'}
      </p>{/if}<a class="text-link" href="/forgot-password">Request another link</a>
  </section>
</main>
