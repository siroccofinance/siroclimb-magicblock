# Deployments (Solana devnet + MagicBlock devnet-eu)

## Keys

Everything below was created and is paid for by Siroclimb's own deployer, `DnSHPS8XgyNhTo8Yj5gVnA2ouXTe6t4c83W3AbcnLs7w` (`~/.config/siroclimb/solana/deployer.json`): it is the program's upgrade authority, the config admin, the xStock mirrors' mint authority, and the only key that funds the others (site faucet, keeper, house players, battery players, all under `~/.config/siroclimb/solana/`). The scripts refuse the Solana CLI default wallet.

## Program and accounts

| | Address |
|---|---|
| Program `siroclimb` | [`BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ`](https://explorer.solana.com/address/BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ?cluster=devnet) |
| Config PDA `["config"]` | [`2BwybAfVsxnhGKshVA3SuebZ4tASCwWoKBn9N2eum9Y9`](https://explorer.solana.com/address/2BwybAfVsxnhGKshVA3SuebZ4tASCwWoKBn9N2eum9Y9?cluster=devnet) |
| Sirocco test USDC (tUSDC, 6 decimals, mint authority = config) | [`4nkq8Ef2EfWkZ7LnF1MzH6YAV8cDGiQdePtKKr2UBAwo`](https://explorer.solana.com/address/4nkq8Ef2EfWkZ7LnF1MzH6YAV8cDGiQdePtKKr2UBAwo?cluster=devnet) |
| Vault (the Sirocco Reserve's tUSDC and the stakes in flight, owned by config) | [`Hn8FYbEy8dm9gMwjCKChJF2ooQxF1EFhHZrGD3qxRGx4`](https://explorer.solana.com/address/Hn8FYbEy8dm9gMwjCKChJF2ooQxF1EFhHZrGD3qxRGx4?cluster=devnet) |
| Sirocco Reserve `["reserve"]` | [`HVtcnGZVJNs8onUXyGiwCpxLx7jFSyk9Nac5rtLdtW7J`](https://explorer.solana.com/address/HVtcnGZVJNs8onUXyGiwCpxLx7jFSyk9Nac5rtLdtW7J?cluster=devnet) |
| Deployer's lender position `["lender", deployer]` (first lender: the 4,999,974 tUSDC bankroll) | [`GnWgQNx2wvqVvQM4sHRxVmBYRzUarpPdMQ1VMYkVMMyU`](https://explorer.solana.com/address/GnWgQNx2wvqVvQM4sHRxVmBYRzUarpPdMQ1VMYkVMMyU?cluster=devnet) |
| Round slot 0 (retired, closed 24 Nov 2026) | `J93gViLDAvQLDnbvq2TZHKkteMZvjgajUQr2DrJkZDyw` |
| Round slot 1 (retired, closed 24 Nov 2026) | `FwHt7mEXBtzRykz62897Gu9ce7pFdwjD3HoKHCpeNrvy` |
| Round slot 2 (retired, closed 24 Nov 2026) | `3sCza4CFkJQxsTepoFZ5LfiyA5ywnic31EgLu2g1XbCv` |
| Round slot 3 (retired, closed 24 Nov 2026) | `BLyuHprNhznES6QoJHMmz8Jdag7p7XzizxRx1dgY4of4` |
| VRF request identity `["identity"]` | `CeEPZEQLFiVQJ6RyKjTr6j4JAiJGkqUy3xFBNwVHh94J` |
| Site faucet key (devnet SOL for new wallets) | `A6koh5fTipjQLyVzJWB4fFwcivBF1G3w4e9KvmxfwTHH` |

Per player: profile `["profile", wallet]`, run `["run", wallet]` (one, reused climb after climb; 200 bytes since the reserve, older ones grown by `grow_run` before their next climb), lender position `["lender", wallet]`, faucet claim `["faucet", signer]`, session token `["session_token_v2", program, session key, wallet]` of the session-keys program.

While a climb is live its account reads as owned by the delegation program (`DELeGG…`) on Solana: that is what a delegated account looks like. Its live state is on the rollup (explorer: custom cluster `https://devnet-eu.magicblock.app`).

## Markets

| Market | Price account (on the rollup) | Source | Devnet token mirror | Mainnet token |
|---|---|---|---|---|
| TSLAx | `8L7ccCxTBZaLsMMdhAod5fFnpdEWGSDPW4y1td7y3y8N` | Pyth Lazer 1435 `Equity.US.TSLA/USD`, expo -5 | [`EwksJmGYpSHWwznpeX8XGqHPBEhqyH4nHX92WH7uUz8g`](https://explorer.solana.com/address/EwksJmGYpSHWwznpeX8XGqHPBEhqyH4nHX92WH7uUz8g?cluster=devnet) Tesla xStock, 8 dec. | `XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB` |
| NVDAx | `3AD13yFytFWiLQbcGsnEXDeWZ9GZezSx6Y3NqZRoJMaC` | Pyth Lazer 1314 `Equity.US.NVDA/USD`, expo -5 | [`4hqVYfXyqy1R1Yr7hbRvq7veqqvrKCb7mXZE1CZdqdfJ`](https://explorer.solana.com/address/4hqVYfXyqy1R1Yr7hbRvq7veqqvrKCb7mXZE1CZdqdfJ?cluster=devnet) NVIDIA xStock, 8 dec. | `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh` |
| AAPLx | `B3P5AnSryJKeMk3FZcXsmpKVqoNmGYQE1rfE5KaoZNt1` | Pyth Lazer 922 `Equity.US.AAPL/USD`, expo -5 | [`yDvobkVXoAmXRPhJXn9C7nfh6GN3ppo9NiiEXyYdNBb`](https://explorer.solana.com/address/yDvobkVXoAmXRPhJXn9C7nfh6GN3ppo9NiiEXyYdNBb?cluster=devnet) Apple xStock, 8 dec. | `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp` |
| Gold | `9Eko45pM9kMQpz9N5d6Rcki8FMKUeyFb1tWhvixhBHBn` | Pyth Lazer 346 `Metal.XAU/USD`, expo -3 | | |
| GMEx | `BjxWySYsKPbDfsNxLRPocTEB55RRPbAuWqMqUJHVgqpE` | Pyth Lazer 1160 `Equity.US.GME/USD`, expo -5 | [`FvpjxWsG9e2kGUEgkqXSBY2nzjYqopKJXp25d1pwsgy`](https://explorer.solana.com/address/FvpjxWsG9e2kGUEgkqXSBY2nzjYqopKJXp25d1pwsgy?cluster=devnet) GameStop xStock, 8 dec. | `Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc` |

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

The 24 battery players (realistic handles: mistrallynx, candleowl24, harmattan156, nvidiasmith24, bora692, …) are new keypairs under `~/.config/siroclimb/solana/battery/`, funded only by the deployer; their profiles and climbs are on chain and fill the public leaderboard. Latest run: 156 / 156 checks with the Sirocco Reserve ([BATTERY.md](BATTERY.md)).

## Integration proof (explorer)

- Program: https://explorer.solana.com/address/BS6874Pq8Biq7vuh1pxpuK2iPvkByJDkxyi6HWneTFfZ?cluster=devnet
- A TSLAx climb on the new deployment, step by step (probe, 24 Nov 2026):
  - stake + delegate on Solana: https://explorer.solana.com/tx/Fm7LLgXjLA3qnaWU9VxJQbZ4YCCKXMZk2wjNXZYB1wPbPKxCaADb18TAj7u1wAxw524ZrsZ3wVSPWi4H2hGE4BZ?cluster=devnet
  - begin on the rollup at the Pyth Lazer price, crank scheduled: https://explorer.solana.com/tx/GGSetUBgPiysTSUBC1Q2w7tcJ8oxPGivBw9aUXLnQNtjzEa5s3R5EjMmRShKab3upqVur54nZLVWrknpvf6Spb5?cluster=custom&customUrl=https%3A%2F%2Fdevnet-eu.magicblock.app
  - cash out + commit/undelegate on the rollup: https://explorer.solana.com/tx/2zMfxYLofWHwZuNERDV8XuMpK4MCErAG83vtEX4CnS43dwoeZiD445GggpMYEU1qbHiPEVhMTgeXWC3ie4SwzfaL?cluster=custom&customUrl=https%3A%2F%2Fdevnet-eu.magicblock.app
  - settle on Solana: https://explorer.solana.com/tx/2AnLz3Wj1ZFEkvDQoNvAr5jkhk6m8uKCNT4NvSRKd672xVQtfpsy4YNY5oYV3YU2cUHeBuctYVRAnuVFZkZHxEDW?cluster=devnet
- A GMEx climb after the GMEx upgrade (probe, 24 Nov 2026): stake + delegate [`48vnfqaK…`](https://explorer.solana.com/tx/48vnfqaKC1MPxKyPBcfqVKiBCbFMs7NGfWGTPdhhMsh9Fzd6mDJrSn1s18EwMbbySSqrer5taBzqmzVgeAJ4KxXc?cluster=devnet), begin at the GME price [`2wBFn2eH…`](https://explorer.solana.com/tx/2wBFn2eHi19WkWMEgbW7vZaGenNmohxbr61prGfoE7vbVwgBqPEZARacfagw8Ywj4b27ndaiQYZk7vQJ2hdzLnmy?cluster=custom&customUrl=https%3A%2F%2Fdevnet-eu.magicblock.app), cash out [`3oeDYyZh…`](https://explorer.solana.com/tx/3oeDYyZh3Lw5pimq2ZRPn9GDGxMAX7XTiAP4BXZ3wDL6YiYnEMH7XiMXhbMQ6UrxDZsvVv58sNe8PpD4R97acBBR?cluster=custom&customUrl=https%3A%2F%2Fdevnet-eu.magicblock.app), settle [`t6g8B644…`](https://explorer.solana.com/tx/t6g8B644sPxmwj5j3QwJTbfiAECCy3zwZm7qALFDGPtW7Z85HZF2ZJTXLtGxCRvrpVGMWJZkhRkCzd6S6AqwtY1?cluster=devnet)
- Every climb played in the front lists its own explorer links on the result screen.

## History

| Date | Change |
|---|---|
| 23 Nov 2026 | First deployment (crypto markets, used by the first probes) |
| 23 Nov 2026 | Upgrade in place: RWA markets (xStocks via equity feeds, gold, GBP/USD relay), boosts retuned. Profiles written by the first probes keep asset indices of the old market list. |
| 24 Nov 2026 | Upgrade in place: market hours on chain (`hours.rs`). `start_run` and `begin_run` refuse a market outside its New York sessions (`MarketClosed` 6026), round draws only among markets in session. Upgrade tx `Xr6HKAHjT71GYrcYqjLLFnACiX58Gic9JjszxopJ8KSLykruXS1pybrVzvxRKCvYffMu5FJhjFS1k1mWewxiZha` |
| 24 Nov 2026 | **Fresh deployment from Siroclimb's own deployer** `DnSHPS8X…`: new program id `BS6874Pq…` (tx `3LL2Yxtr…`), new config, mint, vault, slots, relay, mirrors and keys. The previous program `29sucV8a…` (deployed with another project's wallet) was closed and its rent, and the leftover SOL of its faucet, relay, keeper, house and battery keys, returned to that wallet; its keys are retired. |
| 24 Nov 2026 | Upgrade in place: **GMEx (GameStop xStock) replaces GBP/USD** at market index 4, read from MagicBlock's Pyth Lazer GME feed (1160) like the other stocks, US equity sessions on chain, boost 55. The relay instructions and `RelayFeed` account type are gone; the old relay account `2k53rB3b…` stays delegated on the rollup, unused. Config, mint, vault, round slots and profiles unchanged (profiles that recorded a GBP/USD climb now show it as GMEx). Upgrade tx [`5zWs3RLT…`](https://explorer.solana.com/tx/5zWs3RLT6HkkJnmeUs99BagQqisvDYEhoQRN4Xf41zr1GfJdXn1jXmsTHsJiU3Ke8MfmndpdvrCQbh1iv7PCbvfs?cluster=devnet) |
| 24 Nov 2026 | Upgrade in place: **solo only**. The round instructions and the `Round` account type are gone (binary 543 KB to 436 KB); `close_round_slot` (admin, idle slots only) closed the four round slots and returned 0.056 SOL of rent to the deployer. Profiles keep their round counters (layout unchanged); the config's `rounds` counter stays. Upgrade tx [`4hGTZC7o…`](https://explorer.solana.com/tx/4hGTZC7oiWbeJJVAjCDFXqLB25PoVwPDFfrNQEujeBWRpvLYEFT4JeYkw1SrFf8xG9voyJjH73Q189t8MCJ2nf6U?cluster=devnet); slots closed in [`5zapYBhh…`](https://explorer.solana.com/tx/5zapYBhhfESHD3CoehTFuKNY6JLy4ZxZRjNHBuc1mwrAv2ESEBR7joaFeESNvq3hto98eH92Kn7CfmBc2T9cBtEi?cluster=devnet), [`2T9F3HDA…`](https://explorer.solana.com/tx/2T9F3HDAR9UcuBSn3CHN8duRCF7svHf3aFkMfWaqG2fZh8VRCggvErXWJsxwHECWD6NFiWZy82jxRE6EwpumEAyF?cluster=devnet), [`2Z9ktERq…`](https://explorer.solana.com/tx/2Z9ktERqe4SoswvZtwJ7yDDKoSbN7Ujjafbz1YULa5yCaJAeh1dnSq433QPwEkPacoX2ebWg7eauEeqBY7RxyzSf?cluster=devnet), [`LwZE8arv…`](https://explorer.solana.com/tx/LwZE8arv5nvtXgbJ7yJFynJGNScQmmGUnksoHrZdpj7NKed9SfJMwjRCLReHFB4vcM87dUZ5zHfZ6AWnt3EPLCc?cluster=devnet) |
| 24 Nov 2026 | Upgrade in place: **the Sirocco Reserve**. The house bankroll becomes a tUSDC lending pool (`init_reserve`: 4,999,974 tUSDC, one share each, to the deployer); `deposit` / `withdraw` for lenders; every solo climb reserves 4 x its stake and records a 3 x stake borrow line, pays a borrow fee + interest at settlement, and is capped at 5 x its stake; `grow_run` brings run accounts to the new 200-byte layout. Binary 436 KB to 510 KB (still inside the 577,536-byte program account). Upgrade tx [`4TMYWH9W…`](https://explorer.solana.com/tx/4TMYWH9Wx6bFyVtFgnjxfvtn9ZispyMt6RADrgBsiNgChTocnSfXeyS3mjn9jHqqwqdueuBpp1U56W3i3Ue6unsQ?cluster=devnet), reserve opened in [`21Dubmq…`](https://explorer.solana.com/tx/21DubmqMmwXJ3886Y8dTmpEGQ8zx9Tus2YnG6qyfbjMW2Jdg7m2eZogGYkLNGnN2mm7f9UNbX8qyeV37DC9cAw5v?cluster=devnet); a first climb on it (GMEx, probe): settle [`23svTHMC…`](https://explorer.solana.com/tx/23svTHMCxyy9mwoB2x7zWLtJDAVJQwDtdRto5DbPX12fSvB6kFrVjYVN5RnHjxocN6LHAH1XQkZ6NZoxypFT6NF3?cluster=devnet) paid 10.196168 tUSDC = value 10.201168 - 0.005 fee on a 5 tUSDC peak borrow |
| 24 Nov 2026 | Upgrade in place: **the xStocks trade 24/7**. TSLAx, NVDAx, AAPLx and GMEx read program-owned relay accounts on the rollup instead of Pyth's US equity feeds (frozen outside US hours); gold keeps MagicBlock's XAU/USD feed and its sessions. Upgrade tx [`5diMRQCo…`](https://explorer.solana.com/tx/5diMRQCokx1vVTqF8iQofzZLmzzSAwvE1gUtKA81hwG9LYjnS9LKDAWVi4xnyaePmBPiQ8xtqdCeRDr8ac5nDJvu?cluster=devnet). Relays created and delegated by the deployer: TSLAx `EZzYNjVe…`, NVDAx `AuewuoKK…`, AAPLx `BMPPdknG…`; GMEx reuses the delegated relay account `2k53rB3b…` (same layout and relay key). Relay key `DzeEB8bD…` (`relayer.json`), in Vercel as `RELAYER_SECRET_KEY`. |
| 25 Nov 2026 | Upgrade in place: **gold trades 24/7 as XAUt**. Gold (asset 3) reads a relay account like the xStocks, pushed from Kraken's XAUt/USD mid with Jupiter's XAUt0 (`AymATz4T…`) as the check; every market is now `KIND_ALWAYS`. Upgrade tx [`2o6MnhNo…`](https://explorer.solana.com/tx/2o6MnhNoXhyQaiT3YDzWYjxa1NRkiiazQBdKa6s491niDnFB8W76DomXhSG4mDjHNqmnKQ4MqDw4kyAzP3snHsXW?cluster=devnet); gold relay `CGNjvcw4…` created and delegated (tx [`4PQ1st1y…`](https://explorer.solana.com/tx/4PQ1st1y1UDjnp2815G8C6kCKNGgC3rqccLjGBybZitFZ85KhSJarUqbEHAhd6S2dc8hxUFU9JVNaByYExHo9Mg3?cluster=devnet)) and pushed 2 s after the upgrade, front deployed 26 s later. |
| 25 Nov 2026 | Upgrade in place: **real positions through the Sirocco desk**. Program data extended by 64 KiB (577,536 to 643,072 bytes; the binary went from 534 KB to 637 KB), upgrade tx [`24W5PUc4…`](https://explorer.solana.com/tx/24W5PUc4x59NrvdfUwDFQNbF6DToWm2rinevxuxkm6i8rVAru9HZePEU4v8Dq6wDufs7C7AwwjDeZ17yXutHuvsz?cluster=devnet). Desk `DsVD5Der…` and Solana quotes opened by `init_desk` (tx [`3dQrUi6E…`](https://explorer.solana.com/tx/3dQrUi6EdoXHSrTmyPV3CRwHeRxEQaxnoVt6XCiugdGLWGCRZTb16ddzqmfJB3d3B8Lx8bkTPx3BV6GLZVfQy8AC?cluster=devnet)), spread 5 bps, quotes pushed by the relay key `DzeEB8bD…` (funded 0.15 SOL for its Solana pushes). XAUt mirror created (`FWruv7WP…`, Token-2022, 6 decimals). Inventories minted by the deployer (mint authority of the mirrors) to the desk and the lending book, and a 2,000,000 tUSDC float through `fund_desk` (table below). Front deployed 30 s after the upgrade. |

### The Sirocco desk (devnet)

| Account | Address |
|---|---|
| Desk (spread, mints, open positions) | [`DsVD5DeriAwKToCiW2EK5T4VXXBa3EiBzhmDSWsfeZHv`](https://explorer.solana.com/address/DsVD5DeriAwKToCiW2EK5T4VXXBa3EiBzhmDSWsfeZHv?cluster=devnet) |
| Desk tUSDC float (2,000,000) | [`3uAmakwMddooacTHJWN344UPaGo8wWkhMazqoTWrbdyQ`](https://explorer.solana.com/address/3uAmakwMddooacTHJWN344UPaGo8wWkhMazqoTWrbdyQ?cluster=devnet) |
| XAUt mirror mint (Token-2022, 6 decimals) | [`FWruv7WP2BuuL3ThDxfuGum1HGHe5uCMqTr8twJNaSQG`](https://explorer.solana.com/address/FWruv7WP2BuuL3ThDxfuGum1HGHe5uCMqTr8twJNaSQG?cluster=devnet) |

| Token | Desk inventory | Lending book |
|---|---|---|
| TSLAx (1,300) | [`CaeP5uv9…`](https://explorer.solana.com/address/CaeP5uv93sGpRpA8dfUoRMV1Di6x1UtwZSVGy7Z2FWuk?cluster=devnet) | [`A9HKycxG…`](https://explorer.solana.com/address/A9HKycxGzsrAuHfefuWG4wEEVmWtFDCceVhacU4dozmj?cluster=devnet) |
| NVDAx (3,300) | [`9vrXDt6r…`](https://explorer.solana.com/address/9vrXDt6rbcQVhbtVwBqmwJNtcaYwmDND9kFvvxvSeAPt?cluster=devnet) | [`B5uwkW7G…`](https://explorer.solana.com/address/B5uwkW7GZMaqQfwa6etZvLQdq8xMz6GmZY3BU8TwBnw8?cluster=devnet) |
| AAPLx (1,400) | [`5LMPhAzv…`](https://explorer.solana.com/address/5LMPhAzvYtcqNWgSoYd5AANfQAzuetEaTgvC1nRNga43?cluster=devnet) | [`CKnumSnf…`](https://explorer.solana.com/address/CKnumSnfmPhz2V4s7r3NKpNTmZwS3PqHATRBPe64v49L?cluster=devnet) |
| XAUt (140) | [`2wEdh3BH…`](https://explorer.solana.com/address/2wEdh3BHQckm61f4MhHSy2hzCjBBx7MNBag3dR8fHL4S?cluster=devnet) | [`8JmmqsJo…`](https://explorer.solana.com/address/8JmmqsJoVKHSyaS6AQyNALc1EELS4RzDkNBd53nBPjxU?cluster=devnet) |
| GMEx (18,000) | [`HjbcBwua…`](https://explorer.solana.com/address/HjbcBwuahA7NSH62EUYjuQWetSRj1LVcBkKboVRTrqf2?cluster=devnet) | [`ChgxMZmc…`](https://explorer.solana.com/address/ChgxMZmcMoyumXMy1SEagdGBEb7NVXcr1qpzkVCwRWMH?cluster=devnet) |

Each climb's escrow is the run PDA's Token-2022 account for the market token (`escrowOf(player, mint)` in `js/chain/pdas.js`); the result screen links it.

