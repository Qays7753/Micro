/** Browser composition root for persistence; no React component imports IndexedDB directly. */
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import type { PrototypeLocalStore } from "./types";

export function createBrowserLocalStore(): PrototypeLocalStore { return new IndexedDbLocalStore(); }
