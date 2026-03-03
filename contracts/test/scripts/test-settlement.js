// ccwg/contracts/test-settlement.js

import { Account, RpcProvider, hash, ec } from "starknet";
import dotenv from "dotenv";

dotenv.config();

const required = ["STARKNET_RPC_URL", "SERVER_ACCOUNT_ADDRESS", "SERVER_PRIVATE_KEY"];
for (const k of required) {
  if (!process.env[k]) throw new Error(`Missing env var: ${k}`);
}

// Normalize env values (fixes common Windows/.env quoting + whitespace issues)
const clean = (s) => String(s).trim().replace(/^["']|["']$/g, "");

const RPC_URL = clean(process.env.STARKNET_RPC_URL);
const SERVER_ACCOUNT_ADDRESS = clean(process.env.SERVER_ACCOUNT_ADDRESS);
const SERVER_PRIVATE_KEY = clean(process.env.SERVER_PRIVATE_KEY);

const isHex = (v) => /^0x[0-9a-fA-F]+$/.test(v);
if (!isHex(SERVER_ACCOUNT_ADDRESS)) {
  throw new Error(`SERVER_ACCOUNT_ADDRESS must be hex like 0xabc..., got: ${SERVER_ACCOUNT_ADDRESS}`);
}
if (!isHex(SERVER_PRIVATE_KEY)) {
  throw new Error(`SERVER_PRIVATE_KEY must be hex like 0xabc..., got: ${SERVER_PRIVATE_KEY}`);
}

async function testSettlement() {
  // Provider (explicit nodeUrl removes the “default public node url” warning)
  const provider = new RpcProvider({ nodeUrl: RPC_URL });

  // Optional: create Account instance (safe construction style)
  // (Account API supports an object constructor in v9 docs.) :contentReference[oaicite:1]{index=1}
  const serverAccount = new Account({
    provider,
    address: SERVER_ACCOUNT_ADDRESS,
    signer: SERVER_PRIVATE_KEY,
  });

  console.log("Server account loaded:", serverAccount.address);

  // Test data
  const matchId = 1n;
  const winner = "0x123";
  const p1RoundsWon = 2;
  const p2RoundsWon = 1;
  const transcriptHash = "0xabc123";

  // Poseidon hash (as you already do)
  const messageHash = hash.computePoseidonHashOnElements([
    matchId.toString(),
    winner,
    p1RoundsWon.toString(),
    p2RoundsWon.toString(),
    transcriptHash,
  ]);

  console.log("Message hash:", messageHash);

  // ✅ Correct way to sign a raw Starknet hash:
  // use Stark curve sign on the hash (per Starknet.js Signature guide). :contentReference[oaicite:2]{index=2}
  const signature = ec.starkCurve.sign(messageHash, SERVER_PRIVATE_KEY);

  console.log("Signature generated:", signature); // { r, s } (or array form depending on version)
  console.log("✅ Settlement signing works!");
}

testSettlement().catch(console.error);
