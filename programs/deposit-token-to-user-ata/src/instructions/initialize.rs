use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Token, TokenAccount, Mint},
};
use crate::state::*;
use crate::events::*;


/// Initialize program with admin and treasury setup
pub fn initialize(ctx: Context<Initialize>, token_mint: Pubkey) -> Result<()> {
    // Initialize admin state
    let admin_state = &mut ctx.accounts.admin_state;
    admin_state.admin = ctx.accounts.payer.key();
    admin_state.bump = ctx.bumps.admin_state;
    admin_state.created_at = Clock::get()?.unix_timestamp;

    // Initialize treasury state
    let treasury_state = &mut ctx.accounts.treasury_state;
    treasury_state.token_mint = token_mint;
    treasury_state.treasury_ata = ctx.accounts.treasury_ata.key();
    treasury_state.bump = ctx.bumps.treasury_state;
    treasury_state.created_at = Clock::get()?.unix_timestamp;

    msg!("✅ Program initialized successfully");
    msg!("🔑 Admin wallet: {}", admin_state.admin);
    msg!("🏦 Treasury for mint {}: {}", token_mint, treasury_state.treasury_ata);

    emit!(ProgramInitialized {
        admin: admin_state.admin,
        token_mint,
        treasury_ata: treasury_state.treasury_ata,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(token_mint: Pubkey)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = AdminState::SPACE,
        seeds = [b"admin"],
        bump
    )]
    pub admin_state: Account<'info, AdminState>,

    #[account(
        init,
        payer = payer,
        space = TreasuryState::SPACE,
        seeds = [b"treasury", token_mint.key().as_ref()],
        bump
    )]
    pub treasury_state: Account<'info, TreasuryState>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = token_mint,
        associated_token::authority = treasury_state,
    )]
    pub treasury_ata: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
