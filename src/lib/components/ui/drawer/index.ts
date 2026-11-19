import { Drawer as DrawerPrimitive } from 'vaul-svelte';
import Content from './drawer-content.svelte';
import Description from './drawer-description.svelte';
import Header from './drawer-header.svelte';

/*
 * shadcn's Drawer (vaul-svelte), restyled as the arcade's bottom sheet. vaul's defaults are the
 * modal sheet: a scrim, a focus trap, drag down or tap the scrim to dismiss. The title takes the
 * content's colour.
 */
const { Root, Title } = DrawerPrimitive;

export { Root, Content, Header, Title, Description };
