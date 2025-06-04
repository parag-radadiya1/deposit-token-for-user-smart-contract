use anchor_lang::prelude::*;
use crate::state::*;


/// Get user PDA info (view function)
pub fn get_user_deposit_info(ctx: Context<GetUserDepositInfo>) -> Result<UserDepositInfo> {
    let user_pda = &ctx.accounts.user_pda;

    let info = UserDepositInfo {
        pda_address: user_pda.key(),
        user_id: user_pda.user_id.clone(),
        owner: user_pda.owner,
        token_account: user_pda.token_account,
        created_at: user_pda.created_at,
    };

    msg!("PDA Info - Address: {}, User ID: {}, ATA: {}",
             info.pda_address, info.user_id, info.token_account);

    Ok(info)
}


#[derive(Accounts)]
pub struct GetUserDepositInfo<'info> {
    pub user_pda: Account<'info, UserPDA>,
}

// Return type for get_user_deposit_info
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UserDepositInfo {
    pub pda_address: Pubkey,
    pub user_id: String,
    pub owner: Pubkey,
    pub token_account: Pubkey,
    pub created_at: i64,
}
