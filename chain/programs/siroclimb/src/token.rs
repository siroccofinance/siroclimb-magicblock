//! The few SPL Token operations the game needs: read a token account, transfer,
//! mint. Written by hand instead of pulling `anchor-spl`, which roughly doubles
//! the program size (and the rent paid to deploy it).
use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::{invoke, invoke_signed};

use crate::game::ClimbError;

pub const TOKEN_PROGRAM_ID: Pubkey = pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_ACCOUNT_LEN: usize = 165;
const MINT_LEN: usize = 82;

/// Balance of an initialized token account of `mint`, optionally owned by `owner`.
pub fn token_balance(acc: &AccountInfo, mint: &Pubkey, owner: Option<&Pubkey>) -> Result<u64> {
    require_keys_eq!(*acc.owner, TOKEN_PROGRAM_ID, ClimbError::BadTokenAccount);
    let d = acc.try_borrow_data()?;
    require!(d.len() == TOKEN_ACCOUNT_LEN && d[108] == 1, ClimbError::BadTokenAccount);
    require!(d[0..32] == mint.to_bytes(), ClimbError::BadMint);
    if let Some(o) = owner {
        require!(d[32..64] == o.to_bytes(), ClimbError::BadTokenAccount);
    }
    Ok(u64::from_le_bytes(d[64..72].try_into().unwrap()))
}

/// An initialized mint whose mint authority is `authority`.
pub fn check_mint(acc: &AccountInfo, authority: &Pubkey) -> Result<()> {
    require_keys_eq!(*acc.owner, TOKEN_PROGRAM_ID, ClimbError::BadMint);
    let d = acc.try_borrow_data()?;
    require!(d.len() == MINT_LEN && d[45] == 1, ClimbError::BadMint);
    // COption<Pubkey>: tag u32 = 1, then the key.
    require!(d[0..4] == [1, 0, 0, 0] && d[4..36] == authority.to_bytes(), ClimbError::BadMint);
    Ok(())
}

pub fn token_transfer<'info>(
    token_program: &AccountInfo<'info>,
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    amount: u64,
    seeds: Option<&[&[u8]]>,
) -> Result<()> {
    let mut data = vec![3u8];
    data.extend_from_slice(&amount.to_le_bytes());
    let ix = Instruction {
        program_id: TOKEN_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(from.key(), false),
            AccountMeta::new(to.key(), false),
            AccountMeta::new_readonly(authority.key(), true),
        ],
        data,
    };
    let infos = [from.clone(), to.clone(), authority.clone(), token_program.clone()];
    match seeds {
        Some(s) => invoke_signed(&ix, &infos, &[s])?,
        None => invoke(&ix, &infos)?,
    }
    Ok(())
}

pub fn token_mint_to<'info>(
    token_program: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    amount: u64,
    seeds: &[&[u8]],
) -> Result<()> {
    let mut data = vec![7u8];
    data.extend_from_slice(&amount.to_le_bytes());
    let ix = Instruction {
        program_id: TOKEN_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(mint.key(), false),
            AccountMeta::new(to.key(), false),
            AccountMeta::new_readonly(authority.key(), true),
        ],
        data,
    };
    invoke_signed(&ix, &[mint.clone(), to.clone(), authority.clone(), token_program.clone()], &[seeds])?;
    Ok(())
}
