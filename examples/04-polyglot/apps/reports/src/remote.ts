import 'zone.js';
import { defineAngularRemote } from '@jorvel/adapter-angular';
import { RootComponent } from './root.component';

// Exposed as './App' — the host embeds this via the JORVEL mount contract.
export default defineAngularRemote(RootComponent);
