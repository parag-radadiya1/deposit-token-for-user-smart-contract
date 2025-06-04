use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Token, TokenAccount, Mint},
};
use crate::state::*;
use crate::errors::ErrorCode;
use crate::events::*;


/// **NEW FUNCTION: Batch Admin Transfer to Treasury**
/// Allows the admin to transfer tokens from multiple user ATAs to the treasury
/// in a single transaction.
///
/// The `remaining_accounts` should be provided as pairs of `UserPDA` and `TokenAccount`
/// in the order they appear in `user_ids` and `amounts`.
///
/// Example `remaining_accounts` structure:
/// [user_pda_1, user_ata_1, user_pda_2, user_ata_2, ...]
pub fn admin_batch_transfer_to_treasury<'info>(
    ctx: Context<'_, '_, 'info, 'info, AdminBatchTransferToTreasury<'info>>, // CHANGE IS HERE
    user_ids: Vec<String>,
    amounts: Vec<u64>,
) -> Result<()> {
    // --- 1. Initial Validations ---
    require!(!user_ids.is_empty(), ErrorCode::EmptyUserList);
    require!(user_ids.len() <= 5, ErrorCode::TooManyUsers); // Limit for safety and compute units
    require!(user_ids.len() == amounts.len(), ErrorCode::MismatchedArrayLengths);
    require!(ctx.remaining_accounts.len() == user_ids.len() * 2, ErrorCode::InvalidAccountList);

    // Verify admin authorization
    require!(
            ctx.accounts.admin_state.admin == ctx.accounts.admin.key(),
            ErrorCode::UnauthorizedAdmin
        );

    // Verify treasury and token mint match
    require!(
            ctx.accounts.treasury_state.token_mint == ctx.accounts.mint.key(),
            ErrorCode::InvalidTokenMint
        );

    // Fix the lifetime issue by explicitly typing the iterator.
    // The `AccountInfo`s in `remaining_accounts` have the 'info lifetime.
    let mut remaining_accounts_iter: std::slice::Iter<'info, AccountInfo<'info>> = ctx.remaining_accounts.iter();
    let mut total_transferred_amount: u64 = 0; // Fix: Add explicit type

    // --- 2. Iterate and Transfer for Each User ---
    for i in 0..user_ids.len() {
        let user_id = &user_ids[i];
        let amount_to_transfer = amounts[i];

        require!(amount_to_transfer > 0, ErrorCode::InvalidAmount);
        require!(!user_id.is_empty(), ErrorCode::EmptyUserId);
        require!(user_id.len() <= 50, ErrorCode::UserIdTooLong);

        // Get the user_pda and user_pda_ata for the current user
        // Use .next() to consume from the iterator
        let user_pda_info = remaining_accounts_iter.next().ok_or(ErrorCode::InvalidAccountList)?;
        let user_pda_ata_info = remaining_accounts_iter.next().ok_or(ErrorCode::InvalidAccountList)?;

        // Deserialize user_pda
        // Note: `Account::try_from` implicitly handles the lifetime from `AccountInfo`.
        let user_pda_account: Account<'info, UserPDA> = Account::try_from(user_pda_info)?;
        let user_pda_ata_account: Account<'info, TokenAccount> = Account::try_from(user_pda_ata_info)?;

        // Validate user_pda and user_pda_ata derive from correct seeds and owner
        let (expected_pda_key, pda_bump) = Pubkey::find_program_address(
            &[b"deposit", user_id.as_bytes()],
            ctx.program_id,
        );
        require!(user_pda_info.key() == expected_pda_key, ErrorCode::InvalidPDA);
        require!(user_pda_account.bump == pda_bump, ErrorCode::InvalidPDA);
        require!(user_pda_account.token_account == user_pda_ata_info.key(), ErrorCode::InvalidUserATA);

        // Validate user_pda_ata mint and authority
        require!(user_pda_ata_account.mint == ctx.accounts.mint.key(), ErrorCode::InvalidTokenMint);
        require!(user_pda_ata_account.owner == user_pda_info.key(), ErrorCode::InvalidUserATA); // PDA must be the owner of its ATA

        // Check if user has sufficient balance
        require!(user_pda_ata_account.amount >= amount_to_transfer, ErrorCode::InsufficientBalance);

        // Create signer seeds for PDA
        let user_id_bytes = user_id.as_bytes();
        let seeds = &[
            b"deposit",
            user_id_bytes,
            &[pda_bump], // Use the validated bump
        ];
        let signer_seeds = &[&seeds[..]];

        // Prepare CPI accounts for token transfer
        let cpi_accounts = anchor_spl::token::Transfer {
            from: user_pda_ata_info.clone(),
            to: ctx.accounts.treasury_ata.to_account_info(),
            authority: user_pda_info.clone(), // The PDA is the authority for its ATA
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        // Perform the transfer
        anchor_spl::token::transfer(cpi_ctx, amount_to_transfer)?;

        total_transferred_amount = total_transferred_amount
            .checked_add(amount_to_transfer)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        msg!("✅ Transferred {} tokens from user '{}' (ATA: {}) to treasury",
                 amount_to_transfer, user_id, user_pda_ata_info.key());

        // Emit an event for each individual transfer
        emit!(AdminTransferredToTreasury {
                user_id: user_id.clone(),
                amount: amount_to_transfer,
                admin: ctx.accounts.admin.key(),
                from_ata: user_pda_ata_info.key(),
                to_treasury: ctx.accounts.treasury_ata.key(),
                // Note: This remaining balance is before subsequent transfers in the batch.
                // To get the absolute current balance, you'd need to re-fetch/re-deserialize
                // the ATA account after the transfer, but that adds complexity and compute.
                // For a batch, often the pre-transfer amount minus transferred is sufficient.
                remaining_balance: user_pda_ata_account.amount - amount_to_transfer,
            });
    }

    msg!("🎉 Batch transfer completed. Total transferred: {}", total_transferred_amount);

    Ok(())
}

/// **NEW ACCOUNTS STRUCTURE FOR BATCH TRANSFER**
#[derive(Accounts)]
#[instruction(user_ids: Vec<String>, amounts: Vec<u64>)]
pub struct AdminBatchTransferToTreasury<'info> {
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
    pub system_program: Program<'info, System>, // Needed for account deserialization within loop
    // `remaining_accounts` will contain pairs of (UserPDA, TokenAccount)
}
