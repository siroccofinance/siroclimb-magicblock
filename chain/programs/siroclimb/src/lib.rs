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
use game::*;
use token::*;

declare_id!("BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ");

pub const CONFIG_SEED: &[u8] = b"config";
pub const FAUCET_SEED: &[u8] = b"faucet";
pub const PROFILE_SEED: &[u8] = b"profile";
pub const RUN_SEED: &[u8] = b"run";
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
/// A pack climb is played with this much of the house's money.
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
/// Price accounts, in asset order: MagicBlock's Pyth Lazer feeds on the
/// rollup, PDAs `["price_feed", "pyth-lazer", id]` of the pricing oracle:
/// TSLA (1435), NVDA (1314), AAPL (922) for the xStocks, XAU/USD (346) for
/// gold, GME (1160) for GMEx.
pub const FEEDS: [Pubkey; ASSETS] = [
    pubkey!("8L7ccCxTBZaLsMMdhAod5fFnpdEWGSDPW4y1td7y3y8N"),
    pubkey!("3AD13yFytFWiLQbcGsnEXDeWZ9GZezSx6Y3NqZRoJMaC"),
    pubkey!("B3P5AnSryJKeMk3FZcXsmpKVqoNmGYQE1rfE5KaoZNt1"),
    pubkey!("9Eko45pM9kMQpz9N5d6Rcki8FMKUeyFb1tWhvixhBHBn"),
    pubkey!("BjxWySYsKPbDfsNxLRPocTEB55RRPbAuWqMqUJHVgqpE"),
];
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

    // ========================================================= ephemeral rollup

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
/// owned by the pricing oracle. Address pinned to the asset, owner checked,
/// price must be positive.
fn read_feed(f: &AccountInfo, asset: u8) -> Result<(u64, i64)> {
    require!((asset as usize) < ASSETS, ClimbError::BadAsset);
    require_keys_eq!(*f.key, FEEDS[asset as usize], ClimbError::WrongFeed);
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
