import { Howl } from "howler";

export const appState = $state({
    isStarted: false,
    isMusicEnabled: true,
    isSFXEnabled: true,
    bgm: null as Howl | null
});
