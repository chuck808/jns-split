import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
// The old club list is replaced by the workspace chooser, which lists clubs,
// coaching and platform roles together and re-checks access.
export const load: PageServerLoad = () => redirect(303, '/app');
