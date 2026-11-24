<script lang="ts">
  let { data } = $props();
</script>

<svelte:head><title>Your clubs · JNS SPLIT</title></svelte:head>
<main class="account-page wide">
  <span class="eyebrow">CLUB ADMINISTRATION</span>
  <h1>Your club workspace</h1>
  <p>Signed in as {data.email}</p>
  <form method="POST" action="/logout"><button>Sign out</button></form>
  {#if data.message}<div class="feedback error" role="alert">{data.message}</div>{/if}
  {#if data.coachInvitations || data.coachLinks}<section class="panel">
      <h2>Your coach workspace</h2>
      <p>{data.coachInvitations} pending invitations · {data.coachLinks} approved club links</p>
      <a class="solid link-button" href="/coach">Open coach workspace</a>
    </section>{/if}
  {#each data.clubs as club}<a class="panel club-link" href={`/club/${club.id}`}>
      <h2>{club.name}</h2>
      <p>Manage the rider register and RFID tags</p>
    </a>{/each}
  <section class="panel">
    <h2>Register another club</h2>
    <p>Club registration now requires platform approval. Existing clubs remain available above.</p>
    <a class="text-link" href="/clubs/request">Apply or view your applications</a>
  </section>
  <a class="text-link" href="/coach">Open coach workspace and invitations</a>
  <a class="text-link" href="/bench">Open bench simulator</a>
</main>
