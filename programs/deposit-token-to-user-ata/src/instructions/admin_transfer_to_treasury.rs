use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Token, TokenAccount, Mint},
};
use crate::state::*;
use crate::errors::ErrorCode;
use crate::events::*;

pub fn admin_transfer_to_treasury(
    ctx: Context<AdminTransferToTreasury>,
    user_id: String,
    amount: u64,
) -> Result<()> {
    // Validate inputs
    require!(amount > 0, ErrorCode::InvalidAmount);
    require!(!user_id.is_empty(), ErrorCode::EmptyUserId);
    require!(user_id.len() <= 50, ErrorCode::UserIdTooLong);

    // Verify admin authorization
    require!(
        ctx.accounts.admin_state.admin == ctx.accounts.admin.key(),
        ErrorCode::UnauthorizedAdmin
    );

    // Check if user PDA exists and is valid
    let expected_pda = Pubkey::create_program_address(
        &[b"deposit", user_id.as_bytes(), &[ctx.accounts.user_pda.bump]],
        ctx.program_id,
    ).map_err(|_| ErrorCode::InvalidPDA)?;

    require!(
        expected_pda == ctx.accounts.user_pda.key(),
        ErrorCode::InvalidPDA
    );

    // Verify treasury and token mint match
    require!(
        ctx.accounts.treasury_state.token_mint == ctx.accounts.mint.key(),
        ErrorCode::InvalidTokenMint
    );

    // Check if a user has sufficient balance
    require!(
        ctx.accounts.user_pda_ata.amount >= amount,
        ErrorCode::InsufficientBalance
    );

    // Create signer seeds for PDA
    let user_id_bytes = user_id.as_bytes();
    let seeds = &[
        b"deposit",
        user_id_bytes,
        &[ctx.accounts.user_pda.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // Transfer tokens from user's PDA ATA to treasury ATA
    let cpi_accounts = anchor_spl::token::Transfer {
        from: ctx.accounts.user_pda_ata.to_account_info(),
        to: ctx.accounts.treasury_ata.to_account_info(),
        authority: ctx.accounts.user_pda.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

    anchor_spl::token::transfer(cpi_ctx, amount)?;

    msg!("✅ Admin transferred {} tokens from user '{}' to treasury", amount, user_id);
    msg!("📊 User remaining balance: {}", ctx.accounts.user_pda_ata.amount - amount);

    emit!(AdminTransferredToTreasury {
        user_id,
        amount,
        admin: ctx.accounts.admin.key(),
        from_ata: ctx.accounts.user_pda_ata.key(),
        to_treasury: ctx.accounts.treasury_ata.key(),
        remaining_balance: ctx.accounts.user_pda_ata.amount - amount,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(user_id: String)]
pub struct AdminTransferToTreasury<'info> {
    #[account(
        seeds = [b"admin"],
        bump = admin_state.bump,
    )]
    pub admin_state: Account<'info, AdminState>,

    #[account(
        seeds = [b"treasury", mint.key().as_ref()],
        bump = treasury_state.bump,
        constraint = treasury_state.treasury_ata == treasury_ata.key() @ ErrorCode::InvalidTreasuryATA,
        constraint = treasury_state.token_mint == mint.key() @ ErrorCode::InvalidTokenMint,
    )]
    pub treasury_state: Account<'info, TreasuryState>,

    #[account(
        seeds = [b"deposit", user_id.as_bytes()],
        bump = user_pda.bump,
        constraint = user_pda.token_account == user_pda_ata.key() @ ErrorCode::InvalidUserATA,
    )]
    pub user_pda: Account<'info, UserPDA>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user_pda,
        constraint = user_pda_ata.amount > 0 @ ErrorCode::InsufficientBalance,
    )]
    pub user_pda_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = treasury_state,
    )]
    pub treasury_ata: Account<'info, TokenAccount>,

    #[account(
        constraint = mint.key() == treasury_state.token_mint @ ErrorCode::InvalidTokenMint
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = admin.key() == admin_state.admin @ ErrorCode::UnauthorizedAdmin
    )]
    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
}