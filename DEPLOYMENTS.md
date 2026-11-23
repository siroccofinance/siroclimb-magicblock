# Deployments (Solana devnet + MagicBlock devnet-eu)

## Program and accounts

| | Address |
|---|---|
| Program `siroclimb` | [`29sucV8aHGufy1AWrKzgp9gBPRHBG9jSxAsSWXe7M2ov`](https://explorer.solana.com/address/29sucV8aHGufy1AWrKzgp9gBPRHBG9jSxAsSWXe7M2ov?cluster=devnet) |
| Config PDA `["config"]` | [`GZR4ec1iw3pgAuyaMWZZZqe4QWABw1QosMk9LZeoX2W9`](https://explorer.solana.com/address/GZR4ec1iw3pgAuyaMWZZZqe4QWABw1QosMk9LZeoX2W9?cluster=devnet) |
| Sirocco test USDC (tUSDC, 6 decimals, mint authority = config) | [`8ZErCMxAWsxTn4wKLLhWduwquZbswFJAuKz7Mzybv6WV`](https://explorer.solana.com/address/8ZErCMxAWsxTn4wKLLhWduwquZbswFJAuKz7Mzybv6WV?cluster=devnet) |
| House vault (bankroll + round pots, owned by config) | [`2btrt3Tos9tnhr7958nXJe9G9PjVdCGgXSbv9ur67K8v`](https://explorer.solana.com/address/2btrt3Tos9tnhr7958nXJe9G9PjVdCGgXSbv9ur67K8v?cluster=devnet) |
| Round slot 0 `["round", 0]` | [`8pYZciJuWJxd5AtWqHqmjVrP1yuYVeYPhWGh5jHoVUSo`](https://explorer.solana.com/address/8pYZciJuWJxd5AtWqHqmjVrP1yuYVeYPhWGh5jHoVUSo?cluster=devnet) |
| Round slot 1 | [`EqtwEHyU1WpckaKDPMmicuYapd7eiXAFy2DBPngJPi6f`](https://explorer.solana.com/address/EqtwEHyU1WpckaKDPMmicuYapd7eiXAFy2DBPngJPi6f?cluster=devnet) |
| Round slot 2 | [`99v93U1xAo1zus1FuBxtyMjY9XawXtYu6hpZRuVieabv`](https://explorer.solana.com/address/99v93U1xAo1zus1FuBxtyMjY9XawXtYu6hpZRuVieabv?cluster=devnet) |
| Round slot 3 | [`7hhjU91MQxNZh9zJtjv76JiMsJs1WEq2K4YEknkW1sCu`](https://explorer.solana.com/address/7hhjU91MQxNZh9zJtjv76JiMsJs1WEq2K4YEknkW1sCu?cluster=devnet) |
| GBP/USD relay `["relay", 4]` (delegated, lives on the rollup) | [`83aBQdu2PkVcuw8NUg6nnvSGgX13jvdCE7LidgNcUw21`](https://explorer.solana.com/address/83aBQdu2PkVcuw8NUg6nnvSGgX13jvdCE7LidgNcUw21?cluster=custom&customUrl=https%3A%2F%2Fdevnet-eu.magicblock.app) |
| Relay key | `AVuSgiYwcwQkESNGosk21sxvDmQfRmAWJybB7Ucuwjo2` |
| VRF request identity `["identity"]` | `Aowxjfiw1sit2tKCnc91rK5GZoDNQS7xukiqRbAF7Uu2` |
| Site faucet key (devnet SOL for new wallets) | `4tRkjGRNDTutUNJBMh56hBkizxLSZ11PEcmNU5UwRYvx` |

Per player: profile `["profile", wallet]`, run `["run", wallet]` (one, reused climb after climb), faucet claim `["faucet", signer]`, session token `["session_token_v2", program, session key, wallet]` of the session-keys program.

While a climb or a round is live its account reads as owned by the delegation program (`DELeGG…`) on Solana: that is what a delegated account looks like. Its live state is on the rollup (explorer: custom cluster `https://devnet-eu.magicblock.app`).

## Markets

| Market | Price account (on the rollup) | Source | Devnet token mirror | Mainnet token |
|---|---|---|---|---|
| TSLAx | `8L7ccCxTBZaLsMMdhAod5fFnpdEWGSDPW4y1td7y3y8N` | Pyth Lazer 1435 `Equity.US.TSLA/USD`, expo -5 | [`9p4P41Ad8jFEVZsehjt6mjyg6uhsZkouoAesnGb7mPcU`](https://explorer.solana.com/address/9p4P41Ad8jFEVZsehjt6mjyg6uhsZkouoAesnGb7mPcU?cluster=devnet) Tesla xStock, 8 dec. | `XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB` |
| NVDAx | `3AD13yFytFWiLQbcGsnEXDeWZ9GZezSx6Y3NqZRoJMaC` | Pyth Lazer 1314 `Equity.US.NVDA/USD`, expo -5 | [`E4XAzgHmwAcZ1ajUfUdkDUPCen6CutyXZk218F5623WG`](https://explorer.solana.com/address/E4XAzgHmwAcZ1ajUfUdkDUPCen6CutyXZk218F5623WG?cluster=devnet) NVIDIA xStock, 8 dec. | `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh` |
| AAPLx | `B3P5AnSryJKeMk3FZcXsmpKVqoNmGYQE1rfE5KaoZNt1` | Pyth Lazer 922 `Equity.US.AAPL/USD`, expo -5 | [`DsPehKph9sP6FXAQTQSuZj6Us8XcKk9YKXt8LWfkAoW`](https://explorer.solana.com/address/DsPehKph9sP6FXAQTQSuZj6Us8XcKk9YKXt8LWfkAoW?cluster=devnet) Apple xStock, 8 dec. | `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp` |
| Gold | `9Eko45pM9kMQpz9N5d6Rcki8FMKUeyFb1tWhvixhBHBn` | Pyth Lazer 346 `Metal.XAU/USD`, expo -3 | | |
| GBP/USD | `83aBQdu2PkVcuw8NUg6nnvSGgX13jvdCE7LidgNcUw21` | program relay, Kraken GBP/USD mid, expo -5 | | |

Pyth Lazer feed accounts are PDAs `["price_feed", "pyth-lazer", id]` of MagicBlock's oracle program `PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd`. No devnet mint of the Backed xStocks exists (the mainnet addresses hold no mint on devnet), so the mirrors above copy their name, symbol and decimals (Token-2022 with the metadata extension, mint authority = the admin key).

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

## Integration proof (explorer)

- Program: https://explorer.solana.com/address/29sucV8aHGufy1AWrKzgp9gBPRHBG9jSxAsSWXe7M2ov?cluster=devnet
- A climb, step by step (probe, 23 Nov 2026):
  - stake + delegate on Solana: https://explorer.solana.com/tx/3HRCdpccuHXmSuLp5AcyCd4QqDGFpbm42UG65hSBouwkkNZNsQbJmuXv4vq2DpxeH4LQjtC3wp7ULULZeb4ATSza?cluster=devnet
  - begin on the rollup with the crank: https://explorer.solana.com/tx/5CBfkrzAGUUZv33JrwqiQcqV3j9JnTTaR2WbEJtVuyHMTzXASrfKCvEGVbRKPRWK7hJK5ZaEkDWCW5UgzyfdyFkB?cluster=custom&customUrl=https%3A%2F%2Fdevnet-eu.magicblock.app
  - cash out + commit/undelegate on the rollup: https://explorer.solana.com/tx/2Yaw14oCZSKUX2TDSmT4Lz3qZ7WxJ7yxXTW8hz92KSgfNZLWhwnWGM1uNnvjvowtQbWz5doxCRC8A5rF8zjFgiUo?cluster=custom&customUrl=https%3A%2F%2Fdevnet-eu.magicblock.app
  - settle on Solana: https://explorer.solana.com/tx/2CRvxpvo1g9pSbKxweejiHRpEaw4mZoVHCqgesQmLbJGoey5Uj8iNk2VPUgWvsjsFQPYGKUZxqhGge4mGFYfGh2T?cluster=devnet
- A round: VRF market draw, settlement 50/30/20 (probe): settle https://explorer.solana.com/tx/4du5BAGnXDbPn216r31CTKxZcARdv4os1S8Jea3Uja49SRJNwecJnBCwMSPkgRPvE1Qd24JBsdkfv5o8K7Fpoq9S?cluster=devnet
- A leverage pack VRF request: https://explorer.solana.com/tx/3fcfojWUocn3kPG1odomysFszZzUoZqKDjaCsTFREdygF5sr1GHNSrXvfwJ4jV4JgKo7BDke7HEXyzhkE1FQFGPK?cluster=devnet
- A GBP/USD relay push on the rollup: https://explorer.solana.com/tx/32WR1tmvYntxWodfXQQ5sq16NAPoRW2TXinGvHo6aXDXd9RuhaPNFkJJg36SmMeRytXvUBMgW9UisqGbwwr1bzon?cluster=custom&customUrl=https%3A%2F%2Fdevnet-eu.magicblock.app

## History

| Date | Change |
|---|---|
| 23 Nov 2026 | First deployment (crypto markets, used by the first probes) |
| 23 Nov 2026 | Upgrade in place: RWA markets (xStocks via equity feeds, gold, GBP/USD relay), boosts retuned. Profiles written by the first probes keep asset indices of the old market list. |
