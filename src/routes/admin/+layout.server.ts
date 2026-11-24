import type { LayoutServerLoad } from './$types';
import { shellData } from '#lib/server/shell';
// Shell data only. Platform authority is still checked by each page load.
export const load: LayoutServerLoad = (event) => shellData(event, 'platform');
