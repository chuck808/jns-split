<script lang="ts">
  let { form } = $props();
</script>

<svelte:head><title>Choose a password · JNS SPLIT</title></svelte:head>
<main class="account-page">
  <section class="panel auth-panel">
    <h1>Choose a new password</h1>
    <p>
      Use at least 12 characters and follow any additional requirements set by your administrator.
    </p>
    <form method="POST">
      <label>
        New password<input
          name="password"
          type="password"
          autocomplete="new-password"
          minlength="12"
          maxlength="1024"
          required
        />
      </label><label>
        Confirm new password<input
          name="confirmation"
          type="password"
          autocomplete="new-password"
          minlength="12"
          maxlength="1024"
          required
        />
      </label><button class="solid">Save password</button>
    </form>
    {#if form?.message}<p class="feedback error" role="alert">{form.message}</p>{/if}
  </section>
</main>
