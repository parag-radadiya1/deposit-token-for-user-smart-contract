use anchor_lang::prelude::*;
use anchor_spl::{
    token::{TokenAccount},
};
use crate::state::*;
/// Get treasury info (view function)
pub fn get_treasury_info(ctx: Context<GetTreasuryInfo>) -> Result<TreasuryInfo> {
    let treasury_state = &ctx.accounts.treasury_state;
    let treasury_balance = ctx.accounts.treasury_ata.amount;

    let info = TreasuryInfo {
        token_mint: treasury_state.token_mint,
        treasury_ata: treasury_state.treasury_ata,
        balance: treasury_balance,
        created_at: treasury_state.created_at,
    };

    msg!("Treasury Info - Mint: {}, ATA: {}, Balance: {}",
         info.token_mint, info.treasury_ata, info.balance);

    Ok(info)
}

#[derive(Accounts)]
pub struct GetTreasuryInfo<'info> {
    #[account(
        seeds = [b"treasury", treasury_state.token_mint.key().as_ref()],
        bump = treasury_state.bump,
    )]
    pub treasury_state: Account<'info, TreasuryState>,

    #[account(
        associated_token::mint = treasury_state.token_mint,
        associated_token::authority = treasury_state,
    )]
    pub treasury_ata: Account<'info, TokenAccount>,
}

// Return type for get_treasury_info
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct TreasuryInfo {
    pub token_mint: Pubkey,
    pub treasury_ata: Pubkey,
    pub balance: u64, // Current balance of the treasury ATA
    pub created_at: i64,
}