## Prerequisites

Make sure you have the following installed:

**version**  
- solana-cli 1.18.14
- anchor-cli 0.28.0

**links**
- **Rust**: [Install Rust](https://rustup.rs/)
- **Solana CLI**: [Install Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- **Anchor CLI** (v0.28.0+): Install via Cargo:
- 
  ```bash
  cargo install --git https://github.com/project-serum/anchor anchor-cli --locked

## Build and Deploy

Follow these steps to build and deploy the program.

### 1. Build the Program:

```bash
anchor build
[//]: # (update idl id in li.rs file and Anchor.toml file )
anchor deploy


[//]: # (for run test case. also setup solana validatio on local)
npm install

anchor build 

[//]: # (update programe id)
anchor test --skip-local-validator
