import { theme } from '#lib/preferences';
export const load = ({ cookies }) => ({ theme: theme(cookies.get('theme')) });
