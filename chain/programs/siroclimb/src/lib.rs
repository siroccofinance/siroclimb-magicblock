// Siroclimb on MagicBlock.
//
// Pick a market, go long or short: the coin climbs a staircase that follows
// the live price, leverage steps up from 1x to 4x every 6 seconds over a 60 s
// climb, and the player cashes out whenever they like. Solo climbs are played
// against the house; timed rounds put everyone on the same market for the
// same minute and split the pot 50 / 30 / 20.
//
// One line splits the program: money and reputation stay on Solana, the
// climb itself runs on an Ephemeral Rollup.
//
//   Solana (base)      test-USDC mint + faucet, house vault, stakes and round
//                      entries, settlement, player profiles, VRF draws (round
//                      markets, leverage packs). Nothing holding tokens is
//                      ever delegated.
//
//   Ephemeral Rollup   the live `Run` / `Round`: entry price, price ticks read
//                      from MagicBlock's Pyth Lazer feeds, leverage steps, the
//                      bust, the cash out (signed by a session key, no fee).
//                      The cash out commits and undelegates in the same
//                      transaction, and `settle_*` pays out on Solana.
use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;
use solana_sha256_hasher::hashv;

use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral, vrf, vrf_callback};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};
use ephemeral_rollups_sdk::vrf::instructions::{create_request_scoped_randomness_ix, RequestRandomnessParams};
use ephemeral_rollups_sdk::vrf::types::SerializableAccountMeta;
use magicblock_magic_program_api::{args::ScheduleTaskArgs, instruction::MagicBlockInstruction};
use session_keys::SessionTokenV2;

pub mod game;
pub mod hours;
pub mod token;
use game::*;
use token::*;

declare_id!("29sucV8aHGufy1AWrKzgp9gBPRHBG9jSxAsSWXe7M2ov");

pub const CONFIG_SEED: &[u8] = b"config";
pub const FAUCET_SEED: &[u8] = b"faucet";
pub const PROFILE_SEED: &[u8] = b"profile";
pub const RUN_SEED: &[u8] = b"run";
pub const ROUND_SEED: &[u8] = b"round";

pub const ONE_USDC: u64 = 1_000_000;
/// The faucet tops a wallet back up to this balance.
pub const FAUCET_TARGET: u64 = 1_000 * ONE_USDC;
pub const FAUCET_COOLDOWN: i64 = 30;
pub const MIN_STAKE: u64 = ONE_USDC;
pub const MAX_STAKE: u64 = 100 * ONE_USDC;
pub const ROUND_ENTRY: u64 = 10 * ONE_USDC;
/// A pack climb is played with this much of the house's money.
pub const PACK_STAKE: u64 = 10 * ONE_USDC;
pub const PACK_COOLDOWN: i64 = 10 * 60;
/// A VRF draw that never came back may be asked again after this long.
pub const VRF_RETRY: i64 = 60;
pub const ROUND_VRF_RETRY: i64 = 6;

/// A staked climb its player never started may be started by anyone after
/// this long, and refunded after `STALE_SECONDS`.
pub const BEGIN_GRACE: i64 = 10;
pub const STALE_SECONDS: i64 = 30;
/// A live climb whose ticks stopped can still be ended this long after the bell.
pub const FINISH_GRACE: i64 = 5;
/// A round slot whose results were not all written to profiles is held this long.
pub const RECORD_HOLD: i64 = 600;

/// MagicBlock's real-time pricing oracle (Pyth Lazer, pushed into the ERs).
pub const PRICE_ORACLE_PROGRAM_ID: Pubkey = pubkey!("PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd");
/// Price accounts, in asset order. The first four are MagicBlock's Pyth Lazer
/// feeds on the rollup, PDAs `["price_feed", "pyth-lazer", id]`:
/// TSLA (1435), NVDA (1314), AAPL (922) for the xStocks, XAU/USD (346) for gold.
/// GBP/USD is our relay account `["relay", 4]` (see `push_price`).
pub const FEEDS: [Pubkey; ASSETS] = [
    pubkey!("8L7ccCxTBZaLsMMdhAod5fFnpdEWGSDPW4y1td7y3y8N"),
    pubkey!("3AD13yFytFWiLQbcGsnEXDeWZ9GZezSx6Y3NqZRoJMaC"),
    pubkey!("B3P5AnSryJKeMk3FZcXsmpKVqoNmGYQE1rfE5KaoZNt1"),
    pubkey!("9Eko45pM9kMQpz9N5d6Rcki8FMKUeyFb1tWhvixhBHBn"),
    pubkey!("83aBQdu2PkVcuw8NUg6nnvSGgX13jvdCE7LidgNcUw21"),
];
pub const RELAY_SEED: &[u8] = b"relay";
/// A price older than this does not move a climb (it holds still), and a
/// climb cannot start on it (the market is closed).
pub const MAX_PRICE_AGE: i64 = 10;

pub const MAGIC_PROGRAM_ID: Pubkey = pubkey!("Magic11111111111111111111111111111111111111");
/// Crank period for scheduled ticks on the rollup.
pub const TICK_MILLIS: i64 = 500;

#[ephemeral]
#[program]
pub mod siroclimb {
    use super::*;

    // ================================================================ base layer

    /// Config PDA. The test-USDC mint (mint authority = config) and the vault
    /// (a token account owned by config: house bankroll and round pots) are
    /// created by the client in the same transaction; this checks and records them.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config_key = ctx.accounts.config.key();
        check_mint(&ctx.accounts.usdc_mint, &config_key)?;
        token_balance(&ctx.accounts.vault, &ctx.accounts.usdc_mint.key(), Some(&config_key))?;
        let c = &mut ctx.accounts.config;
        c.admin = ctx.accounts.admin.key();
        c.usdc_mint = ctx.accounts.usdc_mint.key();
        c.vault = ctx.accounts.vault.key();
        c.bump = ctx.bumps.config;
        Ok(())
    }

    /// Mint test USDC into the house vault (the bankroll solo climbs are paid from).
    pub fn fund_house(ctx: Context<FundHouse>, amount: u64) -> Result<()> {
        let seeds: &[&[u8]] = &[CONFIG_SEED, &[ctx.accounts.config.bump]];
        token_mint_to(
            &ctx.accounts.token_program,
            &ctx.accounts.usdc_mint,
            &ctx.accounts.vault,
            &ctx.accounts.config.to_account_info(),
            amount,
            seeds,
        )
    }

    /// Create one reusable round slot (round `n` lives in slot `n % ROUND_SLOTS`).
    pub fn init_round_slot(ctx: Context<InitRoundSlot>, slot: u8) -> Result<()> {
        require!((slot as u64) < ROUND_SLOTS, ClimbError::BadRound);
        let mut r = ctx.accounts.round.load_init()?;
        r.slot = slot;
        r.status = ROUND_FREE;
        r.asset = NONE;
        r.winners = [NONE; 3];
        r.bump = ctx.bumps.round;
        Ok(())
    }

    /// Devnet faucet: tops the wallet back up to 1,000 test USDC.
    pub fn faucet(ctx: Context<Faucet>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let claim = &mut ctx.accounts.claim;
        require!(claim.last_ts == 0 || now - claim.last_ts >= FAUCET_COOLDOWN, ClimbError::FaucetCooldown);
        claim.owner = ctx.accounts.user.key();
        claim.last_ts = now;
        let bal = token_balance(&ctx.accounts.user_usdc, &ctx.accounts.config.usdc_mint, None)?;
        if bal >= FAUCET_TARGET {
            return Ok(());
        }
        let seeds: &[&[u8]] = &[CONFIG_SEED, &[ctx.accounts.config.bump]];
        token_mint_to(
            &ctx.accounts.token_program,
            &ctx.accounts.usdc_mint,
            &ctx.accounts.user_usdc,
            &ctx.accounts.config.to_account_info(),
            FAUCET_TARGET - bal,
            seeds,
        )
    }

    /// The player's on-chain profile: handle, record, bests, last climbs.
    pub fn init_profile(ctx: Context<InitProfile>, name: String) -> Result<()> {
        let p = &mut ctx.accounts.profile;
        p.authority = ctx.accounts.user.key();
        p.name = name_bytes(&name);
        p.created_ts = Clock::get()?.unix_timestamp;
        p.bump = ctx.bumps.profile;
        Ok(())
    }

    pub fn set_name(ctx: Context<SetName>, name: String) -> Result<()> {
        ctx.accounts.profile.name = name_bytes(&name);
        Ok(())
    }

    /// Stake and arm a solo climb. Signed by the wallet, or by a MagicBlock
    /// session key (`SessionTokenV2`) that the wallet also approved as the
    /// spender of its test USDC, so a climb costs no wallet prompt. The signer
    /// becomes the key allowed to act on the climb inside the rollup.
    /// `use_pack`: play the waiting leverage pack instead (house money).
    pub fn start_run(ctx: Context<StartRun>, asset: u8, side: u8, stake: u64, use_pack: bool) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let player = ctx.accounts.player.key();
        let signer = ctx.accounts.signer.key();
        authorize(&signer, &player, &ctx.accounts.session_token, now)?;
        require!((asset as usize) < ASSETS, ClimbError::BadAsset);
        require!(side <= SIDE_SHORT, ClimbError::BadSide);
        let run = &mut ctx.accounts.run;
        require!(run.status == RUN_FREE || run.status == RUN_SETTLED, ClimbError::RunInProgress);

        let (mode, stake, top, tier) = if use_pack {
            let p = &mut ctx.accounts.profile;
            require!(p.pack_state == PACK_READY, ClimbError::NoPack);
            p.pack_state = PACK_NONE;
            (MODE_PACK, PACK_STAKE, PACK_TOP_STEP[p.pack_tier as usize], p.pack_tier)
        } else {
            require!((MIN_STAKE..=MAX_STAKE).contains(&stake), ClimbError::BadStake);
            stake_in(&ctx.accounts.token_program, &ctx.accounts.player_usdc, &ctx.accounts.vault, &ctx.accounts.signer, &player, &ctx.accounts.config.usdc_mint, stake)?;
            (MODE_SOLO, stake, TOP_STEP, NONE)
        };
        run.player = player;
        run.session = signer;
        run.nonce += 1;
        run.status = RUN_STAKED;
        run.mode = mode;
        run.asset = asset;
        run.side = side;
        run.top = top;
        run.pack_tier = tier;
        run.stake = stake;
        run.value = stake;
        run.entry_price = 0;
        run.last_price = 0;
        run.created_ts = now;
        run.start_ts = 0;
        run.last_tick_ts = 0;
        run.end_ts = 0;
        run.max_step = 0;
        run.ticks = 0;
        run.payout = 0;
        run.task_id = 0;
        run.bump = ctx.bumps.run;
        Ok(())
    }

    /// Hand a staked climb to the Ephemeral Rollup. Permissionless; sent in
    /// the same transaction as `start_run`. remaining_accounts[0] = validator.
    pub fn delegate_run(ctx: Context<DelegateRun>) -> Result<()> {
        {
            let data = ctx.accounts.run.try_borrow_data()?;
            let r = Run::try_deserialize(&mut &data[..])?;
            require!(r.status == RUN_STAKED, ClimbError::BadStatus);
        }
        let player = ctx.accounts.player.key();
        ctx.accounts.delegate_run(
            &ctx.accounts.payer,
            &[RUN_SEED, player.as_ref()],
            DelegateConfig { validator: ctx.remaining_accounts.first().map(|v| v.key()), ..Default::default() },
        )?;
        Ok(())
    }

    /// The climb is back on Solana and over: pay what it is worth from the
    /// house vault and write it into the profile. Permissionless.
    pub fn settle_run(ctx: Context<SettleRun>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let run = &mut ctx.accounts.run;
        require!(run.is_over(), ClimbError::BadStatus);
        token_balance(&ctx.accounts.player_usdc, &ctx.accounts.config.usdc_mint, Some(&run.player))?;
        let payout = run.payout_for();
        if payout > 0 {
            let seeds: &[&[u8]] = &[CONFIG_SEED, &[ctx.accounts.config.bump]];
            token_transfer(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.player_usdc, &ctx.accounts.config.to_account_info(), payout, Some(seeds))?;
        }
        let cost = if run.mode == MODE_PACK { 0 } else { run.stake };
        ctx.accounts.profile.record(RunRecord {
            ts: now,
            stake: run.stake,
            pnl: payout as i64 - cost as i64,
            pnl_bps: pnl_bps(run.value, run.stake),
            asset: run.asset,
            side: run.side,
            mode: run.mode,
            status: run.status,
            max_step: run.max_step,
            rank: 0,
            players: 1,
        });
        let c = &mut ctx.accounts.config;
        c.runs += 1;
        c.volume += cost;
        c.paid += payout;
        run.payout = payout;
        run.status = RUN_SETTLED;
        msg!("settled run {} of {}: {} paid", run.nonce, run.player, payout);
        Ok(())
    }

    /// Open round `id` in its slot and ask MagicBlock's VRF to draw its market.
    /// Permissionless: any client that sees the round missing opens it.
    /// `open_markets`: bit mask of the markets whose price is live right now
    /// (stocks, gold and FX close on weekends): the VRF draws among them.
    pub fn open_round(ctx: Context<OpenRound>, id: u64, open_markets: u8) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let round_key = ctx.accounts.round.key();
        {
            let mut r = ctx.accounts.round.load_mut()?;
            require!(r.slot as u64 == id % ROUND_SLOTS, ClimbError::BadRound);
            let (opens, starts, _) = round_times(id);
            require!(now >= opens - 30, ClimbError::TooEarly);
            require!(now < starts - 3, ClimbError::TooLate);
            let reusable = match r.status {
                ROUND_FREE => true,
                ROUND_SETTLED => {
                    let all = if r.players == 0 { 0 } else { (1u64 << r.players) as u32 - 1 };
                    r.recorded & all == all || now > r.ends_at + RECORD_HOLD
                }
                // A draw that never came back, or an open round nobody joined.
                ROUND_DRAWING | ROUND_OPEN => {
                    r.players == 0 && (now > r.starts_at || (r.status == ROUND_DRAWING && r.id == id && now > r.settled_ts + ROUND_VRF_RETRY))
                }
                _ => false,
            };
            require!(reusable && (r.status == ROUND_FREE || id >= r.id), ClimbError::SlotBusy);
            if r.id != id || r.status != ROUND_DRAWING {
                r.reset(id, ROUND_ENTRY);
            }
            r.settled_ts = now; // when the draw was asked
            r.winners = [NONE; 3];
            let allowed = open_markets & ((1u8 << ASSETS) - 1);
            require!(allowed != 0, ClimbError::BadAsset);
            r.recorded = allowed as u32; // markets allowed in the draw, until the draw lands
        }
        let ix = create_request_scoped_randomness_ix(RequestRandomnessParams {
            payer: ctx.accounts.payer.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: crate::ID,
            callback_discriminator: crate::instruction::DrawRoundMarket::DISCRIMINATOR.to_vec(),
            caller_seed: hashv(&[round_key.as_ref(), &id.to_le_bytes(), &now.to_le_bytes()]).to_bytes(),
            accounts_metas: Some(vec![SerializableAccountMeta { pubkey: round_key, is_signer: false, is_writable: true }]),
            callback_args: Some(id.to_le_bytes().to_vec()),
            ..Default::default()
        });
        ctx.accounts.invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
        Ok(())
    }

    /// VRF callback: the oracle's randomness picks the round's market among the
    /// open ones. Only MagicBlock's VRF program can sign this.
    pub fn draw_round_market(ctx: Context<DrawRoundMarketCtx>, randomness: [u8; 32], id: u64) -> Result<()> {
        let mut r = ctx.accounts.round.load_mut()?;
        if r.status != ROUND_DRAWING || r.id != id {
            return Ok(());
        }
        let allowed: Vec<u8> = (0..ASSETS as u8).filter(|i| r.recorded & (1 << i) != 0).collect();
        let pick = (u64::from_le_bytes(randomness[8..16].try_into().unwrap()) % allowed.len() as u64) as usize;
        r.asset = allowed[pick];
        r.recorded = 0;
        r.status = ROUND_OPEN;
        msg!("round {} market {}", id, r.asset);
        Ok(())
    }

    /// Take a seat in an open round: the entry goes to the pot. Wallet or session key.
    pub fn join_round(ctx: Context<JoinRound>, id: u64, side: u8) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let player = ctx.accounts.player.key();
        let signer = ctx.accounts.signer.key();
        authorize(&signer, &player, &ctx.accounts.session_token, now)?;
        require!(side <= SIDE_SHORT, ClimbError::BadSide);
        let mut r = ctx.accounts.round.load_mut()?;
        require!(r.id == id && r.status == ROUND_OPEN, ClimbError::BadStatus);
        require!(now < r.starts_at, ClimbError::TooLate);
        require!(r.index_of(&player).is_none(), ClimbError::AlreadyJoined);
        require!((r.players as usize) < MAX_PLAYERS, ClimbError::RoundFull);
        let entry = r.entry;
        stake_in(&ctx.accounts.token_program, &ctx.accounts.player_usdc, &ctx.accounts.vault, &ctx.accounts.signer, &player, &ctx.accounts.config.usdc_mint, entry)?;
        let i = r.players as usize;
        r.entries[i] = RoundEntry {
            player,
            session: signer,
            value: entry,
            end_ts: 0,
            name: ctx.accounts.profile.name,
            side,
            status: RUN_STAKED,
            max_step: 0,
            _pad: [0; 5],
        };
        r.players += 1;
        r.pot += entry;
        Ok(())
    }

    /// The join window is over: hand the round to the Ephemeral Rollup. Permissionless.
    pub fn delegate_round(ctx: Context<DelegateRound>, id: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        {
            require_keys_eq!(*ctx.accounts.round.owner, crate::ID, ClimbError::BadStatus);
            let data = ctx.accounts.round.try_borrow_data()?;
            require!(data.len() >= 8 + std::mem::size_of::<Round>() && data[..8] == *Round::DISCRIMINATOR, ClimbError::BadRound);
            let r: &Round = bytemuck::from_bytes(&data[8..8 + std::mem::size_of::<Round>()]);
            require!(r.id == id && r.status == ROUND_OPEN && r.players > 0, ClimbError::BadStatus);
            require!(now >= r.starts_at, ClimbError::TooEarly);
        }
        let slot = [(id % ROUND_SLOTS) as u8];
        ctx.accounts.delegate_round(
            &ctx.accounts.payer,
            &[ROUND_SEED, &slot],
            DelegateConfig { validator: ctx.remaining_accounts.first().map(|v| v.key()), ..Default::default() },
        )?;
        Ok(())
    }

    /// The round is back on Solana and over: pay the podium from the pot.
    /// remaining_accounts: the test-USDC accounts of 1st, 2nd, 3rd (as many as
    /// were paid). An empty round, or one whose draw never came, just closes.
    pub fn settle_round<'info>(ctx: Context<'info, SettleRound<'info>>, id: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let mut r = ctx.accounts.round.load_mut()?;
        require!(r.id == id, ClimbError::BadRound);
        match r.status {
            ROUND_DRAWING | ROUND_OPEN => {
                require!(r.players == 0 && now >= r.starts_at, ClimbError::BadStatus);
            }
            ROUND_FINISHED => {
                let seeds: &[&[u8]] = &[CONFIG_SEED, &[ctx.accounts.config.bump]];
                let mint = ctx.accounts.config.usdc_mint;
                for k in 0..3 {
                    let w = r.winners[k];
                    if w == NONE || r.prizes[k] == 0 {
                        continue;
                    }
                    let acc = ctx.remaining_accounts.get(k).ok_or(ClimbError::BadWinner)?;
                    token_balance(acc, &mint, Some(&r.entries[w as usize].player)).map_err(|_| error!(ClimbError::BadWinner))?;
                    token_transfer(&ctx.accounts.token_program, &ctx.accounts.vault, acc, &ctx.accounts.config.to_account_info(), r.prizes[k], Some(seeds))?;
                }
                let c = &mut ctx.accounts.config;
                c.rounds += 1;
                c.volume += r.pot;
                c.paid += r.pot;
            }
            _ => return err!(ClimbError::BadStatus),
        }
        r.status = ROUND_SETTLED;
        r.settled_ts = now;
        msg!("settled round {}: {} players, pot {}", id, r.players, r.pot);
        Ok(())
    }

    /// Write a settled round's results into its players' profiles.
    /// remaining_accounts: any number of the players' profiles (writable).
    pub fn record_round<'info>(ctx: Context<'info, RecordRound<'info>>, id: u64) -> Result<()> {
        let mut r = ctx.accounts.round.load_mut()?;
        require!(r.id == id && r.status == ROUND_SETTLED, ClimbError::BadStatus);
        let ts = r.settled_ts;
        for acc in ctx.remaining_accounts.iter() {
            let mut p: Account<Profile> = Account::try_from(acc)?;
            let (expected, _) = Pubkey::find_program_address(&[PROFILE_SEED, p.authority.as_ref()], &crate::ID);
            require_keys_eq!(expected, acc.key(), ClimbError::Unauthorized);
            let i = r.index_of(&p.authority).ok_or(ClimbError::NotInRound)?;
            if r.recorded & (1 << i) != 0 {
                continue;
            }
            let e = r.entries[i];
            let prize = r.prize_of(i);
            p.record(RunRecord {
                ts,
                stake: r.entry,
                pnl: prize as i64 - r.entry as i64,
                pnl_bps: pnl_bps(e.value, r.entry),
                asset: r.asset,
                side: e.side,
                mode: MODE_ROUND,
                status: e.status,
                max_step: e.max_step,
                rank: r.place_of(i),
                players: r.players,
            });
            p.exit(&crate::ID)?;
            r.recorded |= 1 << i;
        }
        Ok(())
    }

    /// Ask MagicBlock's VRF for a leverage pack: a free climb on the house
    /// whose ladder tops out at the drawn tier. One every 10 minutes.
    pub fn open_pack(ctx: Context<OpenPack>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let player = ctx.accounts.player.key();
        authorize(&ctx.accounts.payer.key(), &player, &ctx.accounts.session_token, now)?;
        let profile_key = ctx.accounts.profile.key();
        {
            let p = &mut ctx.accounts.profile;
            match p.pack_state {
                PACK_NONE => require!(p.pack_ts == 0 || now - p.pack_ts >= PACK_COOLDOWN, ClimbError::PackCooldown),
                PACK_DRAWING => require!(now - p.pack_ts >= VRF_RETRY, ClimbError::PackCooldown),
                _ => return err!(ClimbError::BadStatus),
            }
            p.pack_state = PACK_DRAWING;
            p.pack_ts = now;
        }
        let ix = create_request_scoped_randomness_ix(RequestRandomnessParams {
            payer: ctx.accounts.payer.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: crate::ID,
            callback_discriminator: crate::instruction::ApplyPack::DISCRIMINATOR.to_vec(),
            caller_seed: hashv(&[profile_key.as_ref(), &now.to_le_bytes()]).to_bytes(),
            accounts_metas: Some(vec![SerializableAccountMeta { pubkey: profile_key, is_signer: false, is_writable: true }]),
            ..Default::default()
        });
        ctx.accounts.invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
        Ok(())
    }

    /// VRF callback: the pack's tier. Only MagicBlock's VRF program can sign this.
    pub fn apply_pack(ctx: Context<ApplyPackCtx>, randomness: [u8; 32]) -> Result<()> {
        let p = &mut ctx.accounts.profile;
        if p.pack_state != PACK_DRAWING {
            return Ok(());
        }
        p.pack_tier = pack_tier_from(&randomness);
        p.pack_state = PACK_READY;
        p.packs += 1;
        msg!("pack tier {}", p.pack_tier);
        Ok(())
    }

    /// Create the relay price account for a market that has no MagicBlock
    /// feed on the rollups (GBP/USD), naming the key allowed to push prices.
    pub fn init_relay(ctx: Context<InitRelay>, market: u8, exponent: i32, relayer: Pubkey) -> Result<()> {
        require!(market == RELAY_ASSET, ClimbError::BadAsset);
        let f = &mut ctx.accounts.relay;
        f.market = market;
        f.exponent = exponent;
        f.relayer = relayer;
        f.bump = ctx.bumps.relay;
        Ok(())
    }

    /// Hand the relay account to the rollup, where prices are pushed for free.
    pub fn delegate_relay(ctx: Context<DelegateRelay>, market: u8) -> Result<()> {
        ctx.accounts.delegate_relay(
            &ctx.accounts.admin,
            &[RELAY_SEED, &[market]],
            DelegateConfig { validator: ctx.remaining_accounts.first().map(|v| v.key()), ..Default::default() },
        )?;
        Ok(())
    }

    // ========================================================= ephemeral rollup

    /// Push a GBP/USD price into the relay account (rollup, no fee). Only the
    /// relay key named at init; prices must move forward in time.
    pub fn push_price(ctx: Context<PushPrice>, price: i64, publish_ts: i64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let f = &mut ctx.accounts.relay;
        require_keys_eq!(ctx.accounts.relayer.key(), f.relayer, ClimbError::Unauthorized);
        require!(price > 0, ClimbError::BadPrice);
        require!(publish_ts >= f.publish_ts && publish_ts <= now + 5, ClimbError::BadPrice);
        f.price = price;
        f.publish_ts = publish_ts;
        f.updates += 1;
        Ok(())
    }

    /// Start the climb on the rollup: the entry is the live oracle price.
    /// Signed by the climb's session key (anyone may do it after a grace
    /// period). With `crank`, the rollup schedules `tick_run` every 500 ms.
    pub fn begin_run(ctx: Context<BeginRun>, crank: bool) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let run_info = ctx.accounts.run.to_account_info();
        let run = &mut ctx.accounts.run;
        require!(run.status == RUN_STAKED, ClimbError::BadStatus);
        let signer = ctx.accounts.payer.key();
        require!(signer == run.session || signer == run.player || now > run.created_ts + BEGIN_GRACE, ClimbError::Unauthorized);
        let (price, ts) = read_feed(&ctx.accounts.feed, run.asset)?;
        require!(now - ts <= MAX_PRICE_AGE, ClimbError::StalePrice);
        run.entry_price = price;
        run.last_price = price;
        run.start_ts = now;
        run.last_tick_ts = now;
        run.status = RUN_LIVE;
        if crank {
            let task_id = task_id_for(&run_info.key(), run.nonce as u64);
            run.task_id = task_id;
            let tick = Instruction {
                program_id: crate::ID,
                accounts: vec![AccountMeta::new(run_info.key(), false), AccountMeta::new_readonly(ctx.accounts.feed.key(), false)],
                data: anchor_lang::InstructionData::data(&crate::instruction::TickRun {}),
            };
            schedule(&ctx.accounts.payer.to_account_info(), &run_info, &ctx.accounts.feed.to_account_info(), task_id, tick)?;
        }
        Ok(())
    }

    /// One step of a climb along the oracle. Scheduled by `begin_run`, and
    /// callable by anyone: it only moves the climb forward with the price.
    pub fn tick_run(ctx: Context<TickRun>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let run = &mut ctx.accounts.run;
        if run.status != RUN_LIVE {
            return Ok(());
        }
        let price = fresh_or(&ctx.accounts.feed, run.asset, run.last_price, now)?;
        run.advance(price, now);
        Ok(())
    }

    /// Cash out: one last step at the live price, then the climb is committed
    /// and handed back to Solana in the same transaction. Session key, no fee.
    pub fn cash_out(ctx: Context<CashOut>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        {
            let run = &mut ctx.accounts.run;
            let signer = ctx.accounts.payer.key();
            require!(signer == run.session || signer == run.player, ClimbError::Unauthorized);
            require!(run.status == RUN_LIVE || run.is_over(), ClimbError::BadStatus);
            let price = fresh_or(&ctx.accounts.feed, run.asset, run.last_price, now)?;
            run.advance(price, now);
            if run.status == RUN_LIVE {
                run.status = RUN_CASHED;
                run.end_ts = now;
            }
        }
        commit_back(&ctx.accounts.run, &ctx.accounts.payer, &ctx.accounts.magic_context, &ctx.accounts.magic_program)
    }

    /// End a climb nobody cashed out (busted, or past the bell) and hand it
    /// back to Solana. A staked climb that never started is refunded. Permissionless.
    pub fn finish_run(ctx: Context<FinishRun>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        {
            let run = &mut ctx.accounts.run;
            if run.status == RUN_LIVE && now >= run.start_ts + RUN_SECONDS {
                let price = fresh_or(&ctx.accounts.feed, run.asset, run.last_price, now)?;
                run.advance(price, now);
                if run.status == RUN_LIVE && now >= run.start_ts + RUN_SECONDS + FINISH_GRACE {
                    run.status = RUN_EXPIRED;
                    run.end_ts = run.start_ts + RUN_SECONDS;
                }
            }
            if run.status == RUN_STAKED && now > run.created_ts + STALE_SECONDS {
                run.status = RUN_EXPIRED;
                run.value = if run.mode == MODE_PACK { 0 } else { run.stake };
                run.end_ts = now;
            }
            require!(run.is_over(), ClimbError::BadStatus);
        }
        commit_back(&ctx.accounts.run, &ctx.accounts.payer, &ctx.accounts.magic_context, &ctx.accounts.magic_program)
    }

    /// The bell: every seat starts at the same live price. Permissionless.
    pub fn go_live(ctx: Context<GoLive>, id: u64, crank: bool) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let round_info = ctx.accounts.round.to_account_info();
        let task_id;
        {
            let mut r = ctx.accounts.round.load_mut()?;
            require!(r.id == id && r.status == ROUND_OPEN, ClimbError::BadStatus);
            require!(now >= r.starts_at, ClimbError::TooEarly);
            let (price, ts) = read_feed(&ctx.accounts.feed, r.asset)?;
            require!(now - ts <= MAX_PRICE_AGE || now > r.starts_at + 15, ClimbError::StalePrice);
            r.entry_price = price;
            r.last_price = price;
            r.live_ts = now;
            r.last_tick_ts = now;
            r.status = ROUND_LIVE;
            let n = r.players as usize;
            for e in r.entries[..n].iter_mut() {
                e.status = RUN_LIVE;
            }
            task_id = task_id_for(&round_info.key(), id);
            r.task_id = if crank { task_id } else { 0 };
        }
        if crank {
            let tick = Instruction {
                program_id: crate::ID,
                accounts: vec![AccountMeta::new(round_info.key(), false), AccountMeta::new_readonly(ctx.accounts.feed.key(), false)],
                data: anchor_lang::InstructionData::data(&crate::instruction::TickRound {}),
            };
            schedule(&ctx.accounts.payer.to_account_info(), &round_info, &ctx.accounts.feed.to_account_info(), task_id, tick)?;
        }
        Ok(())
    }

    /// One step of every live seat along the oracle. Scheduled, and permissionless.
    pub fn tick_round(ctx: Context<TickRound>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let mut r = ctx.accounts.round.load_mut()?;
        if r.status != ROUND_LIVE {
            return Ok(());
        }
        let price = fresh_or(&ctx.accounts.feed, r.asset, r.last_price, now)?;
        r.advance(price, now);
        Ok(())
    }

    /// Cash out of a round at the live price (session key, no fee). The round
    /// ends early once nobody is left climbing.
    pub fn cash_out_round(ctx: Context<CashOutRound>, id: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let mut r = ctx.accounts.round.load_mut()?;
        require!(r.id == id, ClimbError::BadRound);
        let i = r.session_index(&ctx.accounts.signer.key()).ok_or(ClimbError::NotInRound)?;
        if r.status == ROUND_LIVE {
            let price = fresh_or(&ctx.accounts.feed, r.asset, r.last_price, now)?;
            r.advance(price, now);
        }
        require!(r.status == ROUND_LIVE || r.status == ROUND_FINISHED, ClimbError::BadStatus);
        if r.entries[i].status == RUN_LIVE {
            r.entries[i].status = RUN_CASHED;
            r.entries[i].end_ts = now;
        }
        let n = r.players as usize;
        if r.status == ROUND_LIVE && r.entries[..n].iter().all(|e| e.status != RUN_LIVE) {
            r.status = ROUND_FINISHED;
            r.rank();
        }
        Ok(())
    }

    /// The round is over: commit it and hand it back to Solana. Permissionless.
    pub fn finish_round(ctx: Context<FinishRound>, id: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        {
            let mut r = ctx.accounts.round.load_mut()?;
            require!(r.id == id, ClimbError::BadRound);
            if r.status == ROUND_LIVE && now >= r.live_ts + RUN_SECONDS {
                let price = fresh_or(&ctx.accounts.feed, r.asset, r.last_price, now)?;
                r.advance(price, now);
            }
            require!(r.status == ROUND_FINISHED, ClimbError::BadStatus);
        }
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.round.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }
}

// ==================================================================== helpers

fn name_bytes(name: &str) -> [u8; NAME_LEN] {
    let mut out = [0u8; NAME_LEN];
    let b = name.as_bytes();
    let n = b.len().min(NAME_LEN);
    out[..n].copy_from_slice(&b[..n]);
    out
}

/// The wallet itself, or a live MagicBlock session key it authorised for this program.
fn authorize(signer: &Pubkey, player: &Pubkey, token: &Option<Account<SessionTokenV2>>, now: i64) -> Result<()> {
    if signer == player {
        return Ok(());
    }
    let t = token.as_ref().ok_or(ClimbError::Unauthorized)?;
    require_keys_eq!(t.authority, *player, ClimbError::Unauthorized);
    require_keys_eq!(t.session_signer, *signer, ClimbError::Unauthorized);
    require_keys_eq!(t.target_program, crate::ID, ClimbError::Unauthorized);
    require!(t.valid_until > now, ClimbError::SessionExpired);
    Ok(())
}

/// Move `amount` from the player's token account into the vault. The signer
/// is the owner, or the session key the wallet approved as its spender.
fn stake_in<'info>(
    token_program: &UncheckedAccount<'info>,
    from: &UncheckedAccount<'info>,
    vault: &UncheckedAccount<'info>,
    signer: &Signer<'info>,
    player: &Pubkey,
    mint: &Pubkey,
    amount: u64,
) -> Result<()> {
    let balance = token_balance(from, mint, Some(player))?;
    require!(balance >= amount, ClimbError::InsufficientFunds);
    token_transfer(token_program, from, vault, &signer.to_account_info(), amount, None)
}

/// Unique per climb: crank task ids are shared by every program on a validator.
fn task_id_for(account: &Pubkey, n: u64) -> i64 {
    let h = hashv(&[b"siroclimb-tick", account.as_ref(), &n.to_le_bytes()]).to_bytes();
    (i64::from_le_bytes(h[..8].try_into().unwrap()) & i64::MAX).max(1)
}

/// Ask the rollup to run `tick` every TICK_MILLIS for a whole climb.
fn schedule<'info>(payer: &AccountInfo<'info>, target: &AccountInfo<'info>, feed: &AccountInfo<'info>, task_id: i64, tick: Instruction) -> Result<()> {
    let args = ScheduleTaskArgs {
        task_id,
        execution_interval_millis: TICK_MILLIS,
        iterations: (RUN_SECONDS * 1000 / TICK_MILLIS) + 20,
        instructions: vec![tick],
    };
    let data = bincode::serialize(&MagicBlockInstruction::ScheduleTask(args)).map_err(|_| error!(ClimbError::Crank))?;
    let metas = vec![AccountMeta::new(payer.key(), true), AccountMeta::new(target.key(), false), AccountMeta::new_readonly(feed.key(), false)];
    invoke(&Instruction { program_id: MAGIC_PROGRAM_ID, accounts: metas, data }, &[payer.clone(), target.clone(), feed.clone()])?;
    Ok(())
}

fn commit_back<'info>(
    run: &Account<'info, Run>,
    payer: &Signer<'info>,
    magic_context: &AccountInfo<'info>,
    magic_program: &AccountInfo<'info>,
) -> Result<()> {
    run.exit(&crate::ID)?;
    MagicIntentBundleBuilder::new(payer.to_account_info(), magic_context.clone(), magic_program.clone())
        .commit_and_undelegate(&[run.to_account_info()])
        .build_and_invoke()?;
    Ok(())
}

/// Read a market's price. MagicBlock Pyth Lazer feeds have the layout of
/// Pyth's `PriceUpdateV2` (price i64 at 73, publish_time i64 at 93) and are
/// owned by the pricing oracle; the relay account is ours. Address pinned to
/// the asset, owner checked, price must be positive.
fn read_feed(f: &AccountInfo, asset: u8) -> Result<(u64, i64)> {
    require!((asset as usize) < ASSETS, ClimbError::BadAsset);
    require_keys_eq!(*f.key, FEEDS[asset as usize], ClimbError::WrongFeed);
    if asset == RELAY_ASSET {
        require_keys_eq!(*f.owner, crate::ID, ClimbError::WrongFeed);
        let data = f.try_borrow_data()?;
        let r = RelayFeed::try_deserialize(&mut &data[..])?;
        require!(r.price > 0, ClimbError::BadPrice);
        return Ok((r.price as u64, r.publish_ts));
    }
    require_keys_eq!(*f.owner, PRICE_ORACLE_PROGRAM_ID, ClimbError::WrongFeed);
    let data = f.try_borrow_data()?;
    require!(data.len() >= 101, ClimbError::WrongFeed);
    let price = i64::from_le_bytes(data[73..81].try_into().unwrap());
    let ts = i64::from_le_bytes(data[93..101].try_into().unwrap());
    require!(price > 0, ClimbError::BadPrice);
    Ok((price as u64, ts))
}

/// The live price, or `last` when the feed is stale (the climb holds still).
fn fresh_or(f: &AccountInfo, asset: u8, last: u64, now: i64) -> Result<u64> {
    let (price, ts) = read_feed(f, asset)?;
    Ok(if now - ts <= MAX_PRICE_AGE { price } else { last })
}

// =================================================================== accounts

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub usdc_mint: Pubkey,
    pub vault: Pubkey,
    /// Settled solo climbs and rounds, money staked, money paid out.
    pub runs: u64,
    pub rounds: u64,
    pub volume: u64,
    pub paid: u64,
    pub bump: u8,
}

/// A market price pushed by a named relay key, for markets MagicBlock does
/// not feed into the rollups. Lives on the rollup.
#[account]
#[derive(InitSpace)]
pub struct RelayFeed {
    pub market: u8,
    pub exponent: i32,
    pub price: i64,
    pub publish_ts: i64,
    pub updates: u64,
    pub relayer: Pubkey,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(market: u8)]
pub struct InitRelay<'info> {
    #[account(mut, address = config.admin @ ClimbError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(init, payer = admin, space = 8 + RelayFeed::INIT_SPACE, seeds = [RELAY_SEED, &[market]], bump)]
    pub relay: Account<'info, RelayFeed>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(market: u8)]
pub struct DelegateRelay<'info> {
    #[account(mut, address = config.admin @ ClimbError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    /// CHECK: the relay PDA, handed to the delegation program.
    #[account(mut, del, seeds = [RELAY_SEED, &[market]], bump)]
    pub relay: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct PushPrice<'info> {
    pub relayer: Signer<'info>,
    #[account(mut, seeds = [RELAY_SEED, &[relay.market]], bump = relay.bump)]
    pub relay: Account<'info, RelayFeed>,
}

#[account]
#[derive(InitSpace)]
pub struct FaucetClaim {
    pub owner: Pubkey,
    pub last_ts: i64,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    /// CHECK: SPL mint whose mint authority is `config`; checked in the handler.
    pub usdc_mint: UncheckedAccount<'info>,
    /// CHECK: token account of `usdc_mint` owned by `config`; checked in the handler.
    pub vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundHouse<'info> {
    #[account(address = config.admin @ ClimbError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    /// CHECK: the config's mint.
    #[account(mut, address = config.usdc_mint @ ClimbError::BadMint)]
    pub usdc_mint: UncheckedAccount<'info>,
    /// CHECK: the config's vault.
    #[account(mut, address = config.vault @ ClimbError::BadVault)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: address-checked SPL Token program.
    #[account(address = TOKEN_PROGRAM_ID)]
    pub token_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(slot: u8)]
pub struct InitRoundSlot<'info> {
    #[account(mut, address = config.admin @ ClimbError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(init, payer = admin, space = 8 + std::mem::size_of::<Round>(), seeds = [ROUND_SEED, &[slot]], bump)]
    pub round: AccountLoader<'info, Round>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Faucet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(init_if_needed, payer = user, space = 8 + FaucetClaim::INIT_SPACE, seeds = [FAUCET_SEED, user.key().as_ref()], bump)]
    pub claim: Account<'info, FaucetClaim>,
    /// CHECK: the config's mint.
    #[account(mut, address = config.usdc_mint @ ClimbError::BadMint)]
    pub usdc_mint: UncheckedAccount<'info>,
    /// CHECK: any token account of the test-USDC mint (checked in the handler).
    #[account(mut)]
    pub user_usdc: UncheckedAccount<'info>,
    /// CHECK: address-checked SPL Token program.
    #[account(address = TOKEN_PROGRAM_ID)]
    pub token_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitProfile<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(init, payer = user, space = 8 + Profile::INIT_SPACE, seeds = [PROFILE_SEED, user.key().as_ref()], bump)]
    pub profile: Box<Account<'info, Profile>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetName<'info> {
    pub user: Signer<'info>,
    #[account(mut, seeds = [PROFILE_SEED, user.key().as_ref()], bump = profile.bump)]
    pub profile: Box<Account<'info, Profile>>,
}

#[derive(Accounts)]
pub struct StartRun<'info> {
    /// The wallet, or a session key authorised by it.
    #[account(mut)]
    pub signer: Signer<'info>,
    /// CHECK: the player the climb is for.
    pub player: UncheckedAccount<'info>,
    #[account(mut, seeds = [PROFILE_SEED, player.key().as_ref()], bump = profile.bump)]
    pub profile: Box<Account<'info, Profile>>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(init_if_needed, payer = signer, space = 8 + Run::INIT_SPACE, seeds = [RUN_SEED, player.key().as_ref()], bump)]
    pub run: Box<Account<'info, Run>>,
    /// CHECK: player's test-USDC account, checked in `stake_in`.
    #[account(mut)]
    pub player_usdc: UncheckedAccount<'info>,
    /// CHECK: the config's vault.
    #[account(mut, address = config.vault @ ClimbError::BadVault)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: address-checked SPL Token program.
    #[account(address = TOKEN_PROGRAM_ID)]
    pub token_program: UncheckedAccount<'info>,
    /// MagicBlock session token (`session-keys` program), unless the wallet signs.
    pub session_token: Option<Account<'info, SessionTokenV2>>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateRun<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the climb's player (seed of the run PDA).
    pub player: UncheckedAccount<'info>,
    /// CHECK: the run PDA, handed to the delegation program.
    #[account(mut, del, seeds = [RUN_SEED, player.key().as_ref()], bump)]
    pub run: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct SettleRun<'info> {
    pub caller: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [RUN_SEED, run.player.as_ref()], bump = run.bump)]
    pub run: Box<Account<'info, Run>>,
    #[account(mut, seeds = [PROFILE_SEED, run.player.as_ref()], bump = profile.bump)]
    pub profile: Box<Account<'info, Profile>>,
    /// CHECK: the player's test-USDC account, checked in the handler.
    #[account(mut)]
    pub player_usdc: UncheckedAccount<'info>,
    /// CHECK: the config's vault.
    #[account(mut, address = config.vault @ ClimbError::BadVault)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: address-checked SPL Token program.
    #[account(address = TOKEN_PROGRAM_ID)]
    pub token_program: UncheckedAccount<'info>,
}

#[vrf]
#[derive(Accounts)]
#[instruction(id: u64)]
pub struct OpenRound<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [ROUND_SEED, &[(id % ROUND_SLOTS) as u8]], bump)]
    pub round: AccountLoader<'info, Round>,
    /// CHECK: VRF oracle queue, validated by the VRF program.
    #[account(mut)]
    pub oracle_queue: UncheckedAccount<'info>,
}

#[vrf_callback]
#[derive(Accounts)]
pub struct DrawRoundMarketCtx<'info> {
    #[account(mut)]
    pub round: AccountLoader<'info, Round>,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct JoinRound<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    /// CHECK: the player taking the seat.
    pub player: UncheckedAccount<'info>,
    #[account(seeds = [PROFILE_SEED, player.key().as_ref()], bump = profile.bump)]
    pub profile: Box<Account<'info, Profile>>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [ROUND_SEED, &[(id % ROUND_SLOTS) as u8]], bump)]
    pub round: AccountLoader<'info, Round>,
    /// CHECK: player's test-USDC account, checked in `stake_in`.
    #[account(mut)]
    pub player_usdc: UncheckedAccount<'info>,
    /// CHECK: the config's vault.
    #[account(mut, address = config.vault @ ClimbError::BadVault)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: address-checked SPL Token program.
    #[account(address = TOKEN_PROGRAM_ID)]
    pub token_program: UncheckedAccount<'info>,
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(id: u64)]
pub struct DelegateRound<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the round slot PDA, handed to the delegation program.
    #[account(mut, del, seeds = [ROUND_SEED, &[(id % ROUND_SLOTS) as u8]], bump)]
    pub round: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct SettleRound<'info> {
    pub caller: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [ROUND_SEED, &[(id % ROUND_SLOTS) as u8]], bump)]
    pub round: AccountLoader<'info, Round>,
    /// CHECK: the config's vault.
    #[account(mut, address = config.vault @ ClimbError::BadVault)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: address-checked SPL Token program.
    #[account(address = TOKEN_PROGRAM_ID)]
    pub token_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct RecordRound<'info> {
    pub caller: Signer<'info>,
    #[account(mut, seeds = [ROUND_SEED, &[(id % ROUND_SLOTS) as u8]], bump)]
    pub round: AccountLoader<'info, Round>,
}

#[vrf]
#[derive(Accounts)]
pub struct OpenPack<'info> {
    /// The wallet, or a session key authorised by it.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: the player opening the pack.
    pub player: UncheckedAccount<'info>,
    #[account(mut, seeds = [PROFILE_SEED, player.key().as_ref()], bump = profile.bump)]
    pub profile: Box<Account<'info, Profile>>,
    pub session_token: Option<Account<'info, SessionTokenV2>>,
    /// CHECK: VRF oracle queue, validated by the VRF program.
    #[account(mut)]
    pub oracle_queue: UncheckedAccount<'info>,
}

#[vrf_callback]
#[derive(Accounts)]
pub struct ApplyPackCtx<'info> {
    #[account(mut)]
    pub profile: Box<Account<'info, Profile>>,
}

#[derive(Accounts)]
pub struct BeginRun<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [RUN_SEED, run.player.as_ref()], bump = run.bump)]
    pub run: Box<Account<'info, Run>>,
    /// CHECK: pinned to the climb's market and owner-checked in `read_feed`.
    pub feed: UncheckedAccount<'info>,
    /// CHECK: MagicBlock program, for ScheduleTask.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct TickRun<'info> {
    #[account(mut, seeds = [RUN_SEED, run.player.as_ref()], bump = run.bump)]
    pub run: Box<Account<'info, Run>>,
    /// CHECK: pinned and owner-checked in `read_feed`.
    pub feed: UncheckedAccount<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct CashOut<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [RUN_SEED, run.player.as_ref()], bump = run.bump)]
    pub run: Box<Account<'info, Run>>,
    /// CHECK: pinned and owner-checked in `read_feed`.
    pub feed: UncheckedAccount<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct FinishRun<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [RUN_SEED, run.player.as_ref()], bump = run.bump)]
    pub run: Box<Account<'info, Run>>,
    /// CHECK: pinned and owner-checked in `read_feed`.
    pub feed: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct GoLive<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [ROUND_SEED, &[(id % ROUND_SLOTS) as u8]], bump)]
    pub round: AccountLoader<'info, Round>,
    /// CHECK: pinned and owner-checked in `read_feed`.
    pub feed: UncheckedAccount<'info>,
    /// CHECK: MagicBlock program, for ScheduleTask.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct TickRound<'info> {
    #[account(mut)]
    pub round: AccountLoader<'info, Round>,
    /// CHECK: pinned and owner-checked in `read_feed`.
    pub feed: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct CashOutRound<'info> {
    pub signer: Signer<'info>,
    #[account(mut, seeds = [ROUND_SEED, &[(id % ROUND_SLOTS) as u8]], bump)]
    pub round: AccountLoader<'info, Round>,
    /// CHECK: pinned and owner-checked in `read_feed`.
    pub feed: UncheckedAccount<'info>,
}

#[commit]
#[derive(Accounts)]
#[instruction(id: u64)]
pub struct FinishRound<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [ROUND_SEED, &[(id % ROUND_SLOTS) as u8]], bump)]
    pub round: AccountLoader<'info, Round>,
    /// CHECK: pinned and owner-checked in `read_feed`.
    pub feed: UncheckedAccount<'info>,
}
