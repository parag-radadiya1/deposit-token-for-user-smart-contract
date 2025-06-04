use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Token, TokenAccount, Mint},
};
use crate::state::*;
use crate::errors::ErrorCode;
use crate::events::*;



/// Update admin (only current admin can do this)
pub fn update_admin(
    ctx: Context<UpdateAdmin>,
    new_admin: Pubkey,
) -> Result<()> {
    // Validate new admin is not zero address
    require!(new_admin != Pubkey::default(), ErrorCode::InvalidNewAdmin);

    // Verify current admin authorization
    require!(
        ctx.accounts.admin_state.admin == ctx.accounts.current_admin.key(),
        ErrorCode::UnauthorizedAdmin
    );

    // Prevent setting same admin
    require!(
        ctx.accounts.admin_state.admin != new_admin,
        ErrorCode::SameAdminUpdate
    );

    let admin_state = &mut ctx.accounts.admin_state;
    let old_admin = admin_state.admin;

    admin_state.admin = new_admin;

    msg!("✅ Admin updated from {} to {}", old_admin, new_admin);

    emit!(AdminUpdated {
        old_admin,
        new_admin,
        updated_by: ctx.accounts.current_admin.key(),
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        seeds = [b"admin"],
        bump = admin_state.bump,
    )]
    pub admin_state: Account<'info, AdminState>,

    #[account(
        mut,
        constraint = current_admin.key() == admin_state.admin @ ErrorCode::UnauthorizedAdmin
    )]
    pub current_admin: Signer<'info>,
}