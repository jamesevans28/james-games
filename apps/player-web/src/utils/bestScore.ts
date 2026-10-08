// Moved to platform/storage/bestScore.ts (T4.4). Legacy games still import from
// here until they move onto the host in Phase 5; remove this shim in T5.13.
export { getBest, setBest } from "../platform/storage/bestScore";
