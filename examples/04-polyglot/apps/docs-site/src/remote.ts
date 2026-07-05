import { defineSvelteRemote } from '@jorvel/adapter-svelte';
import Root from './Root.svelte';

// Exposed as './App' — the host embeds this via the JORVEL mount contract.
export default defineSvelteRemote(Root);
