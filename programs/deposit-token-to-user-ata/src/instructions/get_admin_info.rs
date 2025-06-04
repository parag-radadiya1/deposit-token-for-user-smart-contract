use anchor_lang::prelude::*;

use crate::state::*;
pub fn get_admin_info(ctx: Context<GetAdminInfo>) -> Result<AdminInfo> {
    let admin_state = &ctx.accounts.admin_state;

    let info = AdminInfo {
        admin: admin_state.admin,
        created_at: admin_state.created_at,
    };

    msg!("Admin Info - Current Admin: {}, Created At: {}",
         info.admin, info.created_at);

    Ok(info)
}

#[derive(Accounts)]
pub struct GetAdminInfo<'info> {
    #[account(
        seeds = [b"admin"],
        bump = admin_state.bump,
    )]
    pub admin_state: Account<'info, AdminState>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AdminInfo {
    pub admin: Pubkey,
    pub created_at: i64,
}