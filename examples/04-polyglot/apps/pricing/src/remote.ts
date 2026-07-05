import { defineVueRemote } from '@jorvel/adapter-vue';
import Root from './Root.vue';

// Exposed as './App' — the host embeds this via the JORVEL mount contract.
export default defineVueRemote(Root);
