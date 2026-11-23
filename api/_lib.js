// Shared by the serverless routes.
import { Connection } from '@solana/web3.js';
import { BASE_RPC, ER_RPC } from '../js/chain/config.js';

export const baseConnection = () => new Connection(BASE_RPC, 'confirmed');
export const erConnection = () => new Connection(ER_RPC, 'confirmed');

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const s = Buffer.concat(chunks).toString('utf8');
  return s ? JSON.parse(s) : {};
}
