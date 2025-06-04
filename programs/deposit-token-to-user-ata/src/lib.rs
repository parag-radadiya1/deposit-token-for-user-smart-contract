use anchor_lang::prelude::*;
pub mod instructions;
pub mod state;
pub mod errors;
mod events;

use instructions::*;
declare_id!("29dme7kugTJtCNVkUboAiTfSZVMWFqp7v6LYUWuuN66R");
//
// #[program]
// pub mod deposit_token_to_user_ata {
//     use super::*;
//
//     pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
//         Ok(())
//     }
// }
//
// #[derive(Accounts)]
// pub struct Initialize {

#[program]
pub mod deposit_token_to_user_ata {
    use super::*;

    // pub fn initiate_token(
    //     ctx: Context<InitToken>, // Use the imported InitToken struct here
    //     metadata: InitTokenParams,
    //     sale_start_time: i64,
    //     sale_end_time: i64,
    // ) -> Result<()> {
    //     instructions::initiate_token::initiate_token(ctx, metadata, sale_start_time, sale_end_time)
    // }

    pub fn initialize_test(ctx: Context<InitializeTest>) -> Result<()> {
        instructions::initialize_test::initialize_test(ctx)
    }

    pub fn initialize(ctx: Context<Initialize>, token_mint: Pubkey) -> Result<()> {
        instructions::initialize::initialize(ctx, token_mint)
    }

    pub fn create_user_deposit_account(ctx: Context<CreateUserDepositAccount>, user_id: String) -> Result<CreateAccountResult> {
        instructions::create_user_deposit_account::create_user_deposit_account(ctx, user_id)
    }

    pub fn get_user_deposit_info(ctx: Context<GetUserDepositInfo>, ) -> Result<UserDepositInfo> {
        instructions::get_user_deposit_info::get_user_deposit_info(ctx)
    }

    pub fn find_user_pda_address(ctx: Context<FindUserPdaAddress>, user_id: String) -> Result<Pubkey> {
        instructions::find_user_pda_address::find_user_pda_address(ctx, user_id)
    }

    pub fn deposit_tokens(ctx: Context<DepositTokens>, user_id: String, amount: u64,) -> Result<()>  {
        instructions::deposit_tokens::deposit_tokens(ctx, user_id, amount)
    }

    pub fn get_admin_info(ctx: Context<GetAdminInfo>) -> Result<AdminInfo>  {
        instructions::get_admin_info::get_admin_info(ctx)
    }

    pub fn update_admin(ctx: Context<UpdateAdmin>, new_admin: Pubkey,) -> Result<()>  {
        instructions::update_admin::update_admin(ctx, new_admin)
    }

    pub fn get_treasury_info(ctx: Context<GetTreasuryInfo>) -> Result<TreasuryInfo>  {
        instructions::get_treasury_info::get_treasury_info(ctx)
    }

    pub fn admin_transfer_to_treasury(
        ctx: Context<AdminTransferToTreasury>,
        user_id: String,
        amount: u64,
    ) -> Result<()>  {
        instructions::admin_transfer_to_treasury::admin_transfer_to_treasury(ctx, user_id, amount)
    }

    pub fn admin_batch_transfer_to_treasury<'info>(
        ctx: Context<'_, '_, 'info, 'info, AdminBatchTransferToTreasury<'info>>, // Match the lifetime
        user_ids: Vec<String>,
        amounts: Vec<u64>,
    ) -> Result<()>  {
        instructions::admin_batch_transfer_to_treasury::admin_batch_transfer_to_treasury(ctx, user_ids, amounts)
    }
}