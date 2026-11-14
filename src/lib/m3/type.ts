/**
 * `cn()` can't tell that two custom `type-*` utilities conflict (and stylesheet order, not class
 * order, decides which wins), so components that set a default type style use this: the default
 * is dropped when the caller passes their own `type-{display|headline|title|body|label}-*` class.
 *
 *   class={cn(typeOr('type-title-md', className), 'text-on-surface', className)}
 */
const TYPE_STYLE = /(?:^|\s)type-(?:display|headline|title|body|label)-/;

export function typeOr(fallback: string, className: unknown): string {
	return typeof className === 'string' && TYPE_STYLE.test(className) ? '' : fallback;
}
