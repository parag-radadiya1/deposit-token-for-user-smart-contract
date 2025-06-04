use anchor_lang::prelude::*;

#[account]
pub struct TreasuryState {
    pub token_mint: Pubkey,     // Which token this treasury holds
    pub treasury_ata: Pubkey,   // The treasury's ATA address
    pub bump: u8,               // PDA bump
    pub created_at: i64,        // When treasury was created
}

impl TreasuryState {
    pub const SPACE: usize = 8 + 32 + 32 + 1 + 8 + 32; // discriminator + 2 pubkeys + bump + timestamp
}
