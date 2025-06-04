use anchor_lang::prelude::*;

#[event]
pub struct ProgramInitialized {
    pub admin: Pubkey,
    pub token_mint: Pubkey,
    pub treasury_ata: Pubkey,
}

// Events
#[event]
pub struct UserDepositAccountCreated {
    pub user_id: String,
    pub pda_address: Pubkey,
    pub token_account: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct TokensDeposited {
    pub user_id: String,
    pub amount: u64,
    pub depositor: Pubkey,
    pub pda_ata: Pubkey,
}

#[event]
pub struct AdminTransferredToTreasury {
    pub user_id: String,
    pub amount: u64,
    pub admin: Pubkey,
    pub from_ata: Pubkey,
    pub to_treasury: Pubkey,
    pub remaining_balance: u64,
}