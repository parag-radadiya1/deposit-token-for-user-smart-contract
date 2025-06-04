use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Token, TokenAccount, Mint},
};
use crate::state::*;
use crate::errors::ErrorCode;
use crate::events::*;


/// Deposit tokens to user's ATA
pub fn deposit_tokens(
    ctx: Context<DepositTokens>,
    user_id: String,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    // Transfer tokens from user's wallet to PDA's ATA
    let cpi_accounts = anchor_spl::token::Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.user_pda_ata.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    anchor_spl::token::transfer(cpi_ctx, amount)?;

    msg!("✅ Deposited {} tokens for user '{}'", amount, user_id);

    // Emit event
    emit!(TokensDeposited {
        user_id,
        amount,
        depositor: ctx.accounts.user.key(),
        pda_ata: ctx.accounts.user_pda_ata.key(),
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(user_id: String)]
pub struct DepositTokens<'info> {
    #[account(
        seeds = [b"deposit", user_id.as_bytes()],
        bump = user_pda.bump
    )]
    pub user_pda: Account<'info, UserPDA>,

    /// User's ATA (owned by PDA)
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user_pda,
    )]
    pub user_pda_ata: Account<'info, TokenAccount>,

    /// User's source token account (they own this)
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}