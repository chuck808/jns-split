import type { LayoutServerLoad } from './$types';
import { shellData } from '#lib/server/shell';
export const load: LayoutServerLoad = (event) => shellData(event, 'coach');
