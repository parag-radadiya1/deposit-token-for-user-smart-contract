use anchor_lang::prelude::*;

// Data structures
#[account]
pub struct UserPDA {
    pub user_id: String,           // The user identifier (e.g., "User12345")
    pub owner: Pubkey,             // Who created this PDA
    pub token_account: Pubkey,     // The associated token account address
    pub bump: u8,                  // PDA bump seed
    pub created_at: i64,           // Timestamp when created
}

impl UserPDA {
    pub fn space(user_id: &str) -> usize {
        8 +                        // discriminator
            4 + user_id.len() +        // string length + content
            32 +                       // owner pubkey
            32 +                       // token_account pubkey
            1 +                        // bump
            8                          // created_at timestamp
    }
}