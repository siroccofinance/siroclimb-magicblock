// Siroclimb on MagicBlock.
//
// Pick a market, go long or short: the coin climbs a staircase that follows
// the live price, leverage steps up from 1x to 4x every 6 seconds over a 60 s
// climb, and the player cashes out whenever they like. Climbs are solo,
// played against the house vault.
//
// One line splits the program: money and reputation stay on Solana, the
// climb itself runs on an Ephemeral Rollup.
//
//   Solana (base)      test-USDC mint + faucet, house vault, stakes,
//                      settlement, player profiles, VRF draws (leverage
//                      packs). Nothing holding tokens is ever delegated.
//
//   Ephemeral Rollup   the live `Run`: entry price, price ticks read from
//                      MagicBlock's Pyth Lazer feeds, leverage steps, the
//                      bust, the cash out (signed by a session key, no fee).
//                      The cash out commits and undelegates in the same
//                      transaction, and `settle_run` pays out on Solana.
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
pub mod reserve;
pub mod token;
pub mod desk;
use game::*;
use reserve::*;
use token::*;
use desk::*;

declare_id!("BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ");

pub const CONFIG_SEED: &[u8] = b"config";
pub const FAUCET_SEED: &[u8] = b"faucet";
pub const PROFILE_SEED: &[u8] = b"profile";
pub const RUN_SEED: &[u8] = b"run";
pub const RESERVE_SEED: &[u8] = b"reserve";
pub const LENDER_SEED: &[u8] = b"lender";
/// Seed of the retired round slots, kept only to close them (`close_round_slot`).
pub const ROUND_SEED: &[u8] = b"round";
/// Offset of `status` in a retired round slot (8 + the zero-copy layout); `slot` is the byte before.
pub const ROUND_STATUS_AT: usize = 2633;

pub const ONE_USDC: u64 = 1_000_000;
/// The faucet tops a wallet back up to this balance.
pub const FAUCET_TARGET: u64 = 1_000 * ONE_USDC;
pub const FAUCET_COOLDOWN: i64 = 30;
pub const MIN_STAKE: u64 = ONE_USDC;
pub const MAX_STAKE: u64 = 100 * ONE_USDC;
/// A pack climb is played with this much of the reserve's money.
pub const PACK_STAKE: u64 = 10 * ONE_USDC;
pub const PACK_COOLDOWN: i64 = 10 * 60;
/// A VRF draw that never came back may be asked again after this long.
pub const VRF_RETRY: i64 = 60;

/// A staked climb its player never started may be started by anyone after
/// this long, and refunded after `STALE_SECONDS`.
pub const BEGIN_GRACE: i64 = 10;
pub const STALE_SECONDS: i64 = 30;
/// A live climb whose ticks stopped can still be ended this long after the bell.
pub const FINISH_GRACE: i64 = 5;

/// MagicBlock's real-time pricing oracle (Pyth Lazer, pushed into the ERs).
pub const PRICE_ORACLE_PROGRAM_ID: Pubkey = pubkey!("PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd");
/// Price accounts, in asset order: relay accounts of this program,
/// `["relay", asset]`, that one named key keeps fresh (see `push_price`).
/// Every market trades around the clock: MagicBlock's rollups carry no feed
/// for the xStocks (TSLAx, NVDAx, AAPLx, GMEx) and Pyth's equity feeds stand
/// still outside US hours, and Pyth's XAU/USD closes on weekends, so each
/// market is priced from its own 24/7 token market (gold: XAUt, Tether Gold).
/// The oracle branch of `read_feed` (MagicBlock's Pyth Lazer accounts,
/// `["price_feed", "pyth-lazer", id]`) stays for a market that would use one.
pub const FEEDS: [Pubkey; ASSETS] = [
    pubkey!("EZzYNjVe8T3SfPiRknV4JA9JTfbfeBfWRoD8CymuUUHu"),
    pubkey!("AuewuoKKM4GSphTixn1oHS4o37jZrFcghgSvUc5dJXF7"),
    pubkey!("BMPPdknGVDDzPsRSwnhHyuR1YwmJ9xM9ij841S96rXY5"),
    pubkey!("CGNjvcw4CJBdYKiV4aGVjqvgmMQfA9pTnz2V2bqzBp8N"),
    pubkey!("2k53rB3byWy3dEQobyjZCfrMhhPJ5FmVbtp66KwwprWr"),
];
pub const RELAY_SEED: &[u8] = b"relay";
/// Markets priced by the relay: all five (the four xStocks and gold).
pub const fn is_relay(asset: u8) -> bool {
    (asset as usize) < ASSETS
}
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
    /// (a token account owned by config: the house bankroll) are
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

    /// Close a round slot left from the retired round mode and hand its rent
    /// back to the admin. Only an idle slot on Solana: free, settled, or
    /// opened with nobody seated.
    pub fn close_round_slot(ctx: Context<CloseRoundSlot>, slot: u8) -> Result<()> {
        let r = &ctx.accounts.round;
        require_keys_eq!(*r.owner, crate::ID, ClimbError::BadRound);
        {
            let data = r.try_borrow_data()?;
            require!(data.len() > ROUND_STATUS_AT, ClimbError::BadRound);
            require!(data[ROUND_STATUS_AT - 1] == slot, ClimbError::BadRound);
            // free or settled, or opened / drawing with nobody seated (no pot)
            let (status, players) = (data[ROUND_STATUS_AT], data[ROUND_STATUS_AT + 2]);
            require!(status == 0 || status == 5 || (status <= 2 && players == 0), ClimbError::SlotBusy);
        }
        let admin = ctx.accounts.admin.to_account_info();
        **admin.try_borrow_mut_lamports()? += r.lamports();
        **r.try_borrow_mut_lamports()? = 0;
        r.try_borrow_mut_data()?.fill(0);
        Ok(())
    }

    /// Open the Sirocco Reserve. The tUSDC already in the vault (the house
    /// bankroll) becomes the admin's lender position, one share per tUSDC: the
    /// deployer is the first lender.
    pub fn init_reserve(ctx: Context<InitReserve>) -> Result<()> {
        let vault = token_balance(&ctx.accounts.vault, &ctx.accounts.config.usdc_mint, Some(&ctx.accounts.config.key()))?;
        let rs = &mut ctx.accounts.reserve;
        rs.shares = vault;
        rs.deposits = vault;
        rs.created_ts = Clock::get()?.unix_timestamp;
        rs.bump = ctx.bumps.reserve;
        let l = &mut ctx.accounts.lender;
        l.owner = ctx.accounts.admin.key();
        l.shares = vault;
        l.deposited = vault;
        l.bump = ctx.bumps.lender;
        msg!("reserve opened with {} tUSDC from the admin", vault);
        Ok(())
    }

    /// Lend tUSDC to the reserve for shares at the current share price.
    /// Signed by the wallet, or by its session key (the wallet's approved spender).
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let owner = ctx.accounts.owner.key();
        authorize(&ctx.accounts.signer.key(), &owner, &ctx.accounts.session_token, now)?;
        require!(amount >= ONE_USDC, ClimbError::BadStake);
        let vault = token_balance(&ctx.accounts.vault, &ctx.accounts.config.usdc_mint, Some(&ctx.accounts.config.key()))?;
        let vault = reserve_cash(vault, &ctx.accounts.desk);
        let rs = &mut ctx.accounts.reserve;
        let n = shares_for(amount, assets_of(vault, rs.staked), rs.shares);
        require!(n > 0, ClimbError::BadShares);
        stake_in(&ctx.accounts.token_program, &ctx.accounts.owner_usdc, &ctx.accounts.vault, &ctx.accounts.signer, &owner, &ctx.accounts.config.usdc_mint, amount)?;
        rs.shares += n;
        rs.deposits += amount;
        let l = &mut ctx.accounts.lender;
        l.owner = owner;
        l.shares += n;
        l.deposited += amount;
        l.bump = ctx.bumps.lender;
        msg!("deposit {} for {} shares", amount, n);
        Ok(())
    }

    /// Redeem `shares` for tUSDC at the current share price, up to the
    /// reserve's free liquidity (what open climbs have reserved stays).
    pub fn withdraw(ctx: Context<Withdraw>, shares: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let owner = ctx.accounts.owner.key();
        authorize(&ctx.accounts.signer.key(), &owner, &ctx.accounts.session_token, now)?;
        token_balance(&ctx.accounts.owner_usdc, &ctx.accounts.config.usdc_mint, Some(&owner))?;
        require!(shares > 0 && shares <= ctx.accounts.lender.shares, ClimbError::BadShares);
        let vault = token_balance(&ctx.accounts.vault, &ctx.accounts.config.usdc_mint, Some(&ctx.accounts.config.key()))?;
        let rs = &mut ctx.accounts.reserve;
        let assets = assets_of(reserve_cash(vault, &ctx.accounts.desk), rs.staked);
        let amount = value_of(shares, assets, rs.shares);
        // what is in the vault right now (the open positions' tUSDC is with the desk until they close)
        require!(amount <= assets.saturating_sub(rs.reserved) && amount <= vault.saturating_sub(rs.staked), ClimbError::NotEnoughLiquidity);
        let seeds: &[&[u8]] = &[CONFIG_SEED, &[ctx.accounts.config.bump]];
        token_transfer(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.owner_usdc, &ctx.accounts.config.to_account_info(), amount, Some(seeds))?;
        rs.shares -= shares;
        rs.withdrawals += amount;
        let l = &mut ctx.accounts.lender;
        l.shares -= shares;
        l.withdrawn += amount;
        msg!("withdraw {} shares for {}", shares, amount);
        Ok(())
    }

    /// Grow a run account written before the reserve to the current layout
    /// (zeroed new fields). Permissionless, the payer covers the extra rent;
    /// only a run back on Solana and not in flight.
    pub fn grow_run(ctx: Context<GrowRun>) -> Result<()> {
        let run = &ctx.accounts.run;
        let want = 8 + Run::INIT_SPACE;
        require_keys_eq!(*run.owner, crate::ID, ClimbError::BadStatus);
        if run.data_len() >= want {
            return Ok(());
        }
        let rent = Rent::get()?.minimum_balance(want).saturating_sub(run.lamports());
        if rent > 0 {
            anchor_lang::system_program::transfer(
                CpiContext::new(ctx.accounts.system_program.key(), anchor_lang::system_program::Transfer { from: ctx.accounts.payer.to_account_info(), to: run.to_account_info() }),
                rent,
            )?;
        }
        run.resize(want)?;
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
        require!(hours::in_session(asset, now), ClimbError::MarketClosed);
        let run = &mut ctx.accounts.run;
        require!(run.status == RUN_FREE || run.status == RUN_SETTLED, ClimbError::RunInProgress);

        let (mode, stake, top, tier) = if use_pack {
            let p = &mut ctx.accounts.profile;
            require!(p.pack_state == PACK_READY, ClimbError::NoPack);
            p.pack_state = PACK_NONE;
            (MODE_PACK, PACK_STAKE, PACK_TOP_STEP[p.pack_tier as usize], p.pack_tier)
        } else {
            require!((MIN_STAKE..=MAX_STAKE).contains(&stake), ClimbError::BadStake);
            (MODE_SOLO, stake, TOP_STEP, NONE)
        };
        // The Sirocco Reserve backs the climb: its free liquidity must cover the
        // most the climb could owe beyond the stake (more than its largest borrow).
        let vault = reserve_cash(token_balance(&ctx.accounts.vault, &ctx.accounts.config.usdc_mint, Some(&ctx.accounts.config.key()))?, &ctx.accounts.desk);
        let exposure = exposure_of(stake);
        let line = line_of(stake, top, mode == MODE_PACK);
        {
            let rs = &mut ctx.accounts.reserve;
            let free = assets_of(vault, rs.staked).saturating_sub(rs.reserved);
            require!(free >= exposure && free >= line, ClimbError::ReserveFull);
            rs.reserved += exposure;
            rs.lines += line;
            if mode == MODE_SOLO {
                rs.staked += stake;
            }
        }
        if mode == MODE_SOLO {
            stake_in(&ctx.accounts.token_program, &ctx.accounts.player_usdc, &ctx.accounts.vault, &ctx.accounts.signer, &player, &ctx.accounts.config.usdc_mint, stake)?;
        }
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
        run.borrowed = 0;
        run.cost = 0;
        run.reserved = exposure;
        run.line = line;
        run.units_open = 0;
        run.units = 0;
        run.notional_open = 0;
        run.notional = 0;
        run.fill_price = 0;
        run.exit_fill = 0;
        run.booked_step = 0;
        run.spread_bps = 0;
        run.decimals = 0;
        run.real_pnl = 0;
        run.boost_pnl = 0;
        Ok(())
    }

    /// Open the climb's real position, in the same transaction as `start_run`: the stake's worth of the
    /// market's token at the relay's price on Solana, plus or minus the desk's spread. A long buys it from
    /// the desk into the climb's escrow (the reserve pays from the vault); a short borrows it from the
    /// lending book and sells it to the desk (the reserve keeps the tUSDC as collateral).
    pub fn open_position(ctx: Context<OpenPosition>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let run = &mut ctx.accounts.run;
        let signer = ctx.accounts.signer.key();
        require!(run.status == RUN_STAKED && run.units_open == 0, ClimbError::BadStatus);
        require!(signer == run.session || signer == run.player, ClimbError::Unauthorized);
        let a = run.asset as usize;
        let desk = &mut ctx.accounts.desk;
        let mint = ctx.accounts.mint.key();
        require_keys_eq!(mint, desk.mints[a], ClimbError::BadMint);
        let desk_key = desk.key();
        require_keys_eq!(ctx.accounts.desk_token.key(), ata_of(&desk_key, &mint, &TOKEN_2022_PROGRAM_ID), ClimbError::BadTokenAccount);
        require_keys_eq!(ctx.accounts.desk_usdc.key(), ata_of(&desk_key, &ctx.accounts.config.usdc_mint, &TOKEN_PROGRAM_ID), ClimbError::BadTokenAccount);
        require_keys_eq!(ctx.accounts.escrow.key(), ata_of(&run.key(), &mint, &TOKEN_2022_PROGRAM_ID), ClimbError::BadTokenAccount);
        require_keys_eq!(ctx.accounts.lend_token.key(), ata_of(&ctx.accounts.lend.key(), &mint, &TOKEN_2022_PROGRAM_ID), ClimbError::BadTokenAccount);
        let q = &ctx.accounts.quotes;
        let price = q.prices[a];
        require!(price > 0, ClimbError::BadPrice);
        require!(now - q.ts <= QUOTE_MAX_AGE, ClimbError::StalePrice);

        ata_create_idempotent(&ctx.accounts.ata_program, &ctx.accounts.signer.to_account_info(), &ctx.accounts.escrow, &run.to_account_info(), &ctx.accounts.mint, &ctx.accounts.system_program.to_account_info(), &ctx.accounts.token_2022_program)?;
        let dec = desk.decimals[a];
        let long = run.side != SIDE_SHORT;
        let px = if long { ask(price, desk.spread_bps) } else { bid(price, desk.spread_bps) };
        let usdc = run.stake;
        let units = units_for(usdc, px, EXPONENTS[a], dec);
        require!(units > 0, ClimbError::BadPrice);
        let player = run.player;
        let config_seeds: &[&[u8]] = &[CONFIG_SEED, &[ctx.accounts.config.bump]];
        let desk_seeds: &[&[u8]] = &[DESK_SEED, &[desk.bump]];
        let lend_seeds: &[&[u8]] = &[LEND_SEED, &[ctx.bumps.lend]];
        let run_seeds: &[&[u8]] = &[RUN_SEED, player.as_ref(), &[run.bump]];
        let t22 = &ctx.accounts.token_2022_program;
        if long {
            token_transfer(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.desk_usdc, &ctx.accounts.config.to_account_info(), usdc, Some(config_seeds))?;
            token22_transfer(t22, &ctx.accounts.desk_token, &ctx.accounts.mint, &ctx.accounts.escrow, &desk.to_account_info(), units, dec, desk_seeds)?;
            desk.open_long_cost += usdc;
        } else {
            token22_transfer(t22, &ctx.accounts.lend_token, &ctx.accounts.mint, &ctx.accounts.escrow, &ctx.accounts.lend.to_account_info(), units, dec, lend_seeds)?;
            token22_transfer(t22, &ctx.accounts.escrow, &ctx.accounts.mint, &ctx.accounts.desk_token, &run.to_account_info(), units, dec, run_seeds)?;
            token_transfer(&ctx.accounts.token_program, &ctx.accounts.desk_usdc, &ctx.accounts.vault, &desk.to_account_info(), usdc, Some(desk_seeds))?;
            desk.open_short_proceeds += usdc;
        }
        desk.trades += 1;
        desk.volume += usdc;
        run.units_open = units;
        run.units = units;
        run.notional_open = usdc;
        run.notional = usdc;
        run.fill_price = px;
        run.booked_step = 0;
        run.spread_bps = desk.spread_bps;
        run.decimals = dec;
        msg!("open {} {} units at {} for {} tUSDC", if long { "long" } else { "short" }, units, px, usdc);
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
    pub fn settle_run(mut ctx: Context<SettleRun>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let run = &mut ctx.accounts.run;
        require!(run.is_over(), ClimbError::BadStatus);
        token_balance(&ctx.accounts.player_usdc, &ctx.accounts.config.usdc_mint, Some(&run.player))?;
        // the loan's cost (solo climbs): fee on the peak borrow + interest per second borrowed
        run.cost = if run.mode == MODE_SOLO && run.start_ts > 0 {
            borrow_cost(run.stake, run.end_ts - run.start_ts, run.top, run.max_step).min(run.value)
        } else {
            0
        };
        let has_position = run.units > 0;
        if has_position {
            let lend_bump = ctx.bumps.lend;
            close_position(&mut ctx.accounts, lend_bump)?;
        }
        let run = &mut ctx.accounts.run;
        let payout = run.payout_for();
        if payout > 0 {
            let seeds: &[&[u8]] = &[CONFIG_SEED, &[ctx.accounts.config.bump]];
            token_transfer(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.player_usdc, &ctx.accounts.config.to_account_info(), payout, Some(seeds))?;
        }
        let cost = if run.mode == MODE_PACK { 0 } else { run.stake };
        // the climb's result beyond what the tokens made: the game's boost, between the player and the reserve
        run.boost_pnl = run.value as i64 - run.stake as i64 - run.real_pnl;
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
        // release the climb's reservation; the reserve keeps the stake and the
        // cost, or pays the gain (the vault balance carries it)
        let rs = &mut ctx.accounts.reserve;
        rs.reserved = rs.reserved.saturating_sub(run.reserved);
        rs.lines = rs.lines.saturating_sub(run.line);
        if run.mode == MODE_SOLO {
            rs.staked = rs.staked.saturating_sub(run.stake);
        }
        rs.runs += 1;
        rs.borrowed_volume += line_of(run.stake, run.max_step, run.mode == MODE_PACK);
        rs.fees += run.cost;
        if payout > cost {
            rs.paid_to_players += payout - cost;
        } else {
            rs.kept_from_players += cost - payout;
        }
        run.reserved = 0;
        run.line = 0;
        run.payout = payout;
        run.status = RUN_SETTLED;
        msg!("settled run {} of {}: {} paid, {} borrow cost", run.nonce, run.player, payout, run.cost);
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

    /// Create the relay price account of an xStock market, naming the key
    /// allowed to push its prices.
    pub fn init_relay(ctx: Context<InitRelay>, market: u8, exponent: i32, relayer: Pubkey) -> Result<()> {
        require!(is_relay(market), ClimbError::BadAsset);
        let f = &mut ctx.accounts.relay;
        f.market = market;
        f.exponent = exponent;
        f.relayer = relayer;
        f.bump = ctx.bumps.relay;
        Ok(())
    }

    /// Hand a relay account to the rollup, where prices are pushed for free.
    pub fn delegate_relay(ctx: Context<DelegateRelay>, market: u8) -> Result<()> {
        require!(is_relay(market), ClimbError::BadAsset);
        ctx.accounts.delegate_relay(
            &ctx.accounts.admin,
            &[RELAY_SEED, &[market]],
            DelegateConfig { validator: ctx.remaining_accounts.first().map(|v| v.key()), ..Default::default() },
        )?;
        Ok(())
    }

    /// Open the Sirocco desk (spread, the market tokens) and the Solana quotes its opening fills read.
    pub fn init_desk(ctx: Context<InitDesk>, spread_bps: u16, mints: [Pubkey; ASSETS], decimals: [u8; ASSETS], relayer: Pubkey) -> Result<()> {
        require!(spread_bps < 1_000, ClimbError::BadPrice);
        let d = &mut ctx.accounts.desk;
        d.admin = ctx.accounts.admin.key();
        d.spread_bps = spread_bps;
        d.mints = mints;
        d.decimals = decimals;
        d.bump = ctx.bumps.desk;
        let q = &mut ctx.accounts.quotes;
        q.relayer = relayer;
        q.bump = ctx.bumps.quotes;
        Ok(())
    }

    /// Change the desk's spread or a market's token (admin).
    pub fn set_desk(ctx: Context<SetDesk>, spread_bps: u16, mints: [Pubkey; ASSETS], decimals: [u8; ASSETS]) -> Result<()> {
        require!(spread_bps < 1_000, ClimbError::BadPrice);
        let d = &mut ctx.accounts.desk;
        d.spread_bps = spread_bps;
        d.mints = mints;
        d.decimals = decimals;
        Ok(())
    }

    /// The relay pushes its prices on Solana too, for the opening fills (same raw units as the rollup).
    pub fn push_quotes(ctx: Context<PushQuotes>, prices: [u64; ASSETS], ts: i64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let q = &mut ctx.accounts.quotes;
        require_keys_eq!(ctx.accounts.relayer.key(), q.relayer, ClimbError::Unauthorized);
        require!(ts >= q.ts && ts <= now + 5, ClimbError::BadPrice);
        for (i, p) in prices.iter().enumerate() {
            if *p > 0 {
                q.prices[i] = *p;
            }
        }
        q.ts = ts;
        q.updates += 1;
        Ok(())
    }

    /// Mint test USDC into the desk's tUSDC account (admin): its float for buying back and paying out.
    pub fn fund_desk(ctx: Context<FundDesk>, amount: u64) -> Result<()> {
        let desk_key = ctx.accounts.desk.key();
        require_keys_eq!(ctx.accounts.desk_usdc.key(), ata_of(&desk_key, &ctx.accounts.config.usdc_mint, &TOKEN_PROGRAM_ID), ClimbError::BadTokenAccount);
        let seeds: &[&[u8]] = &[CONFIG_SEED, &[ctx.accounts.config.bump]];
        token_mint_to(&ctx.accounts.token_program, &ctx.accounts.usdc_mint, &ctx.accounts.desk_usdc, &ctx.accounts.config.to_account_info(), amount, seeds)
    }

    // ========================================================= ephemeral rollup

    /// Push an xStock price into its relay account (rollup, no fee). Only the
    /// relay key named at init; prices must not go back in time nor come from
    /// the future. A climb reads it like an oracle feed, with the same
    /// staleness rule (`MAX_PRICE_AGE`).
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
        require!(run.units_open > 0, ClimbError::NoPosition);
        let signer = ctx.accounts.payer.key();
        require!(signer == run.session || signer == run.player || now > run.created_ts + BEGIN_GRACE, ClimbError::Unauthorized);
        let (price, ts) = read_feed(&ctx.accounts.feed, run.asset)?;
        require!(now - ts <= MAX_PRICE_AGE, ClimbError::StalePrice);
        // Pyth keeps publishing a frozen price while a market is closed.
        require!(hours::in_session(run.asset, now), ClimbError::MarketClosed);
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
/// The reserve's cash for its share price: the vault, plus the tUSDC it paid the desk for the tokens
/// long climbs hold, less the tUSDC it holds for the tokens short climbs sold (both come back at settlement).
fn reserve_cash(vault: u64, desk: &Desk) -> u64 {
    (vault + desk.open_long_cost).saturating_sub(desk.open_short_proceeds)
}

/// Settle the climb's real position on Solana: move the leverage steps booked on the rollup (a long buys
/// those tokens from the desk with the borrowed tUSDC; a short borrows them and sells them to the desk),
/// then close it at the exit price (a long sells everything back to the desk; a short buys it back and
/// returns it to the lending book). Records the real P&L.
fn close_position(acc: &mut SettleRun, lend_bump: u8) -> Result<()> {
    let run = &mut acc.run;
    let a = run.asset as usize;
    let desk = &mut acc.desk;
    let mint = acc.mint.key();
    require_keys_eq!(mint, desk.mints[a], ClimbError::BadMint);
    let desk_key = desk.key();
    require_keys_eq!(acc.desk_token.key(), ata_of(&desk_key, &mint, &TOKEN_2022_PROGRAM_ID), ClimbError::BadTokenAccount);
    require_keys_eq!(acc.desk_usdc.key(), ata_of(&desk_key, &acc.config.usdc_mint, &TOKEN_PROGRAM_ID), ClimbError::BadTokenAccount);
    require_keys_eq!(acc.escrow.key(), ata_of(&run.key(), &mint, &TOKEN_2022_PROGRAM_ID), ClimbError::BadTokenAccount);
    require_keys_eq!(acc.lend_token.key(), ata_of(&acc.lend.key(), &mint, &TOKEN_2022_PROGRAM_ID), ClimbError::BadTokenAccount);
    let dec = run.decimals;
    let long = run.side != SIDE_SHORT;
    let step_units = run.units - run.units_open;
    let step_usdc = run.notional - run.notional_open;
    // a climb that never began closes where it opened
    let exit = if run.last_price > 0 {
        if long { bid(run.last_price, run.spread_bps) } else { ask(run.last_price, run.spread_bps) }
    } else {
        run.fill_price
    };
    let exit_usdc = usdc_for(run.units, exit, EXPONENTS[a], dec);
    let player = run.player;
    let config_seeds: &[&[u8]] = &[CONFIG_SEED, &[acc.config.bump]];
    let desk_seeds: &[&[u8]] = &[DESK_SEED, &[desk.bump]];
    let lend_seeds: &[&[u8]] = &[LEND_SEED, &[lend_bump]];
    let run_seeds: &[&[u8]] = &[RUN_SEED, player.as_ref(), &[run.bump]];
    let t22 = &acc.token_2022_program.to_account_info();
    let tp = &acc.token_program.to_account_info();
    let (vault, desk_usdc, desk_token, escrow, lend_token, mint_ai) = (
        &acc.vault.to_account_info(), &acc.desk_usdc.to_account_info(), &acc.desk_token.to_account_info(),
        &acc.escrow.to_account_info(), &acc.lend_token.to_account_info(), &acc.mint.to_account_info(),
    );
    let (config_ai, desk_ai, lend_ai, run_ai) = (acc.config.to_account_info(), desk.to_account_info(), acc.lend.to_account_info(), run.to_account_info());
    if long {
        if step_units > 0 {
            token_transfer(tp, vault, desk_usdc, &config_ai, step_usdc, Some(config_seeds))?;
            token22_transfer(t22, desk_token, mint_ai, escrow, &desk_ai, step_units, dec, desk_seeds)?;
        }
        token22_transfer(t22, escrow, mint_ai, desk_token, &run_ai, run.units, dec, run_seeds)?;
        token_transfer(tp, desk_usdc, vault, &desk_ai, exit_usdc, Some(desk_seeds))?;
        desk.open_long_cost = desk.open_long_cost.saturating_sub(run.notional_open);
    } else {
        if step_units > 0 {
            token22_transfer(t22, lend_token, mint_ai, escrow, &lend_ai, step_units, dec, lend_seeds)?;
            token22_transfer(t22, escrow, mint_ai, desk_token, &run_ai, step_units, dec, run_seeds)?;
            token_transfer(tp, desk_usdc, vault, &desk_ai, step_usdc, Some(desk_seeds))?;
        }
        token_transfer(tp, vault, desk_usdc, &config_ai, exit_usdc, Some(config_seeds))?;
        token22_transfer(t22, desk_token, mint_ai, escrow, &desk_ai, run.units, dec, desk_seeds)?;
        token22_transfer(t22, escrow, mint_ai, lend_token, &run_ai, run.units, dec, run_seeds)?;
        desk.open_short_proceeds = desk.open_short_proceeds.saturating_sub(run.notional_open);
    }
    desk.trades += 1;
    desk.volume += step_usdc + exit_usdc;
    run.exit_fill = exit;
    run.real_pnl = real_pnl(long, run.notional, exit_usdc);
    msg!("close {} units at {}: real P&L {}", run.units, exit, run.real_pnl);
    Ok(())
}

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
/// owned by the pricing oracle; the xStock relay accounts are ours. Address
/// pinned to the asset, owner checked, price must be positive.
fn read_feed(f: &AccountInfo, asset: u8) -> Result<(u64, i64)> {
    require!((asset as usize) < ASSETS, ClimbError::BadAsset);
    require_keys_eq!(*f.key, FEEDS[asset as usize], ClimbError::WrongFeed);
    if is_relay(asset) {
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
    /// Settled climbs, money staked, money paid out. `rounds` is from the retired round mode.
    pub runs: u64,
    pub rounds: u64,
    pub volume: u64,
    pub paid: u64,
    pub bump: u8,
}

/// An xStock price pushed by a named relay key (24/7 source), for markets
/// MagicBlock does not feed into the rollups. Lives on the rollup.
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
pub struct CloseRoundSlot<'info> {
    #[account(mut, address = config.admin @ ClimbError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    /// CHECK: the retired round slot PDA, owner and status checked in the handler.
    #[account(mut, seeds = [ROUND_SEED, &[slot]], bump)]
    pub round: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct InitReserve<'info> {
    #[account(mut, address = config.admin @ ClimbError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(init, payer = admin, space = 8 + Reserve::INIT_SPACE, seeds = [RESERVE_SEED], bump)]
    pub reserve: Box<Account<'info, Reserve>>,
    #[account(init, payer = admin, space = 8 + Lender::INIT_SPACE, seeds = [LENDER_SEED, admin.key().as_ref()], bump)]
    pub lender: Box<Account<'info, Lender>>,
    /// CHECK: the config's vault.
    #[account(address = config.vault @ ClimbError::BadVault)]
    pub vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    /// The wallet, or a session key authorised by it.
    #[account(mut)]
    pub signer: Signer<'info>,
    /// CHECK: the lender (the wallet).
    pub owner: UncheckedAccount<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [RESERVE_SEED], bump = reserve.bump)]
    pub reserve: Box<Account<'info, Reserve>>,
    #[account(seeds = [DESK_SEED], bump = desk.bump)]
    pub desk: Box<Account<'info, Desk>>,
    #[account(init_if_needed, payer = signer, space = 8 + Lender::INIT_SPACE, seeds = [LENDER_SEED, owner.key().as_ref()], bump)]
    pub lender: Box<Account<'info, Lender>>,
    /// CHECK: the lender's test-USDC account, checked in `stake_in`.
    #[account(mut)]
    pub owner_usdc: UncheckedAccount<'info>,
    /// CHECK: the config's vault.
    #[account(mut, address = config.vault @ ClimbError::BadVault)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: address-checked SPL Token program.
    #[account(address = TOKEN_PROGRAM_ID)]
    pub token_program: UncheckedAccount<'info>,
    pub session_token: Option<Account<'info, SessionTokenV2>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub signer: Signer<'info>,
    /// CHECK: the lender (the wallet).
    pub owner: UncheckedAccount<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [RESERVE_SEED], bump = reserve.bump)]
    pub reserve: Box<Account<'info, Reserve>>,
    #[account(seeds = [DESK_SEED], bump = desk.bump)]
    pub desk: Box<Account<'info, Desk>>,
    #[account(mut, seeds = [LENDER_SEED, owner.key().as_ref()], bump = lender.bump)]
    pub lender: Box<Account<'info, Lender>>,
    /// CHECK: the lender's test-USDC account, owner checked in the handler.
    #[account(mut)]
    pub owner_usdc: UncheckedAccount<'info>,
    /// CHECK: the config's vault.
    #[account(mut, address = config.vault @ ClimbError::BadVault)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: address-checked SPL Token program.
    #[account(address = TOKEN_PROGRAM_ID)]
    pub token_program: UncheckedAccount<'info>,
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[derive(Accounts)]
pub struct GrowRun<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: a run PDA written by an older layout; owner checked in the handler.
    #[account(mut, seeds = [RUN_SEED, player.key().as_ref()], bump)]
    pub run: UncheckedAccount<'info>,
    /// CHECK: the run's player.
    pub player: UncheckedAccount<'info>,
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
    #[account(mut, seeds = [RESERVE_SEED], bump = reserve.bump)]
    pub reserve: Box<Account<'info, Reserve>>,
    #[account(seeds = [DESK_SEED], bump = desk.bump)]
    pub desk: Box<Account<'info, Desk>>,
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
    #[account(mut, seeds = [RESERVE_SEED], bump = reserve.bump)]
    pub reserve: Box<Account<'info, Reserve>>,
    /// CHECK: the player's test-USDC account, checked in the handler.
    #[account(mut)]
    pub player_usdc: UncheckedAccount<'info>,
    /// CHECK: the config's vault.
    #[account(mut, address = config.vault @ ClimbError::BadVault)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: address-checked SPL Token program.
    #[account(address = TOKEN_PROGRAM_ID)]
    pub token_program: UncheckedAccount<'info>,
    #[account(mut, seeds = [DESK_SEED], bump = desk.bump)]
    pub desk: Box<Account<'info, Desk>>,
    /// CHECK: the market's token mint, checked against the desk when the climb holds a position.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: the desk's token account (checked in `close_position`).
    #[account(mut)]
    pub desk_token: UncheckedAccount<'info>,
    /// CHECK: the desk's tUSDC account (checked in `close_position`).
    #[account(mut)]
    pub desk_usdc: UncheckedAccount<'info>,
    /// CHECK: the climb's escrow (checked in `close_position`).
    #[account(mut)]
    pub escrow: UncheckedAccount<'info>,
    /// CHECK: the stock-lending book (a PDA, authority of its token accounts).
    #[account(seeds = [LEND_SEED], bump)]
    pub lend: UncheckedAccount<'info>,
    /// CHECK: the lending book's token account (checked in `close_position`).
    #[account(mut)]
    pub lend_token: UncheckedAccount<'info>,
    /// CHECK: address-checked Token-2022 program.
    #[account(address = TOKEN_2022_PROGRAM_ID)]
    pub token_2022_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct OpenPosition<'info> {
    /// The climb's session key (or the wallet): pays the escrow's rent the first time.
    #[account(mut)]
    pub signer: Signer<'info>,
    /// CHECK: the climb's player.
    pub player: UncheckedAccount<'info>,
    #[account(mut, seeds = [RUN_SEED, player.key().as_ref()], bump = run.bump)]
    pub run: Box<Account<'info, Run>>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(seeds = [QUOTES_SEED], bump = quotes.bump)]
    pub quotes: Box<Account<'info, Quotes>>,
    #[account(mut, seeds = [DESK_SEED], bump = desk.bump)]
    pub desk: Box<Account<'info, Desk>>,
    /// CHECK: the market's token mint, checked against the desk.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: the desk's token account (checked in the handler).
    #[account(mut)]
    pub desk_token: UncheckedAccount<'info>,
    /// CHECK: the desk's tUSDC account (checked in the handler).
    #[account(mut)]
    pub desk_usdc: UncheckedAccount<'info>,
    /// CHECK: the config's vault.
    #[account(mut, address = config.vault @ ClimbError::BadVault)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: the climb's escrow, the run PDA's associated token account (created in the handler).
    #[account(mut)]
    pub escrow: UncheckedAccount<'info>,
    /// CHECK: the stock-lending book (a PDA, authority of its token accounts).
    #[account(seeds = [LEND_SEED], bump)]
    pub lend: UncheckedAccount<'info>,
    /// CHECK: the lending book's token account (checked in the handler).
    #[account(mut)]
    pub lend_token: UncheckedAccount<'info>,
    /// CHECK: address-checked SPL Token program.
    #[account(address = TOKEN_PROGRAM_ID)]
    pub token_program: UncheckedAccount<'info>,
    /// CHECK: address-checked Token-2022 program.
    #[account(address = TOKEN_2022_PROGRAM_ID)]
    pub token_2022_program: UncheckedAccount<'info>,
    /// CHECK: address-checked associated token program.
    #[account(address = ATA_PROGRAM_ID)]
    pub ata_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitDesk<'info> {
    #[account(mut, address = config.admin @ ClimbError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(init, payer = admin, space = 8 + Desk::INIT_SPACE, seeds = [DESK_SEED], bump)]
    pub desk: Box<Account<'info, Desk>>,
    #[account(init, payer = admin, space = 8 + Quotes::INIT_SPACE, seeds = [QUOTES_SEED], bump)]
    pub quotes: Box<Account<'info, Quotes>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetDesk<'info> {
    #[account(address = desk.admin @ ClimbError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(mut, seeds = [DESK_SEED], bump = desk.bump)]
    pub desk: Box<Account<'info, Desk>>,
}

#[derive(Accounts)]
pub struct PushQuotes<'info> {
    pub relayer: Signer<'info>,
    #[account(mut, seeds = [QUOTES_SEED], bump = quotes.bump)]
    pub quotes: Box<Account<'info, Quotes>>,
}

#[derive(Accounts)]
pub struct FundDesk<'info> {
    #[account(address = config.admin @ ClimbError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(seeds = [DESK_SEED], bump = desk.bump)]
    pub desk: Box<Account<'info, Desk>>,
    /// CHECK: the config's mint.
    #[account(mut, address = config.usdc_mint @ ClimbError::BadMint)]
    pub usdc_mint: UncheckedAccount<'info>,
    /// CHECK: the desk's tUSDC account (its associated token account, checked in the handler).
    #[account(mut)]
    pub desk_usdc: UncheckedAccount<'info>,
    /// CHECK: address-checked SPL Token program.
    #[account(address = TOKEN_PROGRAM_ID)]
    pub token_program: UncheckedAccount<'info>,
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
