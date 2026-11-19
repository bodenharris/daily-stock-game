import { Dialog as DialogPrimitive } from 'bits-ui';
import Content from './dialog-content.svelte';
import Description from './dialog-description.svelte';
import Header from './dialog-header.svelte';

// Title and Close need no styling of their own: the title takes the content's colour.
const { Root, Title, Close } = DialogPrimitive;

export { Root, Content, Header, Title, Description, Close };
