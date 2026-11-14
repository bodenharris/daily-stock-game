<script lang="ts">
	/**
	 * One color role on its paired content role, with the live hex and the WCAG contrast ratio
	 * (read from the computed CSS vars, so it is right in whichever scheme the swatch sits).
	 */
	let {
		bg,
		fg,
		label,
		scheme
	}: {
		/** CSS var name of the container, e.g. `--md-sys-color-primary` */
		bg: string;
		/** CSS var name of the content color (optional) */
		fg?: string;
		label: string;
		/** Changes whenever the forced scheme changes, so the values are re-read. */
		scheme: string;
	} = $props();

	let hex = $state('');
	let ratio = $state<number | null>(null);

	function luminance(color: string) {
		const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
		if (!m) return null;
		const n = parseInt(m[1], 16);
		const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
			const c = v / 255;
			return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
	}

	function read(node: HTMLElement) {
		void scheme;
		// wait a frame so a scheme class toggled on <html> has been applied
		const raf = requestAnimationFrame(() => {
			const cs = getComputedStyle(node);
			hex = cs.getPropertyValue(bg).trim();
			const a = luminance(hex);
			const b = fg ? luminance(cs.getPropertyValue(fg).trim()) : null;
			ratio = a !== null && b !== null ? (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) : null;
		});
		return () => cancelAnimationFrame(raf);
	}
</script>

<div
	class="flex min-h-20 flex-col justify-between gap-2 rounded-m3-lg p-3"
	style:background-color="var({bg})"
	style:color={fg ? `var(${fg})` : undefined}
	style:box-shadow="inset 0 0 0 1px var(--md-sys-color-outline-variant)"
	{@attach read}
>
	<span class="type-label-lg-emphasized">{label}</span>
	<span class="flex items-center justify-between gap-2 type-label-sm type-numeric opacity-90">
		<span>{hex}</span>
		{#if ratio !== null}
			<span>{ratio.toFixed(1)}:1 {ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large' : 'fail'}</span>
		{/if}
	</span>
</div>
