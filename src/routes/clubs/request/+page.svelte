<script lang="ts">
  import ApplicationList from '#lib/components/ApplicationList.svelte';
  let { data, form } = $props();
</script>

<svelte:head><title>Register a club · JNS SPLIT</title></svelte:head>
<main class="account-page wide">
  <span class="eyebrow">CLUB REGISTRATION</span>
  <h1>Apply to register your club</h1>
  <p>
    We review each application before creating a club workspace. Approval makes this signed-in
    account the club's first administrator.
  </p>
  <a class="text-link" href="/app?choose=1">Back to workspaces</a>
  <section class="panel">
    <h2>Club details</h2>
    <p>This pilot supports BMX clubs. Do not include rider details or safeguarding documents.</p>
    <p>Account contact: {data.email}</p>
    {#if form?.message}<p class="feedback error" role="alert">{form.message}</p>{/if}
    {#if !data.verified}<p class="notice">
        Your email must be confirmed before you can apply. Ask the pilot operator to help with your
        account setup.
      </p>{:else}
      <form method="POST">
        <input type="hidden" name="requestId" value={form?.draft?.requestId ?? data.requestId} />
        <label>
          Your name<input
            name="applicantName"
            maxlength="100"
            required
            autocomplete="name"
            value={form?.draft?.applicantName ?? ''}
          />
        </label>
        <label>
          Club name<input
            name="clubName"
            maxlength="100"
            required
            value={form?.draft?.clubName ?? ''}
          />
        </label>
        <label>
          Town / region<input
            name="town"
            maxlength="100"
            required
            value={form?.draft?.town ?? ''}
          />
        </label>
        <label class="checkbox-label">
          <input
            type="checkbox"
            name="authorised"
            value="yes"
            required
            checked={form?.draft?.authorised ?? false}
          />I am authorised to apply on behalf of this club.
        </label>
        <button class="solid">Submit for review</button>
      </form>{/if}
    <p class="caption">
      One application may await review at a time. Status and decisions appear here; no application
      emails are sent in this pilot.
    </p>
  </section>
  <section class="panel">
    <h2>Your applications</h2>
    <ApplicationList list={data.list} status={data.filters.status} />
  </section>
</main>
