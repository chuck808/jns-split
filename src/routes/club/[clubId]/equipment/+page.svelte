<script lang="ts">
  import { activityLabel, sessionDate } from '#lib/training-sessions';
  let { data, form } = $props();
</script>

<svelte:head><title>Test equipment · JNS SPLIT</title></svelte:head>
<h1>Test equipment</h1>
<div class="notice">
  <strong>SIMULATED controller only</strong><span>
    Use fictional riders and test sessions. These credentials can resolve club tags and control
    isolated test lanes. They never operate timing hardware, enrol real participants or save
    results.
  </span>
</div>
{#if form?.message}<p class="feedback" class:error={!form.ok} role="status">{form.message}</p>{/if}
{#if form && 'credential' in form && form.credential}<section class="panel">
    <h2>Copy your test credential</h2>
    <label>Credential<input readonly value={form.credential} /></label>
    <p>
      Expires in 24 hours. Keep it out of Git, screenshots and shared logs. Revoke it below when
      finished.
    </p>
  </section>{/if}
<section class="panel">
  <h2>Connect a Core2 simulator</h2>
  <p>Endpoint: <code>{data.endpoint}</code></p>
  <p>
    For a local PC server, the Core2 needs the PC’s LAN IP address, not localhost. Instructions are
    included with the simulator firmware.
  </p>
  {#if data.sessions.items.length}<form method="POST" action="?/create">
      <label>
        Device name<input name="name" maxlength="60" required placeholder="Core2 desk test" />
      </label>
      <label>
        Planned test session<select name="sessionId">
          {#each data.sessions.items as session}<option value={session.id}>
              {session.name} · {activityLabel(session.activity)}
            </option>{/each}
        </select>
      </label>
      <label class="checkbox-label">
        <input type="checkbox" name="testOnly" value="yes" required />I am using fictional rider
        data for a simulated test.
      </label>
      <button>Create 24-hour test credential</button>
    </form>{:else}<p>Create a planned test session first.</p>{/if}
  <nav class="pagination" aria-label="Test session pages">
    {#if data.sessions.page > 1}<a href={`?page=${data.sessions.page - 1}`}>Previous</a>{/if}<span>
      Page {data.sessions.page} of {data.sessions.pages}
    </span>{#if data.sessions.page < data.sessions.pages}<a
        href={`?page=${data.sessions.page + 1}`}
      >
        Next
      </a>{/if}
  </nav>
  <p>
    Changing any session configuration or participant list invalidates its existing test
    credentials. Finish setting up the plan first, then issue a new credential. Devices for the same
    unchanged session share the same simulated lanes.
  </p>
</section>
<section class="panel">
  <h2>Recent test devices</h2>
  {#each data.devices as device}<article>
      <h3>{device.name}</h3>
      <p>Session: <a href={`/sessions/${device.session_id}`}>{device.session_id}</a></p>
      <p>{device.revoked ? 'Revoked' : 'Expiry'} · {sessionDate(device.expires_at)}</p>
      {#if !device.revoked}<form method="POST" action="?/revoke">
          <input type="hidden" name="deviceId" value={device.id} /><button>
            Revoke credential for {device.name}
          </button>
        </form>{/if}
    </article>{:else}<p>No test devices yet.</p>{/each}
</section>
