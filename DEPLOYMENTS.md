# Deployments (Solana devnet + MagicBlock devnet-eu)

## Keys

Everything below was created and is paid for by Siroclimb's own deployer, `DnSHPS8XgyNhTo8Yj5gVnA2ouXTe6t4c83W3AbcnLs7w` (`~/.config/siroclimb/solana/deployer.json`): it is the program's upgrade authority, the config admin, the xStock mirrors' mint authority, and the only key that funds the others (relay key, site faucet, keeper, house players, battery players, all under `~/.config/siroclimb/solana/`). The scripts refuse the Solana CLI default wallet.

## Program and accounts

| | Address |
|---|---|
| Program `siroclimb` | [`BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ`](https://explorer.solana.com/address/BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ?cluster=devnet) |
| Config PDA `["config"]` | [`2BwybAfVsxnhGKshVA3SuebZ4tASCwWoKBn9N2eum9Y9`](https://explorer.solana.com/address/2BwybAfVsxnhGKshVA3SuebZ4tASCwWoKBn9N2eum9Y9?cluster=devnet) |
| Sirocco test USDC (tUSDC, 6 decimals, mint authority = config) | [`4nkq8Ef2EfWkZ7LnF1MzH6YAV8cDGiQdePtKKr2UBAwo`](https://explorer.solana.com/address/4nkq8Ef2EfWkZ7LnF1MzH6YAV8cDGiQdePtKKr2UBAwo?cluster=devnet) |
| House vault (bankroll + round pots, owned by config) | [`Hn8FYbEy8dm9gMwjCKChJF2ooQxF1EFhHZrGD3qxRGx4`](https://explorer.solana.com/address/Hn8FYbEy8dm9gMwjCKChJF2ooQxF1EFhHZrGD3qxRGx4?cluster=devnet) |
| Round slot 0 `["round", 0]` | [`J93gViLDAvQLDnbvq2TZHKkteMZvjgajUQr2DrJkZDyw`](https://explorer.solana.com/address/J93gViLDAvQLDnbvq2TZHKkteMZvjgajUQr2DrJkZDyw?cluster=devnet) |
| Round slot 1 | [`FwHt7mEXBtzRykz62897Gu9ce7pFdwjD3HoKHCpeNrvy`](https://explorer.solana.com/address/FwHt7mEXBtzRykz62897Gu9ce7pFdwjD3HoKHCpeNrvy?cluster=devnet) |
| Round slot 2 | [`3sCza4CFkJQxsTepoFZ5LfiyA5ywnic31EgLu2g1XbCv`](https://explorer.solana.com/address/3sCza4CFkJQxsTepoFZ5LfiyA5ywnic31EgLu2g1XbCv?cluster=devnet) |
| Round slot 3 | [`BLyuHprNhznES6QoJHMmz8Jdag7p7XzizxRx1dgY4of4`](https://explorer.solana.com/address/BLyuHprNhznES6QoJHMmz8Jdag7p7XzizxRx1dgY4of4?cluster=devnet) |
| GBP/USD relay `["relay", 4]` (delegated, lives on the rollup) | [`2k53rB3byWy3dEQobyjZCfrMhhPJ5FmVbtp66KwwprWr`](https://explorer.solana.com/address/2k53rB3byWy3dEQobyjZCfrMhhPJ5FmVbtp66KwwprWr?cluster=custom&customUrl=https%3A%2F%2Fdevnet-eu.magicblock.app) |
| Relay key | `DzeEB8bDswhwwWiwGDkvQywnX3V97B7FPJUQfnwRUAvK` |
| VRF request identity `["identity"]` | `CeEPZEQLFiVQJ6RyKjTr6j4JAiJGkqUy3xFBNwVHh94J` |
| Site faucet key (devnet SOL for new wallets) | `A6koh5fTipjQLyVzJWB4fFwcivBF1G3w4e9KvmxfwTHH` |

Per player: profile `["profile", wallet]`, run `["run", wallet]` (one, reused climb after climb), faucet claim `["faucet", signer]`, session token `["session_token_v2", program, session key, wallet]` of the session-keys program.

While a climb or a round is live its account reads as owned by the delegation program (`DELeGG…`) on Solana: that is what a delegated account looks like. Its live state is on the rollup (explorer: custom cluster `https://devnet-eu.magicblock.app`).

## Markets

| Market | Price account (on the rollup) | Source | Devnet token mirror | Mainnet token |
|---|---|---|---|---|
| TSLAx | `8L7ccCxTBZaLsMMdhAod5fFnpdEWGSDPW4y1td7y3y8N` | Pyth Lazer 1435 `Equity.US.TSLA/USD`, expo -5 | [`EwksJmGYpSHWwznpeX8XGqHPBEhqyH4nHX92WH7uUz8g`](https://explorer.solana.com/address/EwksJmGYpSHWwznpeX8XGqHPBEhqyH4nHX92WH7uUz8g?cluster=devnet) Tesla xStock, 8 dec. | `XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB` |
| NVDAx | `3AD13yFytFWiLQbcGsnEXDeWZ9GZezSx6Y3NqZRoJMaC` | Pyth Lazer 1314 `Equity.US.NVDA/USD`, expo -5 | [`4hqVYfXyqy1R1Yr7hbRvq7veqqvrKCb7mXZE1CZdqdfJ`](https://explorer.solana.com/address/4hqVYfXyqy1R1Yr7hbRvq7veqqvrKCb7mXZE1CZdqdfJ?cluster=devnet) NVIDIA xStock, 8 dec. | `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh` |
| AAPLx | `B3P5AnSryJKeMk3FZcXsmpKVqoNmGYQE1rfE5KaoZNt1` | Pyth Lazer 922 `Equity.US.AAPL/USD`, expo -5 | [`yDvobkVXoAmXRPhJXn9C7nfh6GN3ppo9NiiEXyYdNBb`](https://explorer.solana.com/address/yDvobkVXoAmXRPhJXn9C7nfh6GN3ppo9NiiEXyYdNBb?cluster=devnet) Apple xStock, 8 dec. | `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp` |
| Gold | `9Eko45pM9kMQpz9N5d6Rcki8FMKUeyFb1tWhvixhBHBn` | Pyth Lazer 346 `Metal.XAU/USD`, expo -3 | | |
| GBP/USD | `2k53rB3byWy3dEQobyjZCfrMhhPJ5FmVbtp66KwwprWr` | program relay, Kraken GBP/USD mid, expo -5 | | |

Pyth Lazer feed accounts are PDAs `["price_feed", "pyth-lazer", id]` of MagicBlock's oracle program `PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd`. No devnet mint of the Backed xStocks exists (the mainnet addresses hold no mint on devnet), so the mirrors above copy their name, symbol and decimals (Token-2022 with the metadata extension, mint authority = Siroclimb's deployer; `npm run mirrors`).

## MagicBlock

| | |
|---|---|
| Rollup RPC | `https://devnet-eu.magicblock.app` |
| Validator | `MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e` (magicblock-core 2.0.4 on 23 Nov 2026) |
| Base RPC | `https://rpc.magicblock.app/devnet` |
| Delegation program | `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh` |
| Session keys program | `KeyspM2ssCJbqUhQ4k7sveSiY4WjnYsrXkC8oDbwde5` |
| VRF program / base queue | `Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz` / `Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh` |
| Price oracle | `PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd` |

## Battery players

The 24 battery players (realistic handles: saffron301, dune.sol, ghibli_hunter, gecko_fx, bora.sol, wolfx, …) are keypairs under `~/.config/siroclimb/battery/`; their profiles, climbs and round seats are on chain and fill the public leaderboard. Latest run: 400 / 400 checks on the upgraded program ([BATTERY.md](BATTERY.md)).

## Integration proof (explorer)

- Program: https://explorer.solana.com/address/BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ?cluster=devnet
- A TSLAx climb on the new deployment, step by step (probe, 24 Nov 2026):
  - stake + delegate on Solana: https://explorer.solana.com/tx/Fm7LLgXjLA3qnaWU9VxJQbZ4YCCKXMZk2wjNXZYB1wPbPKxCaADb18TAj7u1wAxw524ZrsZ3wVSPWi4H2hGE4BZ?cluster=devnet
  - begin on the rollup at the Pyth Lazer price, crank scheduled: https://explorer.solana.com/tx/GGSetUBgPiysTSUBC1Q2w7tcJ8oxPGivBw9aUXLnQNtjzEa5s3R5EjMmRShKab3upqVur54nZLVWrknpvf6Spb5?cluster=custom&customUrl=https%3A%2F%2Fdevnet-eu.magicblock.app
  - cash out + commit/undelegate on the rollup: https://explorer.solana.com/tx/2zMfxYLofWHwZuNERDV8XuMpK4MCErAG83vtEX4CnS43dwoeZiD445GggpMYEU1qbHiPEVhMTgeXWC3ie4SwzfaL?cluster=custom&customUrl=https%3A%2F%2Fdevnet-eu.magicblock.app
  - settle on Solana: https://explorer.solana.com/tx/2AnLz3Wj1ZFEkvDQoNvAr5jkhk6m8uKCNT4NvSRKd672xVQtfpsy4YNY5oYV3YU2cUHeBuctYVRAnuVFZkZHxEDW?cluster=devnet
- Every climb played in the front lists its own explorer links on the result screen.

## History

| Date | Change |
|---|---|
| 23 Nov 2026 | First deployment (crypto markets, used by the first probes) |
| 23 Nov 2026 | Upgrade in place: RWA markets (xStocks via equity feeds, gold, GBP/USD relay), boosts retuned. Profiles written by the first probes keep asset indices of the old market list. |
| 24 Nov 2026 | Upgrade in place: market hours on chain (`hours.rs`). `start_run` and `begin_run` refuse a market outside its New York sessions (`MarketClosed` 6026), round draws only among markets in session. Upgrade tx `Xr6HKAHjT71GYrcYqjLLFnACiX58Gic9JjszxopJ8KSLykruXS1pybrVzvxRKCvYffMu5FJhjFS1k1mWewxiZha` |
