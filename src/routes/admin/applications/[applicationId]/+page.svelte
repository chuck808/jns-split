<script lang="ts">
  import ApplicationSummary from '#lib/components/ApplicationSummary.svelte';
  let { data, form } = $props();
</script>

<svelte:head><title>Review club application · JNS SPLIT</title></svelte:head>
<main class="account-page wide">
  <span class="eyebrow">PLATFORM ADMINISTRATION</span>
  <h1>Review application</h1>
  <a href="/admin">Back to applications</a>
  {#if form?.message}<p class="feedback" class:error={!form.ok} role="status">
      {form.message}
    </p>{/if}
  <ApplicationSummary detail={data.detail} />
  {#if data.detail.matchingClubs.length}<section class="notice">
      <strong>Existing clubs with the same name</strong>
      <div>
        {#each data.detail.matchingClubs as club}<p>{club.name} · {club.id}</p>{/each}
        <p>
          Check whether this is a duplicate before approving. No clubs or accounts will be merged
          automatically.
        </p>
      </div>
    </section>{/if}
  {#if data.detail.application.status === 'submitted'}<section class="panel">
      <h2>Decision</h2>
      <p>
        Approval creates a new club and gives the applicant account its first administrator role.
        The decision reason is visible to the applicant.
      </p>
      <form method="POST" action="?/review">
        <label>
          Decision<select name="decision">
            <option value="">Choose a decision</option><option value="approve">
              Approve registration
            </option><option value="decline">Decline registration</option>
          </select>
        </label>
        <label>
          Reason<textarea
            name="reason"
            minlength="3"
            maxlength="500"
            required
            value={form?.reason ?? ''}></textarea>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="confirm" value="yes" required />I have checked the
          application and confirm this decision.
        </label><button class="solid">Save decision</button>
      </form>
    </section>{:else}<p>This application is complete. Its decision cannot be overwritten.</p>{/if}
</main>
