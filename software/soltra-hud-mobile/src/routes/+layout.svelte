<script lang="ts">
	import { fade } from "svelte/transition";
	import "./layout.css";
	import "iconify-icon";

	let { data, children } = $props();
</script>

<svelte:head>
	<title>Soltra Overseer HUD</title>
</svelte:head>

<div class="h-full w-full relative overflow-hidden bg-bg">
	{#key data.url}
		<div in:fade={{ duration: 400, delay: 100 }} out:fade={{ duration: 300 }} class="absolute inset-0 z-10 w-full h-full">
			{@render children()}
		</div>
	{/key}
</div>
