#!/usr/bin/env bash
# Devnet mirrors of the Backed xStocks and of Tether Gold (no devnet mint exists):
# Token-2022 mints with the metadata extension, same name, symbol and decimals as
# mainnet (xStocks 8, XAUt 6). The Sirocco desk trades them (ops/desk.mjs).
# Paid for and owned by Siroclimb's deployer; keys in ~/.config/siroclimb/solana/.
set -euo pipefail
KEYS="${SIROCLIMB_KEYS:-$HOME/.config/siroclimb/solana}"
DEPLOYER="$KEYS/deployer.json"
RPC="${SIROCLIMB_BASE_RPC:-https://rpc.magicblock.app/devnet}"
for t in "TSLAx|Tesla xStock|8" "NVDAx|NVIDIA xStock|8" "AAPLx|Apple xStock|8" "MSTRx|MicroStrategy xStock|8" "XAUt|Tether Gold|6"; do
  S=${t%%|*}; R=${t#*|}; N=${R%|*}; DEC=${R#*|}; K="$KEYS/mirror-$S.json"
  [ -f "$K" ] || solana-keygen new --no-bip39-passphrase -s -o "$K" >/dev/null
  M=$(solana-keygen pubkey "$K")
  if ! spl-token -u "$RPC" display "$M" >/dev/null 2>&1; then
    spl-token -u "$RPC" --fee-payer "$DEPLOYER" create-token --program-2022 --enable-metadata --decimals "$DEC" --mint-authority "$(solana-keygen pubkey "$DEPLOYER")" "$K" >/dev/null
    spl-token -u "$RPC" --fee-payer "$DEPLOYER" initialize-metadata "$M" "$N" "$S" "$([ "$S" = XAUt ] && echo https://gold.tether.to || echo https://xstocks.fi)" --update-authority "$(solana-keygen pubkey "$DEPLOYER")" --mint-authority "$DEPLOYER" >/dev/null
  fi
  echo "$S $M"
done
