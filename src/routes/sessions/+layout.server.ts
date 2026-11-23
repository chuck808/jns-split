import type { LayoutServerLoad } from './$types';
import { shellData } from '#lib/server/shell';
// The session view is shared by admins and assigned coaches; access is
// checked by the page itself.
export const load: LayoutServerLoad = (event) => shellData(event, null);
