<script lang="ts">
  import AppShell from '#lib/ui/AppShell.svelte';
  let { data, children } = $props();
</script>

<AppShell shell={data.shell} theme={data.theme} area="Session">
  {@render children()}
</AppShell>
