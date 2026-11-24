<script lang="ts">
  import StatusChip from '#lib/ui/StatusChip.svelte';
  let { status }: { status: string } = $props();
  const look: Record<string, ['neutral' | 'info' | 'success' | 'warn' | 'danger', string]> = {
    draft: ['neutral', 'Draft'],
    submitted: ['info', 'Waiting for review'],
    approved: ['success', 'Approved'],
    declined: ['warn', 'Declined'],
    withdrawn: ['neutral', 'Withdrawn']
  };
  const [tone, text] = $derived(look[status] ?? ['neutral', status]);
</script>

<StatusChip {tone}>{text}</StatusChip>
