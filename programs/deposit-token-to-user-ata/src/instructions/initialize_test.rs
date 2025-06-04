use anchor_lang::prelude::*;

pub fn initialize_test(_ctx: Context<InitializeTest>) -> Result<()> {
        Ok(())
}

#[derive(Accounts)]
pub struct InitializeTest {}
