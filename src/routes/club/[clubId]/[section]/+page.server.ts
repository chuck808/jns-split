import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireAdmin } from '#lib/server/access';
const content: Record<string, { title: string; description: string }> = {
  coaches: {
    title: 'Coaches',
    description:
      'Coach invitations and explicit session permissions are the next stage. Coach access is not enabled yet.'
  },
  sessions: {
    title: 'Sessions',
    description:
      'Session setup and recorded results are upcoming. Use the separate bench simulator for test runs.'
  },
  equipment: {
    title: 'Equipment',
    description:
      'Controller provisioning and live equipment status are upcoming. USB tag capture is available in Riders & tags.'
  }
};
export const load: PageServerLoad = async (event) => {
  await requireAdmin(event, event.params.clubId);
  const section = content[event.params.section];
  if (!section) error(404, 'Page not found.');
  return { section };
};
