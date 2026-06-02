use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Burn, Mint, TokenAccount, TokenInterface};

declare_id!("2kociKNJcSLo1TytiyWvT1r8sdFdLMZu9mMYHfogjxZc");

pub const CASH_MINT: Pubkey = pubkey!("oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat");

#[program]
pub mod unatrare_salute_burn {
    use super::*;

    pub fn burn_salute(ctx: Context<BurnSalute>, amount: u64, card_name: String) -> Result<()> {
        require!(amount > 0, BurnError::InvalidAmount);
        require!(
            !card_name.trim().is_empty() && card_name.len() <= 64,
            BurnError::InvalidCardName
        );
        require_keys_eq!(ctx.accounts.mint.key(), CASH_MINT, BurnError::InvalidMint);

        token_interface::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        emit!(SaluteBurned {
            wallet: ctx.accounts.user.key(),
            card_name,
            amount,
            mint: ctx.accounts.mint.key(),
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct BurnSalute<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = user,
        token::token_program = token_program,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, address = CASH_MINT)]
    pub mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[event]
pub struct SaluteBurned {
    pub wallet: Pubkey,
    pub card_name: String,
    pub amount: u64,
    pub mint: Pubkey,
}

#[error_code]
pub enum BurnError {
    #[msg("amount must be greater than zero")]
    InvalidAmount,
    #[msg("card name must be non-empty and <= 64 chars")]
    InvalidCardName,
    #[msg("invalid mint for salute burn")]
    InvalidMint,
}
