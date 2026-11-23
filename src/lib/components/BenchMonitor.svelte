<script lang="ts">
  import { decisionLabel, type BenchSnapshot } from '#lib/bench-monitor';
  import { activityLabel } from '#lib/training-sessions';
  let { clubId, choices }: { clubId: string; choices: { id: string; name: string }[] } = $props();
  let selected = $state('');
  let snapshot = $state<BenchSnapshot | null>(null);
  let message = $state('Choose a session to watch.');
  let stale = $state(false);
  let paused = $state(false);
  let refresh = $state(0);
  const clock = (value: string) => new Date(value).toLocaleTimeString();
  $effect(() => {
    const sessionId = selected,
      club = clubId;
    void refresh;
    snapshot = null;
    stale = false;
    if (!sessionId) {
      message = 'Choose a session to watch.';
      return;
    }
    let stopped = false,
      terminal = false,
      polling = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    async function poll() {
      if (stopped || terminal || polling || document.hidden) return;
      polling = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10000);
      try {
        const response = await fetch(
          `/club/${club}/equipment/live?${new URLSearchParams({ sessionId })}`,
          { signal: controller.signal, cache: 'no-store' }
        );
        if (stopped) return;
        if (!response.ok) {
          if ([401, 403, 404].includes(response.status)) {
            snapshot = null;
            terminal = true;
          }
          throw new Error(
            response.status === 401
              ? 'Signed out. Sign in again to resume.'
              : [403, 404].includes(response.status)
                ? 'Access removed or session unavailable.'
                : 'Refresh failed. Check your connection and migration 008.'
          );
        }
        const next: BenchSnapshot = await response.json();
        if (stopped) return;
        if (next.simulated !== true || next.session.id !== sessionId)
          throw new Error('Unexpected monitor response.');
        snapshot = next;
        stale = false;
        message = 'Refreshing every 3 seconds while this tab is visible.';
      } catch (e) {
        if (!stopped) {
          stale = true;
          message =
            (e as Error).name === 'AbortError'
              ? 'Refresh timed out. Last snapshot may be out of date.'
              : (e as Error).message;
        }
      } finally {
        clearTimeout(timeout);
        polling = false;
        if (!stopped && !terminal && !document.hidden) timer = setTimeout(poll, 3000);
      }
    }
    function visibility() {
      paused = document.hidden;
      clearTimeout(timer);
      if (!document.hidden) void poll();
    }
    paused = document.hidden;
    message = 'Loading simulated lanes…';
    void poll();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', visibility);
    };
  });
</script>

<section class="panel">
  <div class="section-heading"><h2>Live test lanes <span class="pill">SIMULATED</span></h2></div>
  <p>
    View the server’s test-lane state. No real hardware status, attendance or timing results are
    shown.
  </p>
  <label>
    Watch a test session<select bind:value={selected}>
      <option value="">Choose a session</option>{#each choices as choice}<option value={choice.id}>
          {choice.name}
        </option>{/each}
    </select>
  </label>
  <p role="status" class:error={stale}>
    {paused ? 'Updates paused while this tab is hidden.' : message}
  </p>
  {#if selected}<button onclick={() => refresh++}>Reconnect / refresh now</button>{/if}
  {#if snapshot}
    <p>
      <strong>{snapshot.session.name}</strong> · {activityLabel(snapshot.session.activity)} · {snapshot
        .session.status}
    </p>
    <p>
      Last successful refresh: {clock(snapshot.observed_at)} (your local time){stale
        ? ' — OUT OF DATE'
        : ''}.
    </p>
    {#if snapshot.usable_credentials === 0}<div class="notice">
        No usable test credentials for the current plan. Lanes below are retained test state, not
        active equipment. Issue a fresh credential after completing session setup.
      </div>{/if}
    <div class="lanes" class:outdated={stale || snapshot.usable_credentials === 0}>
      {#each snapshot.lanes as lane}<article class="lane-card" class:assigned={!!lane.rider_name}>
          <h3>Lane {lane.lane}</h3>
          <span class="pill">
            {!lane.enabled
              ? 'Disabled'
              : lane.running
                ? 'Simulated running'
                : lane.rider_name
                  ? 'Checked in (test)'
                  : 'Awaiting scan'}
          </span>
          <p>
            {lane.rider_name ?? 'No rider assigned'}{lane.archived ? ' · Rider now archived' : ''}
          </p>
        </article>{/each}
    </div>
    <h3>Recent test responses</h3>
    <p>
      Latest 20 retained requests. Replayed requests are not new events. Invalid credentials, rate
      limits and changed-session responses are not stored here.
    </p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Time</th><th>Device / lane</th><th>Response</th></tr></thead><tbody>
          {#each snapshot.events as event}<tr>
              <td>
                {event.created_at ? clock(event.created_at) : 'Before timestamps were enabled'}
              </td>
              <td>
                {event.device_name} · Lane {event.lane}<small class="block">
                  {event.action}{event.session_version !== snapshot.session.version
                    ? ' · Earlier plan version'
                    : ''}
                </small>
              </td>
              <td>
                {decisionLabel(event.code)}{#if event.rider_name}<small class="block">
                    {event.rider_name}
                  </small>{/if}
              </td>
            </tr>{/each}
        </tbody>
      </table>
    </div>
    {#if !snapshot.events.length}<p>No retained test responses for this session yet.</p>{/if}
    <p class="caption">
      This is a temporary diagnostic view, not an audit history. Provisioning a device cleans up
      expired/revoked credentials and their test responses. A usable credential does not prove a
      Core2 is online.
    </p>
  {/if}
</section>

<style>
  .outdated {
    opacity: 0.65;
  }
</style>
