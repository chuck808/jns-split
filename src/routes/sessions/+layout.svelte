<script lang="ts">
  import AppShell from '#lib/ui/AppShell.svelte';
  let { data, children } = $props();
</script>

<AppShell shell={data.shell} theme={data.theme} area="Session" context="Session view">
  {@render children()}
</AppShell>
