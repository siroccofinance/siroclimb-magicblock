// Every account the game uses is a PDA derivable from the program id, so the
// whole state can be found without an indexer.
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { ATA_PROGRAM_ID, DELEGATION_PROGRAM_ID, PROGRAM_ID, ROUND_SLOTS, SESSION_PROGRAM_ID, TOKEN_PROGRAM_ID, VRF_PROGRAM_ID } from './config.js';

const pda = (seeds, program = PROGRAM_ID) => PublicKey.findProgramAddressSync(seeds, program)[0];
const s = (t) => Buffer.from(t);

export const configPda = () => pda([s('config')]);
export const faucetPda = (user) => pda([s('faucet'), user.toBuffer()]);
export const profilePda = (user) => pda([s('profile'), user.toBuffer()]);
export const runPda = (player) => pda([s('run'), player.toBuffer()]);
export const roundSlot = (id) => Number(BigInt(id) % BigInt(ROUND_SLOTS));
export const roundPda = (id) => pda([s('round'), Buffer.from([roundSlot(id)])]);
export const roundSlotPda = (slot) => pda([s('round'), Buffer.from([slot])]);

/// The identity PDA this program signs VRF requests with.
export const vrfIdentityPda = () => pda([s('identity')]);
/// The per-program VRF identity that signs our callbacks.
export const vrfCallbackIdentity = () => pda([s('identity'), PROGRAM_ID.toBuffer()], VRF_PROGRAM_ID);

export const sessionTokenPda = (sessionSigner, authority) =>
  pda([s('session_token_v2'), PROGRAM_ID.toBuffer(), sessionSigner.toBuffer(), authority.toBuffer()], SESSION_PROGRAM_ID);

export const ataOf = (owner, mint) => pda([owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()], ATA_PROGRAM_ID);

// Delegation program accounts for a delegated PDA.
export const bufferPda = (account) => pda([s('buffer'), account.toBuffer()], PROGRAM_ID);
export const delegationRecordPda = (account) => pda([s('delegation'), account.toBuffer()], DELEGATION_PROGRAM_ID);
export const delegationMetadataPda = (account) => pda([s('delegation-metadata'), account.toBuffer()], DELEGATION_PROGRAM_ID);
