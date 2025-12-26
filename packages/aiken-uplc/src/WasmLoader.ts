/**
 * Type definitions for WASM module interface
 * 
 * @packageDocumentation
 */

/**
 * WASM module interface for Aiken UPLC evaluator
 */
export interface WasmModule {
  eval_phase_two_raw(
    tx_bytes: Uint8Array,
    utxos_x: Array<Uint8Array>,
    utxos_y: Array<Uint8Array>,
    cost_mdls: Uint8Array,
    initial_budget_n: bigint,
    initial_budget_d: bigint,
    slot_x: bigint,
    slot_y: bigint,
    slot_z: number
  ): Array<Uint8Array>
}
