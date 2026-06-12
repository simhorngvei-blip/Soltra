<script lang="ts">
	import { fade, slide } from "svelte/transition";
	import "./layout.css";
	import "iconify-icon";
	import { mqttStatus } from "$lib/mqttStore";
	import { onMount, onDestroy } from "svelte";

	let { data, children } = $props();

	let isOnline = $state(true);

	function handleOnline() { isOnline = true; }
	function handleOffline() { isOnline = false; }

	onMount(() => {
		isOnline = navigator.onLine;
		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
	});

	onDestroy(() => {
		window.removeEventListener("online", handleOnline);
		window.removeEventListener("offline", handleOffline);
	});
</script>

<svelte:head>
	<title>Soltra Overseer HUD</title>
</svelte:head>

<div class="h-full w-full relative overflow-hidden bg-bg">
	{#if !isOnline || $mqttStatus !== 'CONNECTED'}
		<div transition:slide class="absolute top-0 left-0 w-full z-50 bg-[#ff2a2a] text-white text-center py-2 font-anton tracking-widest text-sm flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,42,42,0.5)]">
			<iconify-icon icon="lucide:wifi-off"></iconify-icon>
			{!isOnline ? "OFFLINE MODE - WAITING FOR NETWORK" : "MQTT DISCONNECTED - RECONNECTING..."}
		</div>
	{/if}

	{#key data.url}
		<div in:fade={{ duration: 400, delay: 100 }} out:fade={{ duration: 300 }} class="absolute inset-0 z-10 w-full h-full">
			{@render children()}
		</div>
	{/key}
</div>
