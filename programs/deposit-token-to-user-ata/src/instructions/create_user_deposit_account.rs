use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Token, TokenAccount, Mint},
};
use crate::state::*;
use crate::events::*;

/// Create a user-specific PDA and its Associated Token Account in one transaction
/// Returns both the PDA address and ATA address
pub fn create_user_deposit_account(
    ctx: Context<CreateUserDepositAccount>,
    user_id: String
) -> Result<CreateAccountResult> {
    let user_pda = &mut ctx.accounts.user_pda;

    // Initialize the PDA with user data
    user_pda.user_id = user_id.clone();
    user_pda.owner = ctx.accounts.payer.key();
    // user_pda.bump = *ctx.bumps.get("user_pda").unwrap();
    user_pda.bump = ctx.bumps.user_pda;
    user_pda.created_at = Clock::get()?.unix_timestamp;

    // The ATA is automatically created by Anchor constraints with PDA as authority
    // Store the ATA address in the PDA for easy reference
    user_pda.token_account = ctx.accounts.user_ata.key();

    let pda_address = user_pda.key();
    let ata_address = ctx.accounts.user_ata.key();

    msg!("✅ Created PDA for user '{}': {}", user_id, pda_address);
    msg!("✅ Created ATA with PDA authority: {}", ata_address);
    msg!("🔑 ATA Owner: {}", ctx.accounts.user_ata.owner);
    msg!("🎯 Deposit Address (PDA): {}", pda_address);
    msg!("💰 Token Account (ATA): {}", ata_address);

    // Emit event
    emit!(UserDepositAccountCreated {
            user_id: user_id.clone(),
            pda_address,
            token_account: ata_address,
            owner: ctx.accounts.payer.key(),
        });

    // Return both addresses
    let result = CreateAccountResult {
        pda_address,
        ata_address,
        user_id: user_id.clone(),
        success: true,
    };

    Ok(result)
}

#[derive(Accounts)]
#[instruction(user_id: String)]
pub struct CreateUserDepositAccount<'info> {
    #[account(
        init,
        payer = payer,
        space = UserPDA::space(&user_id),
        seeds = [b"deposit", user_id.as_bytes()],
        bump
    )]
    pub user_pda: Account<'info, UserPDA>,

    /// ATA owned by the PDA - this is crucial for proper ownership
    #[account(
        init,
        payer = payer,
        associated_token::mint = subscription_token_mint,
        associated_token::authority = user_pda,
    )]
    pub user_ata: Account<'info, TokenAccount>,

    pub subscription_token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// Return type for create_user_deposit_account
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateAccountResult {
    pub pda_address: Pubkey,
    pub ata_address: Pubkey,
    pub user_id: String,
    pub success: bool,
}