<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head><title>Your clubs · JNS SPLIT</title></svelte:head>
<main class="account-page wide">
  <header>
    <a class="brand" href="/">
      <img src="/favicon.svg" alt="" /><span><small>JNS</small><strong>SPLIT</strong></span>
    </a>
    <form method="POST" action="/logout"><button>Sign out</button></form>
  </header>
  <span class="eyebrow">CLUB ADMINISTRATION</span>
  <h1>Your club workspace</h1>
  <p>Signed in as {data.email}</p>
  {#if data.message}<div class="feedback error" role="alert">{data.message}</div>{/if}
  {#if form?.message}<div class="feedback error" role="alert">{form.message}</div>{/if}
  {#each data.clubs as club}<a class="panel club-link" href={`/club/${club.id}`}>
      <h2>{club.name}</h2>
      <p>Manage the rider register and RFID tags</p>
    </a>{/each}
  {#if !data.hasMembership && !data.message}
    <section class="panel">
      <h2>Set up your club</h2>
      <p>
        This creates a club and makes your account its first administrator. Riders will be
        registered by the club.
      </p>
      <form method="POST" action="?/create">
        <label>
          Club name<input name="name" maxlength="100" required placeholder="Your club name" />
        </label><button class="solid">Create club</button>
      </form>
    </section>
  {:else if !data.clubs.length && !data.message}
    <section class="panel">
      <h2>Administrator access needed</h2>
      <p>
        Your account has a membership, but this first workspace is for club administrators. Coach
        access will be added with session permissions.
      </p>
    </section>
  {/if}
  <a class="text-link" href="/bench">Open bench simulator</a>
</main>
