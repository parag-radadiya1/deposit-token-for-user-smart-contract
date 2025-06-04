use anchor_lang::prelude::*;

#[account]
pub struct AdminState {
    pub admin: Pubkey,          // Current admin wallet
    pub bump: u8,               // PDA bump
    pub created_at: i64,        // When admin was initialized
}

impl AdminState {
    pub const SPACE: usize = 8 + 32 + 1 + 8 + 32; // discriminator + pubkey + bump + timestamp
}