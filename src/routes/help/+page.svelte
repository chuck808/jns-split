<svelte:head><title>Help · JNS SPLIT</title></svelte:head>
<main class="public-page">
  <h1>Getting started</h1>
  <section class="panel">
    <h2>Club registration</h2>
    <ol>
      <li>Sign in using the account provisioned for you.</li>
      <li>Create your pilot club or open your existing club.</li>
      <li>Register a fictional rider. A tag can be added later.</li>
      <li>Issue a full tag UID, then refresh to check that it saved.</li>
    </ol>
    <h2>Reader testing</h2>
    <p>
      Use the bench simulator with the Core2 USB reader, or paste a scan line. Close Serial Monitor
      before connecting through the browser. USB reading needs a supported desktop browser.
    </p>
    <p>
      A captured UID is not confirmation of a lane assignment. The pilot club register is not yet
      connected to the live timing controller.
    </p>
    <a class="text-link" href="/bench">Open bench simulator</a>
    <h2>Having trouble signing in?</h2>
    <p>
      Check that you saved your local settings and restarted the development server. Your account
      must belong to the same Supabase project as the app.
    </p>
    <a class="text-link" href="/forgot-password">Request a password reset</a>
  </section>
</main>
