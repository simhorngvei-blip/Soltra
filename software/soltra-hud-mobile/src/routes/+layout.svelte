<script lang="ts">
	import { fade, slide } from "svelte/transition";
	import "./layout.css";
	import "iconify-icon";
	import { mqttStatus } from "$lib/mqttStore";
	import { onMount, onDestroy } from "svelte";
	import { App as CapacitorApp } from '@capacitor/app';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';

	let { data, children } = $props();

	let isOnline = $state(true);
	let showExitConfirm = $state(false);

	function handleOnline() { isOnline = true; }
	function handleOffline() { isOnline = false; }

	onMount(() => {
		isOnline = navigator.onLine;
		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		CapacitorApp.addListener('backButton', ({ canGoBack }) => {
			const currentPath = get(page).url.pathname;
			if (currentPath !== '/') {
				window.history.back();
			} else {
				showExitConfirm = true;
			}
		});
	});

	onDestroy(() => {
		window.removeEventListener("online", handleOnline);
		window.removeEventListener("offline", handleOffline);
		CapacitorApp.removeAllListeners();
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

	{#if showExitConfirm}
		<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md" transition:fade={{ duration: 200 }}>
			<div class="bg-bg/95 border border-[#ff2a2a]/30 border-t-4 border-t-[#ff2a2a] p-6 w-[400px] text-center z-[101]" transition:slide>
				<h2 class="text-[#ff2a2a] text-xl font-anton tracking-widest mb-4">SYSTEM SHUTDOWN</h2>
				<p class="text-white text-sm font-mono mb-6">Are you sure you want to exit the Soltra HUD?</p>
				<div class="flex gap-4">
					<button onclick={() => CapacitorApp.exitApp()} class="flex-1 bg-[#ff2a2a] text-white py-2 font-anton tracking-widest hover:bg-white hover:text-[#ff2a2a] transition-colors cursor-pointer">
						CONFIRM
					</button>
					<button onclick={() => showExitConfirm = false} class="flex-1 bg-transparent border border-primary/40 text-primary py-2 font-anton tracking-widest hover:bg-primary/20 transition-colors cursor-pointer">
						CANCEL
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
