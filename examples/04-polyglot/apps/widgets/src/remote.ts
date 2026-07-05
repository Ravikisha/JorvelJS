import { defineSolidRemote } from '@jorvel/adapter-solid';
import Root from './Root';

// Exposed as './App' — the host embeds this via the JORVEL mount contract.
export default defineSolidRemote(Root);
