<script lang="ts">
	import { fade } from "svelte/transition";
	import { onMount } from "svelte";
	import { initMqtt, closeMqtt } from "$lib/mqttStore";
	import "./layout.css";
	import "iconify-icon";

	let { data, children } = $props();

	onMount(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden') {
				closeMqtt();
			} else {
				initMqtt();
			}
		};
		document.addEventListener('visibilitychange', handleVisibilityChange);
		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});
</script>

<svelte:head>
	<title>Soltra Overseer HUD</title>
</svelte:head>

<div class="h-screen w-screen relative overflow-hidden bg-bg">
	{#key data.url}
		<div in:fade={{ duration: 400, delay: 100 }} out:fade={{ duration: 300 }} class="absolute inset-0 z-10 w-full h-full">
			{@render children()}
		</div>
	{/key}
</div>
