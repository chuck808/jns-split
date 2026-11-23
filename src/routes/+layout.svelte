<script lang="ts">
  import '@fontsource-variable/inter';
  import '@fontsource/barlow-condensed/600.css';
  import '@fontsource/barlow-condensed/700.css';
  import '@fontsource/barlow-condensed/700-italic.css';
  import '../app.css';
  import { page } from '$app/state';
  import SiteHeader from '#lib/ui/SiteHeader.svelte';
  let { children, data } = $props();
  // Signed-in areas provide `shell` from their layout and render AppShell
  // themselves; everything else gets the public site header.
  const inApp = $derived(!!page.data.shell);
</script>

<a class="skip-link" href="#main">Skip to content</a>
{#if inApp}
  {@render children()}
{:else}
  <SiteHeader theme={data.theme} />
  <div id="main" tabindex="-1">{@render children()}</div>
{/if}
