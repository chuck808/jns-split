<script lang="ts">
  import '../app.css';
  import ThemeSelector from '#lib/components/ThemeSelector.svelte';
  let { children, data } = $props();
</script>

<a class="skip-link" href="#page-content">Skip to content</a>
<div class="site-toolbar">
  <a href="/" class="site-wordmark">JNS SPLIT</a>
  <nav aria-label="Main navigation">
    <a href="/club">Club workspace</a><a href="/about">About</a><a href="/help">Help</a><a
      href="/contact"
    >
      Contact
    </a><a href="/account">Account</a>
  </nav>
  <ThemeSelector value={data.theme} />
</div>
<div id="page-content" tabindex="-1">{@render children()}</div>
