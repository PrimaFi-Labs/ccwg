/**
 * Shared StarkNet / Dojo utilities for server-side route handlers.
 *
 * FIXED (round 5): Address comparison now uses normalizeFelt() which strips
 * leading zeros after "0x" before comparing. This resolves the silent mismatch
 * between EVENT_SYSTEM_ADDRESS ("0x05b238e4...") and the receipt value
 * ("0x5b238e4...") that caused all three extraction strategies to skip the
 * EventCreatedEvent and return undefined.
 */

import {
  Account,
  CallData,
  RpcProvider,
  CairoCustomEnum,
  cairo,
  validateAndParseAddress,
} from 'starknet';
import {
  EVENT_SYSTEM_ADDRESS,
  ESCROW_SYSTEM_ADDRESS,
  MARKET_SYSTEM_ADDRESS,
  ROOM_SYSTEM_ADDRESS,
} from '@/src/types/contracts';

const DEFAULT_RPC = 'https://api.cartridge.gg/x/starknet/sepolia';

// ---------------------------------------------------------------------------
// Felt / address normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes a StarkNet felt or address for reliable equality comparison.
 *
 * StarkNet tools inconsistently zero-pad addresses:
 *   "0x05b238e4..."  (sozo / constants)
 *   "0x5b238e4..."   (RPC receipts / Voyager)
 *
 * Both represent the same felt252 value. Strip leading zeros after "0x"
 * and lowercase so all comparisons are canonical.
 *
 * Examples:
 *   "0x05b238e4..."  → "0x5b238e4..."
 *   "0x5b238e4..."   → "0x5b238e4..."
 *   "0x0"            → "0x0"
 */
function normalizeFelt(value?: string): string {
  if (!value) return '';
  const lower = value.toLowerCase().trim();
  if (!lower.startsWith('0x')) return lower;
  const hex = lower.slice(2).replace(/^0+/, '') || '0';
  return `0x${hex}`;
}

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

export function normalizeEnv(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'null') return undefined;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const unquoted = trimmed.slice(1, -1).trim();
    return unquoted || undefined;
  }
  return trimmed;
}

export function getRpcUrl(): string {
  return (
    normalizeEnv(process.env.RPC_URL) ||
    normalizeEnv(process.env.NEXT_PUBLIC_RPC_URL) ||
    normalizeEnv(process.env.NEXT_PUBLIC_STARKNET_RPC_URL) ||
    DEFAULT_RPC
  );
}

export function getServerAddress(): string | undefined {
  return normalizeEnv(process.env.SERVER_ACCOUNT_ADDRESS);
}

export function getServerPrivateKey(): string | undefined {
  return (
    normalizeEnv(process.env.SERVER_ACCOUNT_PRIVATE_KEY) ||
    normalizeEnv(process.env.SERVER_PRIVATE_KEY)
  );
}

/**
 * The Dojo world contract address.
 * All world.emit_event and world.write_model Starknet events are emitted FROM here.
 * Confirmed from error logs across this project.
 */
export function getWorldAddress(): string {
  return (
    normalizeEnv(process.env.WORLD_ADDRESS) ||
    normalizeEnv(process.env.NEXT_PUBLIC_WORLD_ADDRESS) ||
    '0x7f3647c6cb682cdf2cc02f6348d24a8929f5f4c5d9c56159a80425c42fe9004'
  );
}

// ---------------------------------------------------------------------------
// Provider / account factory
// ---------------------------------------------------------------------------

export function buildProvider(): RpcProvider {
  return new RpcProvider({ nodeUrl: getRpcUrl() });
}

export function buildServerAccount(provider: RpcProvider): Account {
  const privateKey = getServerPrivateKey();
  const address = getServerAddress();

  if (!privateKey || !address) {
    throw new Error(
      `Missing server account credentials ` +
        `(address=${Boolean(address)}, privateKey=${Boolean(privateKey)})`
    );
  }

  return new Account({
    provider,
    address: validateAndParseAddress(address),
    signer: privateKey,
  });
}

// ---------------------------------------------------------------------------
// createEventOnChain
// ---------------------------------------------------------------------------

export interface CreateEventParams {
  eventName: string;
  entryFee: string;
  maxPlayers: number;
  startsAtIso: string;
  prizeDistribution: [number, number, number];
}

export interface CreateEventResult {
  onChainId: number;
  txHash: string;
}

export interface CreateRoomOnChainParams {
  roomId: number;
  host: string;
  stakeFee: string;
  maxPlayers: number;
  matchesPerPlayer: number;
  totalRounds: number;
}

export interface UpsertMarketItemOnChainParams {
  itemId: number;
  name: string;
  itemType: 'single_card' | 'pack';
  priceStrk: string;
  cardsGranted: number;
  perWalletLimit: number;
  isActive: boolean;
}

export interface UpsertMarketItemCardConfigOnChainParams {
  itemId: number;
  index: number;
  templateId: number;
  guaranteed: boolean;
  weight: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) return raw.slice(start, i + 1);
  }
  return null;
}

function parseErrorJson(error: unknown): unknown {
  if (isRecord(error) && 'execution_error' in error) {
    return error;
  }

  const message = toErrorMessage(error);
  const fromInline = extractFirstJsonObject(message);
  if (!fromInline) return null;

  try {
    return JSON.parse(fromInline);
  } catch {
    return null;
  }
}

function buildStarknetDebugReport(
  operation: string,
  details: Record<string, unknown>,
  error: unknown
): string {
  const parsed = parseErrorJson(error);
  const report = {
    type: 'STARKNET_CALL_FAILURE',
    operation,
    at: new Date().toISOString(),
    ...details,
    error_message: toErrorMessage(error),
    parsed_error: parsed,
  };
  return JSON.stringify(report, null, 2);
}

/**
 * Submits a `create_event` transaction to the Dojo world and extracts the
 * new event_id from the transaction receipt.
 *
 * ### Confirmed Dojo v1.x receipt structure (from two real transactions)
 *
 * Every create_event call emits 5 world-contract events + 1 STRK fee transfer:
 *
 *  [0] StoreSetRecord — IdCounter
 *      data: ["0x1", "0x2",  "0x1", <new_counter>]
 *            keys_len=1, key=2 (storage slot), vals_len=1, counter_value
 *
 *  [1] StoreSetRecord — GameEvent           ← event_id in data[1], vals_len=0xb=11
 *  [2] StoreSetRecord — EventPrizeDistribution ← event_id in data[1], vals_len=3
 *  [3] StoreSetRecord — EventParticipantsList  ← event_id in data[1], vals_len=1
 *
 *  [4] EventCreatedEvent (world.emit_event)
 *      keys: [EventCreatedEvent_sel, event_type_hash, EVENT_SYSTEM_ADDRESS]
 *      data: ["0x1", <event_id>, "0x5", event_name, fee_low, fee_high, max_players, starts_at]
 *
 *  [5] STRK Transfer (from_address = STRK token — unrelated)
 *
 * ### The root cause of the persistent failure
 *
 * `EVENT_SYSTEM_ADDRESS` is defined with a leading zero: "0x05b238e4..."
 * The RPC receipt returns the same address without it:  "0x5b238e4..."
 * `.toLowerCase()` does not strip padding, so the string comparison always
 * returns false and Strategy 1 never matches. Fixed by normalizeFelt().
 */
export async function createEventOnChain(
  params: CreateEventParams
): Promise<CreateEventResult> {
  const startsAt = Math.floor(new Date(params.startsAtIso).getTime() / 1000);
  if (!Number.isFinite(startsAt) || startsAt <= 0) {
    throw new Error('Invalid starts_at for on-chain create_event');
  }

  const provider = buildProvider();
  const serverAccount = buildServerAccount(provider);

  const eventNameFelt = `evt_${params.eventName}`.slice(0, 31);

  const calldata = CallData.compile({
    event_name: eventNameFelt,
    entry_fee: cairo.uint256(BigInt(params.entryFee)),
    max_players: params.maxPlayers,
    starts_at: BigInt(startsAt),
    prize_distribution: {
      first: params.prizeDistribution[0],
      second: params.prizeDistribution[1],
      third: params.prizeDistribution[2],
    },
  });

  const tx = await serverAccount.execute({
    contractAddress: EVENT_SYSTEM_ADDRESS,
    entrypoint: 'create_event',
    calldata,
  });

  const receipt = await provider.waitForTransaction(tx.transaction_hash, {
    retryInterval: 2_000,
    successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1'],
  });

  const worldAddress = getWorldAddress();
  const onChainId = extractEventIdFromReceipt(receipt, worldAddress, EVENT_SYSTEM_ADDRESS);

  if (onChainId === undefined || !Number.isFinite(onChainId) || onChainId <= 0) {
    const events = 'events' in receipt ? receipt.events : [];
    console.error(
      '[createEventOnChain] Failed to extract event_id. Full receipt events:\n',
      JSON.stringify(events, null, 2)
    );
    throw new Error(
      `Failed to derive on-chain event id from receipt ${tx.transaction_hash}. ` +
        `Receipt events logged above.`
    );
  }

  return { onChainId, txHash: tx.transaction_hash };
}

export async function cancelEventOnChain(eventId: number): Promise<string> {
  const calldata = CallData.compile({
    event_id: eventId,
  });
  return executeServerCall(EVENT_SYSTEM_ADDRESS, 'cancel_event', calldata);
}

async function executeServerCall(
  contractAddress: string,
  entrypoint: string,
  calldata: ReturnType<typeof CallData.compile>
): Promise<string> {
  const provider = buildProvider();
  const serverAccount = buildServerAccount(provider);

  const tx = await serverAccount.execute({
    contractAddress,
    entrypoint,
    calldata,
  });

  await provider.waitForTransaction(tx.transaction_hash, {
    retryInterval: 2_000,
    successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1'],
  });

  return tx.transaction_hash;
}

export async function createRoomOnChain(params: CreateRoomOnChainParams): Promise<string> {
  const request = {
    room_id: params.roomId,
    host: validateAndParseAddress(params.host),
    stake_fee: cairo.uint256(BigInt(params.stakeFee)),
    max_players: params.maxPlayers,
    matches_per_player: params.matchesPerPlayer,
    total_rounds: params.totalRounds,
  };
  const calldata = CallData.compile(request);

  try {
    return await executeServerCall(ROOM_SYSTEM_ADDRESS, 'create_room', calldata);
  } catch (error) {
    throw new Error(
      buildStarknetDebugReport(
        'create_room',
        {
          contract_address: ROOM_SYSTEM_ADDRESS,
          entrypoint: 'create_room',
          expected_signature:
            'create_room(room_id: u128, host: ContractAddress, stake_fee: u256, max_players: u16, matches_per_player: u16, total_rounds: u8)',
          request,
          calldata,
        },
        error
      )
    );
  }
}

export async function joinRoomOnChain(roomId: number, player: string): Promise<string> {
  const calldata = CallData.compile({
    room_id: roomId,
    player: validateAndParseAddress(player),
  });
  return executeServerCall(ROOM_SYSTEM_ADDRESS, 'join_room', calldata);
}

export async function leaveRoomOnChain(roomId: number, player: string): Promise<string> {
  const calldata = CallData.compile({
    room_id: roomId,
    player: validateAndParseAddress(player),
  });
  return executeServerCall(ROOM_SYSTEM_ADDRESS, 'leave_room', calldata);
}

export async function startRoomOnChain(roomId: number): Promise<string> {
  const calldata = CallData.compile({ room_id: roomId });
  return executeServerCall(ROOM_SYSTEM_ADDRESS, 'start_room', calldata);
}

export async function settleRoomOnChain(roomId: number, winner: string | null): Promise<string> {
  const zeroAddress = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const calldata = CallData.compile({
    room_id: roomId,
    winner: winner ? validateAndParseAddress(winner) : validateAndParseAddress(zeroAddress),
  });
  return executeServerCall(ROOM_SYSTEM_ADDRESS, 'settle_room', calldata);
}

export async function cancelRoomOnChain(roomId: number): Promise<string> {
  const calldata = CallData.compile({ room_id: roomId });
  return executeServerCall(ROOM_SYSTEM_ADDRESS, 'cancel_room', calldata);
}

/**
 * Server-initiated disbursement: calls escrow_system.server_disburse to
 * transfer STRK from the player's internal balance to their actual wallet.
 * Used for auto-withdraw after event and room settlement.
 */
export async function disburseOnChain(
  playerWallet: string,
  amountWei: bigint
): Promise<string> {
  const calldata = CallData.compile({
    player: validateAndParseAddress(playerWallet),
    amount: cairo.uint256(amountWei),
  });
  return executeServerCall(ESCROW_SYSTEM_ADDRESS, 'server_disburse', calldata);
}

export async function upsertMarketItemOnChain(
  params: UpsertMarketItemOnChainParams
): Promise<string> {
  const safeName = params.name.replace(/[^a-zA-Z0-9_]/g, '_');
  // starknet.js v9 requires CairoCustomEnum for custom enum calldata.
  const itemTypeEnum = new CairoCustomEnum(
    params.itemType === 'pack' ? { Pack: {} } : { SingleCard: {} }
  );

  const calldata = CallData.compile({
    item_id: params.itemId,
    name: `item_${params.itemId}_${safeName}`.slice(0, 31),
    item_type: itemTypeEnum,
    price_strk: cairo.uint256(BigInt(params.priceStrk)),
    cards_granted: params.cardsGranted,
    per_wallet_limit: params.perWalletLimit,
    is_active: params.isActive,
  });

  return executeServerCall(MARKET_SYSTEM_ADDRESS, 'upsert_market_item', calldata);
}

export async function setMarketItemStatusOnChain(
  itemId: number,
  isActive: boolean
): Promise<string> {
  const calldata = CallData.compile({
    item_id: itemId,
    is_active: isActive,
  });
  return executeServerCall(MARKET_SYSTEM_ADDRESS, 'set_market_item_status', calldata);
}

export async function upsertMarketItemCardConfigOnChain(
  params: UpsertMarketItemCardConfigOnChainParams
): Promise<string> {
  const calldata = CallData.compile({
    item_id: params.itemId,
    index: params.index,
    template_id: params.templateId,
    guaranteed: params.guaranteed,
    weight: params.weight,
  });
  return executeServerCall(MARKET_SYSTEM_ADDRESS, 'upsert_item_card_config', calldata);
}

// ---------------------------------------------------------------------------
// Receipt event parsing
// ---------------------------------------------------------------------------

/**
 * Extracts the event_id from a Dojo v1.x transaction receipt.
 *
 * ### Dojo v1.x universal data envelope (write_model AND emit_event):
 *
 *   data[0]              = keys_len
 *   data[1..keys_len]    = #[key] field values  ← event_id = data[1] for single-key structs
 *   data[keys_len+1]     = values_len
 *   data[keys_len+2..]   = non-key field values
 *
 * ### Starknet event keys (Dojo routing metadata, NOT Cairo #[key] fields):
 *
 *   keys[0] = event-type selector or StoreSetRecord selector
 *   keys[1] = model/event-type hash
 *   keys[2] = emitting system address (emit_event only — absent on write_model)
 *
 * ### Three extraction strategies
 *
 * 1. PRIMARY — EventCreatedEvent:
 *    normalizeFelt(keys[2]) === normalizeFelt(EVENT_SYSTEM_ADDRESS)
 *    → data[1] is event_id
 *    Most precise: keys[2] is the emitting system, unique to emit_event calls.
 *
 * 2. SECONDARY — GameEvent StoreSetRecord:
 *    data[2] === 11  (GameEvent has exactly 11 serialized value felts)
 *    → data[1] is event_id
 *    Discriminates GameEvent from other 4-field events in the receipt.
 *
 * 3. TERTIARY — any single-key world event with data[1] > 2:
 *    Catches any remaining case. Guards against IdCounter (key=2, storage slot).
 */
function extractEventIdFromReceipt(
  receipt: Awaited<ReturnType<RpcProvider['waitForTransaction']>>,
  worldAddress: string,
  eventSystemAddress: string
): number | undefined {
  if (!('events' in receipt) || !Array.isArray(receipt.events)) return undefined;

  // Normalize once — strips leading zeros so "0x05b238..." === "0x5b238..."
  const normalizedWorld = normalizeFelt(worldAddress);
  const normalizedSystem = normalizeFelt(eventSystemAddress);

  // GameEvent has 11 serialized value felts:
  // event_name(1) + entry_fee u256(2) + max_players(1) + current_players(1)
  // + prize_pool u256(2) + status(1) + created_at(1) + starts_at(1) + ends_at(1) = 11
  const GAME_EVENT_VALUES_LEN = 11;

  let secondaryCandidate: number | undefined;
  let tertiaryCandidate: number | undefined;

  for (const ev of receipt.events) {
    const keys: string[] = ev.keys ?? [];
    const data: string[] = ev.data ?? [];

    // All events we care about come from the world contract
    if (normalizeFelt(ev.from_address) !== normalizedWorld) continue;

    // All target events have exactly 1 #[key] field → data[0] === "0x1"
    if (safeToNumber(data[0]) !== 1) continue;
    if (data.length < 3) continue; // need at least data[0], data[1], data[2]

    const candidateId = safeToNumber(data[1]);

    // ── Strategy 1 (primary): EventCreatedEvent ────────────────────────────
    // keys[2] = emitting system address, present only on world.emit_event calls.
    // Uses normalizeFelt() to handle leading-zero padding differences.
    if (keys.length >= 3 && normalizeFelt(keys[2]) === normalizedSystem) {
      if (isPlausibleId(candidateId)) {
        return candidateId; // Highest confidence — return immediately
      }
    }

    // ── Strategy 2 (secondary): GameEvent StoreSetRecord ──────────────────
    // Identified by its unique values_len of 11 (data[2] = "0xb").
    if (safeToNumber(data[2]) === GAME_EVENT_VALUES_LEN && secondaryCandidate === undefined) {
      if (isPlausibleId(candidateId)) {
        secondaryCandidate = candidateId;
      }
    }

    // ── Strategy 3 (tertiary): any plausible single-key world event ────────
    // Skips IdCounter (data[1]="0x2", its storage slot key) via the > 2 guard.
    if (
      tertiaryCandidate === undefined &&
      isPlausibleId(candidateId) &&
      candidateId > 2
    ) {
      tertiaryCandidate = candidateId;
    }
  }

  return secondaryCandidate ?? tertiaryCandidate;
}

function safeToNumber(hex?: string): number | undefined {
  if (!hex) return undefined;
  try {
    const n = Number(BigInt(hex));
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

function isPlausibleId(value: number | undefined): value is number {
  return value !== undefined && value > 0 && value < 10_000_000;
}
