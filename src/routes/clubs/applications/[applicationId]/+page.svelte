<script lang="ts">
  import ApplicationSummary from '#lib/components/ApplicationSummary.svelte';
  let { data, form } = $props();
</script>

<svelte:head><title>Club application · JNS SPLIT</title></svelte:head>
<main class="account-page wide">
  <h1>Your club application</h1>
  <a href="/clubs/request">Back to your applications</a>
  {#if form?.message}<p class="feedback" class:error={!form.ok} role="status">
      {form.message}
    </p>{/if}
  <ApplicationSummary detail={data.detail} />
  {#if data.detail.application.status === 'submitted'}<p>
      Your application is awaiting platform review. No club workspace has been created yet. Refresh
      this page to check for a decision.
    </p>
    {#if data.detail.isApplicant}<details class="panel">
        <summary>Withdraw this application</summary>
        <form method="POST" action="?/withdraw">
          <label class="checkbox-label">
            <input type="checkbox" name="confirm" value="yes" required />Confirm withdrawal
          </label><button>Withdraw application</button>
        </form>
      </details>{/if}
  {:else if ['declined', 'withdrawn'].includes(data.detail.application.status)}<p>
      You can submit a new application when ready. This decision and its history remain unchanged.
    </p>{/if}
</main>
