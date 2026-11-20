<script lang="ts">
  let { data } = $props();
</script>

<svelte:head><title>Your account · JNS SPLIT</title></svelte:head>
<main class="account-page">
  <h1>Your account</h1>
  {#if data.passwordUpdated}<p class="feedback" role="status">
      Your password has been updated.
    </p>{/if}
  <section class="panel">
    <h2>Signed in as</h2>
    <p>{data.email}</p>
    <p>Your account can access only the clubs and records it has been authorised to use.</p>
    <a class="text-link" href="/club">Open your club workspace</a>
    <h2>Appearance</h2>
    <p>
      Use the theme selector at the top of any page. Your choice is remembered on this browser;
      System follows your device’s appearance.
    </p>
    <h2>Password</h2>
    <a class="text-link" href="/forgot-password">Send a password-reset email</a>
    <p>
      Email changes and account closure are currently handled by the person administering your
      pilot.
    </p>
    <form method="POST" action="/logout"><button>Sign out</button></form>
  </section>
</main>
