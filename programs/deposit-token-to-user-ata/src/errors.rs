use anchor_lang::prelude::*;

// Error codes
#[error_code]
pub enum ErrorCode {
    #[msg("User ID cannot be empty")]
    EmptyUserId,
    #[msg("User ID too long (max 50 characters)")]
    UserIdTooLong,
    #[msg("Amount must be greater than 0")]
    InvalidAmount,
    #[msg("Unauthorized: Only admin can perform this action")]
    UnauthorizedAdmin,
    #[msg("Invalid PDA derivation")]
    InvalidPDA,
    #[msg("Invalid token mint")]
    InvalidTokenMint,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Invalid new admin address")]
    InvalidNewAdmin,
    #[msg("Cannot set same admin")]
    SameAdminUpdate,
    #[msg("Invalid treasury ATA")]
    InvalidTreasuryATA,
    #[msg("Invalid number of remaining accounts, must be even")]
    InvalidAccountList,
    #[msg("User PDA and ATA do not match")]
    InvalidUserATA,
    #[msg("Mismatched array lengths for user_ids and amounts")]
    MismatchedArrayLengths,
    #[msg("Too many users (maximum 5 allowed)")]
    TooManyUsers,
    #[msg("User list cannot be empty")]
    EmptyUserList,
    #[msg("Too many accounts provided")]
    TooManyAccounts,
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,
}