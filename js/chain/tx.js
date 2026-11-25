// Sending transactions the same way on Solana and on the rollup: sign, send
// without preflight, poll `getSignatureStatuses` (surfaces the program error
// with its logs), and resend a transaction devnet dropped once its blockhash
// has expired (the dropped copy can then never land, so nothing applies twice).
import { Transaction } from '@solana/web3.js';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class TxError extends Error {
  constructor(message, { sig, err, logs } = {}) { super(message); this.sig = sig; this.err = err; this.logs = logs || []; }
}

/// `signers[0]` pays. A signer is a Keypair, or a wallet `{ publicKey, signTransaction }`.
/// `expire: false` skips waiting for a dropped copy's blockhash to expire before signing afresh: only for
/// instructions that cannot apply twice (the program refuses a second cash out with BadStatus).
export async function send(connection, ixs, signers, { label = 'tx', attempts = 3, tries = 80, delayMs = 250, onSent, expire = true } = {}) {
  let last = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const tx = new Transaction().add(...ixs);
    tx.feePayer = signers[0].publicKey;
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    // Wallets sign first (some add instructions), then the local keys.
    let signed = tx;
    for (const s of signers.filter((x) => typeof x.signTransaction === 'function' && !x.secretKey)) signed = await s.signTransaction(signed);
    const keys = signers.filter((x) => x.secretKey);
    if (keys.length) signed.partialSign(...keys);
    const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true, maxRetries: 0 });
    last = sig;
    onSent && onSent(sig);
    const resendEvery = 2000; let lastResend = Date.now();
    for (let i = 0; i < tries; i++) {
      await sleep(delayMs);
      const { value } = await connection.getSignatureStatuses([sig]);
      const st = value[0];
      if (st && st.err) {
        const t = await connection.getTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' }).catch(() => null);
        const logs = (t && t.meta && t.meta.logMessages) || [];
        throw new TxError(`${label} failed: ${JSON.stringify(st.err)}`, { sig, err: st.err, logs });
      }
      if (st && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) return sig;
      if (!st && Date.now() - lastResend > resendEvery) { lastResend = Date.now(); connection.sendRawTransaction(signed.serialize(), { skipPreflight: true, maxRetries: 0 }).catch(() => {}); }
    }
    // Still unknown: wait until its blockhash can no longer land, then sign afresh.
    while (expire && (await connection.getBlockHeight('confirmed').catch(() => 0)) <= lastValidBlockHeight) {
      const { value } = await connection.getSignatureStatuses([sig]);
      const st = value[0];
      if (st && st.err) throw new TxError(`${label} failed: ${JSON.stringify(st.err)}`, { sig, err: st.err });
      if (st && (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized')) return sig;
      await sleep(1500);
    }
  }
  throw new TxError(`${label} not confirmed after ${attempts} attempts`, { sig: last });
}

/// The program's custom error code in a failed transaction, if any.
export function errorCode(e) {
  const m = /"Custom":(\d+)/.exec(String((e && e.message) || e));
  return m ? Number(m[1]) : null;
}
