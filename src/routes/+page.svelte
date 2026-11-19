<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Button } from 'flowbite-svelte';
  import {
    createSession,
    configure,
    enrol,
    scan,
    clearLane,
    arm,
    finish,
    comparable,
    speed,
    csv,
    parseScan,
    type Scan,
    type StartMode
  } from '#lib/session';
  import { connectReader } from '#lib/serial';
  let session = $state(createSession());
  let tab = $state('Live session');
  let feedback = $state('Ready for your first test scan.');
  let failed = $state(false);
  let lane = $state(1),
    uid = $state('04112233445566'),
    name = $state('');
  let count = $state(2),
    distance = $state(20),
    mode = $state<StartMode>('Flying');
  let times = $state<Record<number, number>>({ 1: 3.4, 2: 3.7, 3: 4.1, 4: 3.9 });
  let unit = $state<'km/h' | 'mph'>('km/h'),
    selectedRider = $state('r1');
  let serialStatus = $state('USB reader disconnected.');
  let stopSerial: (() => Promise<void>) | undefined;
  let connected = $state(false),
    connecting = $state(false),
    pasted = $state('');
  let lastScan = $state<Scan | null>(null);
  let recent = $state<{ text: string; ok: boolean }[]>([]);
  let ready = $derived(session.lanes.filter((l) => l.riderId).length);
  let history = $derived(comparable(session, selectedRider));
  let best = $derived(history.length ? Math.min(...history.map((r) => r.elapsedUs!)) / 1e6 : null);
  let mean = $derived(
    history.length ? history.reduce((sum, r) => sum + r.elapsedUs!, 0) / history.length / 1e6 : null
  );
  const riderName = (id: string | null) =>
    session.riders.find((r) => r.id === id)?.name ?? 'Waiting for tag';
  function act(fn: () => void) {
    failed = false;
    try {
      fn();
    } catch (e) {
      feedback = (e as Error).message;
      failed = true;
    }
  }
  function accept(e: Scan) {
    lastScan = e;
    const r = scan(session, e);
    session = r.session;
    feedback = r.decision.message;
    failed = !r.decision.accepted;
    recent = [{ text: feedback, ok: r.decision.accepted }, ...recent].slice(0, 8);
  }
  function tap() {
    act(() =>
      accept({
        version: 1,
        type: 'scan',
        requestId: crypto.randomUUID(),
        readerId: 'simulator',
        lane: Number(lane),
        uid
      })
    );
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([csv(session.results)], { type: 'text/csv;charset=utf-8' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jns-split-SIMULATED-results.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  async function connect() {
    connecting = true;
    try {
      stopSerial = await connectReader(accept, (m) => {
        serialStatus = m;
        if (m === 'USB reader disconnected.') connected = false;
      });
      connected = true;
    } catch (e) {
      serialStatus = (e as Error).message;
    } finally {
      connecting = false;
    }
  }
  async function disconnect() {
    await stopSerial?.();
    stopSerial = undefined;
    connected = false;
  }
  onDestroy(() => {
    void stopSerial?.();
  });
</script>

<svelte:head>
  <title>JNS SPLIT · Test workspace</title><meta
    name="description"
    content="JNS SPLIT sports timing development workspace. Simulate lane check-ins and test RFID readers."
  />
</svelte:head>
<div class="app-shell">
  <aside>
    <a class="brand" href="/" aria-label="JNS Split home">
      <img src="/favicon.svg" alt="" /><span><small>JNS</small><strong>SPLIT</strong></span>
    </a>
    <p class="workspace-label">CLUB WORKSPACE</p>
    <div class="club">
      <span class="avatar">JC</span>
      <div>JNS Test Club<small>Development workspace</small></div>
    </div>
    <nav aria-label="Workspace">
      {#each ['Live session', 'Riders & tags', 'Results', 'Equipment'] as item}<button
          class:active={tab === item}
          onclick={() => (tab = item)}
        >
          {item}
        </button>{/each}
    </nav>
    <div class="side-bottom">
      <span class="pill">PROTOTYPE 0.1</span>
      <p>Every effort counts.</p>
      <small>Test data only · No cloud sync</small>
    </div>
  </aside>
  <main>
    <header>
      <div>
        <span class="eyebrow">COACH / TEST CLUB</span>
        <h1>{tab}</h1>
      </div>
      <span class="pill lime">Bench mode</span>
    </header>
    <div class="notice">
      <strong>Simulator workspace</strong><span>
        No timing controller or Supabase connection. Results are simulated and held in this tab
        only. Refresh clears them.
      </span>
    </div>
    {#if tab === 'Live session'}
      <section class="session-top">
        <div>
          <span class="eyebrow">SESSION SETUP</span>
          <h2>{session.distance}m · {session.mode} start</h2>
          <p>
            Run {session.run} · {session.lanes.length} lanes · {session.phase === 'Armed'
              ? 'Assignments locked'
              : 'Tap a tag before every effort'}
          </p>
        </div>
        <div class="ready-count">
          <strong>{ready}<span>/{session.lanes.length}</span></strong><small>
            riders checked in
          </small>
        </div>
      </section>
      <div class="lanes">
        {#each session.lanes as l}<article class="lane-card" class:assigned={!!l.riderId}>
            <div class="card-top">
              <span>LANE {l.number}</span><span class="pill">
                {session.phase === 'Armed' ? 'Locked' : l.riderId ? 'Checked in' : 'Awaiting tap'}
              </span>
            </div>
            <div class="lane-number">{String(l.number).padStart(2, '0')}</div>
            <h2>{riderName(l.riderId)}</h2>
            <p>
              {l.riderId ? 'Assigned in the simulator' : 'Rider checks in at this lane’s reader'}
            </p>
            {#if session.phase === 'Armed'}<label>
                Simulated elapsed time (s)<input
                  type="number"
                  min="0.001"
                  max="300"
                  step="0.001"
                  bind:value={times[l.number]}
                />
              </label>{:else}<button
                class="text-button"
                disabled={!l.riderId}
                onclick={() =>
                  act(() => {
                    session = clearLane(session, l.number);
                    feedback = 'Lane cleared.';
                  })}
              >
                Clear assignment
              </button>{/if}
          </article>{/each}
      </div>
      <div class="run-controls">
        {#if session.phase === 'Collecting'}<Button
            color="alternative"
            class="primary-action"
            disabled={ready !== session.lanes.length}
            onclick={() =>
              act(() => {
                session = arm(session);
                feedback = 'Simulator armed. Rider assignments and settings are frozen.';
              })}
          >
            Arm simulated run
          </Button>
          <p>All enabled lanes must have a rider.</p>{:else}<Button
            color="alternative"
            class="primary-action"
            onclick={() =>
              act(() => {
                session = finish(session, times, 'Completed');
                feedback = 'Simulated results recorded. Fresh scans required.';
              })}
          >
            Record simulated finishes
          </Button><button
            onclick={() =>
              act(() => {
                session = finish(session, {}, 'DNF');
                feedback = 'Run recorded as DNF. Fresh scans required.';
              })}
          >
            Mark all DNF
          </button><button
            onclick={() =>
              act(() => {
                session = finish(session, {}, 'Cancelled');
                feedback = 'Run cancelled. Fresh scans required.';
              })}
          >
            Cancel run
          </button>{/if}
      </div>
      <div class="feedback" class:error={failed} role="status">{feedback}</div>
      <div class="two-columns">
        <section class="panel">
          <h2>Simulate a reader tap</h2>
          <p>Try a known tag, an unknown tag or an occupied lane.</p>
          <div class="form-row">
            <label>
              Lane<select bind:value={lane}>
                {#each session.lanes as l}<option value={l.number}>Lane {l.number}</option>{/each}
              </select>
            </label><label>
              Tag<select bind:value={uid}>
                {#each session.riders as r}<option value={r.uid}>{r.name}</option>{/each}<option
                  value="DEADBEEF"
                >
                  Unknown tag
                </option>
              </select>
            </label>
          </div>
          <button class="solid" onclick={tap}>Tap selected tag</button>{#if lastScan}<button
              onclick={() => act(() => accept(lastScan!))}
            >
              Replay last request
            </button>{/if}
        </section>
        <section class="panel">
          <h2>Session configuration</h2>
          <p>Clear all assignments before changing the setup.</p>
          <div class="form-row">
            <label>
              Lanes<select bind:value={count}>
                {#each [1, 2, 3, 4] as n}<option value={n}>{n}</option>{/each}
              </select>
            </label><label>
              Distance (m)<input type="number" min="1" max="1000" bind:value={distance} />
            </label><label>
              Start<select bind:value={mode}>
                <option>Flying</option><option>Standing</option>
              </select>
            </label>
          </div>
          <button
            disabled={ready > 0 || session.phase === 'Armed'}
            onclick={() =>
              act(() => {
                session = configure(session, Number(count), Number(distance), mode);
                lane = 1;
                feedback = 'Setup updated.';
              })}
          >
            Apply setup
          </button>
        </section>
      </div>
    {:else if tab === 'Riders & tags'}
      <section class="panel">
        <h2>Register a test rider</h2>
        <p>The club assigns a tag once. Each subsequent tap looks up that rider.</p>
        <form
          onsubmit={(e) => {
            e.preventDefault();
            act(() => {
              session = enrol(session, name, uid);
              name = '';
              feedback = 'Test rider registered.';
            });
          }}
        >
          <div class="form-row">
            <label>
              Test display name<input
                required
                maxlength="60"
                bind:value={name}
                placeholder="Alex (test)"
              />
            </label><label>
              Full tag UID<input required bind:value={uid} placeholder="04:11:22:33:44:55:66" />
            </label>
          </div>
          <button class="solid" disabled={session.phase === 'Armed'}>Register test rider</button>
        </form>
        <div class="feedback" class:error={failed} role="status">{feedback}</div>
      </section>
      <section class="panel">
        <h2>Club test roster <span class="count">{session.riders.length}</span></h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Rider</th><th>Tag identifier</th><th>Club</th></tr></thead><tbody>
              {#each session.riders as r}<tr>
                  <td>{r.name}</td><td><code>{r.uid}</code></td><td>JNS Test Club</td>
                </tr>{/each}
            </tbody>
          </table>
        </div>
      </section>
    {:else if tab === 'Results'}
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>Personal progress</h2>
            <p>Comparable efforts only: {session.distance}m · {session.mode} start.</p>
          </div>
          <label>
            Rider<select bind:value={selectedRider}>
              {#each session.riders as r}<option value={r.id}>{r.name}</option>{/each}
            </select>
          </label>
        </div>
        <div class="metrics">
          <div>
            <span>Session best</span><strong>{best?.toFixed(3) ?? '—'}<small> s</small></strong>
          </div>
          <div>
            <span>Session average</span><strong>{mean?.toFixed(3) ?? '—'}<small> s</small></strong>
          </div>
          <div><span>Completed efforts</span><strong>{history.length}</strong></div>
        </div>
        {#if history.length}<div class="bars" aria-label="Elapsed times by run; shorter is faster">
            {#each history as r}<div class="bar-row">
                <span>Run {r.run}</span>
                <div class="track">
                  <div
                    class="bar"
                    style:width={`${(r.elapsedUs! / Math.max(...history.map((v) => v.elapsedUs!))) * 100}%`}
                  ></div>
                </div>
                <strong>{(r.elapsedUs! / 1e6).toFixed(3)} s</strong>
              </div>{/each}
          </div>
          <p class="caption">Elapsed time by run · shorter is faster · simulated data</p>{:else}<div
            class="empty"
          >
            Complete a simulated run to see progress here.
          </div>{/if}
      </section>
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>Session results</h2>
            <p>Average speed over the configured distance, not peak speed.</p>
          </div>
          <div class="form-row">
            <label>
              Speed units<select bind:value={unit}>
                <option>km/h</option><option>mph</option>
              </select>
            </label><button disabled={!session.results.length} onclick={download}>
              Export CSV
            </button>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Run / rider</th><th>Lane</th><th>Setup</th><th>Outcome</th><th>Time</th><th>
                  Avg speed
                </th>
              </tr>
            </thead><tbody>
              {#each [...session.results].reverse() as r}<tr>
                  <td><small>Run {r.run}</small>{r.riderName}</td><td>{r.lane}</td><td>
                    {r.distance}m · {r.mode}
                  </td><td>{r.outcome}</td><td>
                    {r.elapsedUs !== null ? (r.elapsedUs / 1e6).toFixed(3) + ' s' : '—'}
                  </td><td>
                    {speed(r, unit)?.toFixed(2) ?? '—'}
                    {speed(r, unit) !== null ? unit : ''}
                  </td>
                </tr>{/each}
            </tbody>
          </table>
        </div>
        {#if !session.results.length}<div class="empty">
            No results yet. Start in Live session.
          </div>{/if}
      </section>
    {:else}
      <section class="panel">
        <span class="eyebrow">FIRST HARDWARE TEST</span>
        <h2>Core2 + Unit RFID2</h2>
        <p>
          Connect the reader to Core2 Port A and flash the bench firmware. USB scans feed this
          simulator only; the Core2 never receives a real lane acceptance.
        </p>
        <div class="equipment-status">{serialStatus}</div>
        <button class="solid" disabled={connected || connecting} onclick={connect}>
          {connecting ? 'Connecting…' : 'Connect USB reader'}
        </button><button disabled={!connected} onclick={disconnect}>Disconnect</button>
        <p class="caption">
          Desktop Chrome or Edge · HTTPS or localhost · close PlatformIO Serial Monitor first.
        </p>
        {#if lastScan}<div class="scan-detail">
            <strong>Last tag: {lastScan.uid}</strong>
            <p>Lane {lastScan.lane} · Reader {lastScan.readerId}</p>
            <button
              onclick={() => {
                uid = lastScan!.uid;
                tab = 'Riders & tags';
              }}
            >
              Use UID for registration
            </button>
          </div>{/if}
      </section>
      <section class="panel">
        <h2>Paste a bench scan</h2>
        <p>Alternatively, copy one JSON scan line from the serial monitor.</p>
        <label>
          Reader JSON<textarea
            rows="4"
            bind:value={pasted}
            placeholder={'{"version":1,"type":"scan","readerId":"core2-bench","requestId":"boot-1","lane":1,"uid":"04112233445566"}'}
          ></textarea>
        </label><button onclick={() => act(() => accept(parseScan(pasted)))}>
          Process scan in simulator
        </button>
        <div class="feedback" class:error={failed} role="status">{feedback}</div>
      </section>
      <section class="panel">
        <h2>Recent check-ins</h2>
        {#each recent as item}<p class="event" class:error={!item.ok}>{item.text}</p>{:else}<p>
            No check-ins yet.
          </p>{/each}
      </section>
    {/if}
    <footer>JNS SPLIT <span>Sports timing · Every effort counts.</span></footer>
  </main>
</div>
