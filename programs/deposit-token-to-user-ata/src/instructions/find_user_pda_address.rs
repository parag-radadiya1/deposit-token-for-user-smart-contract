use anchor_lang::prelude::*;
/// Find PDA address for a given user_id (utility function)
pub fn find_user_pda_address(
    _ctx: Context<FindUserPdaAddress>,
    user_id: String
) -> Result<Pubkey> {
    let program_id = *_ctx.program_id;
    let (pda_address, _bump) = Pubkey::find_program_address(
        &[b"deposit", user_id.as_bytes()],
        &program_id,
    );

    msg!("PDA address for user '{}': {}", user_id, pda_address);
    Ok(pda_address)
}

#[derive(Accounts)]
pub struct FindUserPdaAddress {}