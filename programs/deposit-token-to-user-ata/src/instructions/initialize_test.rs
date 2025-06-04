use anchor_lang::prelude::*;

pub fn initialize_test(_ctx: Context<InitializeTest>) -> Result<()> {
        msg!("initialize function");
        Ok(())
}

#[derive(Accounts)]
pub struct InitializeTest {}
