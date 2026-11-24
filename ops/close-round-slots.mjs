// Close the four retired round slots (round mode is gone) and hand their rent
// back to the deployer. Idempotent: a slot already closed is skipped, a slot
// still in use is refused by the program (SlotBusy).
//
//   node ops/close-round-slots.mjs
import { ROUND_SLOTS } from '../js/chain/config.js';
import { roundSlotPda } from '../js/chain/pdas.js';
import { ix } from '../js/chain/ix.js';
import { send } from '../js/chain/tx.js';
import { adminKeypair, baseConnection } from './lib/env.mjs';

const conn = baseConnection(), admin = adminKeypair();
const before = await conn.getBalance(admin.publicKey);
for (let slot = 0; slot < ROUND_SLOTS; slot++) {
  const key = roundSlotPda(slot);
  const a = await conn.getAccountInfo(key);
  if (!a) { console.log('slot', slot, key.toBase58(), 'already closed'); continue; }
  const sig = await send(conn, [ix.closeRoundSlot(admin.publicKey, slot)], [admin], { label: `close slot ${slot}` });
  console.log('slot', slot, key.toBase58(), 'closed', (a.lamports / 1e9).toFixed(6), 'SOL back', sig);
}
console.log('deployer', ((await conn.getBalance(admin.publicKey) - before) / 1e9).toFixed(6), 'SOL');
