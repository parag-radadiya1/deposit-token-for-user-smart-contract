import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DepositTokenToUserAta } from "../target/types/deposit_token_to_user_ata";
import {
  PublicKey,
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createMint,
  mintTo,
  getAccount as getTokenAccount, createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { expect } from "chai";

// todo : for now added only success tes in this file. we need to make separate file
//  for each function of smart contract and include failer test as well.
describe("deposit-token-to-user-ata", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.DepositTokenToUserAta as Program<DepositTokenToUserAta>;
  const provider = anchor.getProvider();
  const connection = provider.connection;

  // Test accounts and variables
  let payer: Keypair;
  let testMint: PublicKey;
  let userPdaAddress: PublicKey;
  let userAtaAddress: PublicKey;
  let pdaBump: number;

  // Test constants
  const TEST_USER_ID = "TestUser123";
  // const DEVNET_USDT_MINT = new PublicKey("DxmaJTq9UtcQEnnHRED6ZsXcp79gQY5XUV8USSSyiUfa");
  // const DEVNET_CUSTOM_TOKEN_MINT = new PublicKey("BNDvNxhxhcRay8s5WK7wtpCwF9wGQiuUVo9zioGMtuS");
  const LOCALNET_CUSTOM_TOKEN_MINT = new PublicKey("HHmhD8ae2jaXY4QoRKQ2EBpXkaGEWHA8DYevePNNkLKy");

  before(async () => {
    // Create a payer keypair for tests
    payer = Keypair.generate();

    // Airdrop SOL to payer
    const airdropTx = await connection.requestAirdrop(payer.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdropTx);

    // Create a test mint for local testing
    testMint = await createMint(
        connection,
        payer,
        payer.publicKey,
        null,
        9 // 9 decimals
    );

    console.log(`✅ Test setup complete:`);
    console.log(`   Payer: ${payer.publicKey.toString()}`);
    console.log(`   Test Mint: ${testMint.toString()}`);
    console.log(`   USDT Mint (Devnet): ${LOCALNET_CUSTOM_TOKEN_MINT.toString()}`);
    console.log(`   Custom Token Mint (Devnet): ${LOCALNET_CUSTOM_TOKEN_MINT.toString()}`);
  });

  describe("Program Initialization", () => {
    it("Should initialize the program successfully", async () => {
      const tx = await program.methods.initializeTest().rpc();
      console.log("Initialize transaction signature:", tx);

      // Wait for confirmation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Fetch and display transaction logs
      const transaction = await connection.getTransaction(tx, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      expect(transaction).to.not.be.null;

      if (transaction?.meta?.logMessages) {
        console.log("\n===== INITIALIZATION LOGS =====");
        const initLog = transaction.meta.logMessages.find(log =>
            log.includes("initialize function")
        );
        expect(initLog).to.not.be.undefined;
        console.log("Found initialization log:", initLog);
        console.log("===============================");
      }
    });
  });

  describe("PDA Address Calculation", () => {
    it("Should find PDA address for a user", async () => {
      // Calculate expected PDA address
      const [expectedPda, expectedBump] = PublicKey.findProgramAddressSync(
          [Buffer.from("deposit"), Buffer.from(TEST_USER_ID)],
          program.programId
      );

      const result = await program.methods
          .findUserPdaAddress(TEST_USER_ID)
          .view();

      console.log(`✅ PDA calculation test:`);
      console.log(`   User ID: ${TEST_USER_ID}`);
      console.log(`   Expected PDA: ${expectedPda.toString()}`);
      console.log(`   Program returned: ${result}`);
      console.log(`   Bump: ${expectedBump}`);

      // Store for later tests
      userPdaAddress = expectedPda;
      pdaBump = expectedBump;

      expect(result.toString()).to.equal(expectedPda.toString());
    });
  });

  describe("User Deposit Account Creation", () => {
    it("Should create user PDA and ATA with test mint", async () => {
      // Calculate expected addresses
      const [expectedPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("deposit"), Buffer.from(TEST_USER_ID)],
          program.programId
      );

      const expectedAta = getAssociatedTokenAddressSync(
          testMint,
          expectedPda,
          true // allowOwnerOffCurve = true for PDA
      );

      console.log(`\n🔄 Creating user deposit account:`);
      console.log(`   User ID: ${TEST_USER_ID}`);
      console.log(`   Expected PDA: ${expectedPda.toString()}`);
      console.log(`   Expected ATA: ${expectedAta.toString()}`);
      console.log(`   Mint: ${testMint.toString()}`);

      const result = await program.methods
          .createUserDepositAccount(TEST_USER_ID)
          .accounts({
            userPda: expectedPda,
            userAta: expectedAta,
            subscriptionTokenMint: testMint,
            payer: payer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([payer])
          .rpc();

      console.log("✅ Creation transaction:", result);

      // Store addresses for later tests
      userPdaAddress = expectedPda;
      userAtaAddress = expectedAta;

      // Verify the accounts were created
      const pdaAccount = await program.account.userPda.fetch(expectedPda);
      const ataAccount = await getTokenAccount(connection, expectedAta);

      console.log(`\n📊 Account verification:`);
      console.log(`   PDA User ID: ${pdaAccount.userId}`);
      console.log(`   PDA Owner: ${pdaAccount.owner.toString()}`);
      console.log(`   PDA Token Account: ${pdaAccount.tokenAccount.toString()}`);
      console.log(`   ATA Owner: ${ataAccount.owner.toString()}`);
      console.log(`   ATA Mint: ${ataAccount.mint.toString()}`);

      // Assertions
      expect(pdaAccount.userId).to.equal(TEST_USER_ID);
      expect(pdaAccount.owner.toString()).to.equal(payer.publicKey.toString());
      expect(pdaAccount.tokenAccount.toString()).to.equal(expectedAta.toString());
      expect(ataAccount.owner.toString()).to.equal(expectedPda.toString());
      expect(ataAccount.mint.toString()).to.equal(testMint.toString());
    });

    it("Should fail to create duplicate user PDA", async () => {
      const [expectedPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("deposit"), Buffer.from(TEST_USER_ID)],
          program.programId
      );

      const expectedAta = getAssociatedTokenAddressSync(
          testMint,
          expectedPda,
          true
      );

      try {
        await program.methods
            .createUserDepositAccount(TEST_USER_ID)
            .accounts({
              userPda: expectedPda,
              userAta: expectedAta,
              subscriptionTokenMint: testMint,
              payer: payer.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .signers([payer])
            .rpc();

        // Should not reach here
        expect.fail("Expected transaction to fail");
      } catch (error) {
        console.log("✅ Correctly failed to create duplicate PDA");
        expect(error.message).to.include("already in use");
      }
    });
  });

  describe("User Deposit Info Retrieval", () => {
    it("Should retrieve user deposit info", async () => {
      const info = await program.methods
          .getUserDepositInfo()
          .accounts({
            userPda: userPdaAddress,
          })
          .view();

      console.log(`\n📋 User deposit info:`);
      console.log(`   PDA Address: ${info.pdaAddress.toString()}`);
      console.log(`   User ID: ${info.userId}`);
      console.log(`   Owner: ${info.owner.toString()}`);
      console.log(`   Token Account: ${info.tokenAccount.toString()}`);
      console.log(`   Created At: ${new Date(info.createdAt * 1000).toISOString()}`);

      expect(info.userId).to.equal(TEST_USER_ID);
      expect(info.owner.toString()).to.equal(payer.publicKey.toString());
      expect(info.tokenAccount.toString()).to.equal(userAtaAddress.toString());
    });
  });

  describe("Multiple Users Test", () => {
    it("Should create accounts for multiple users", async () => {
      const users = ["Alice", "Bob", "Charlie"];
      const results = [];

      for (const userId of users) {
        const [expectedPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("deposit"), Buffer.from(userId)],
            program.programId
        );

        const expectedAta = getAssociatedTokenAddressSync(
            testMint,
            expectedPda,
            true
        );

        const result = await program.methods
            .createUserDepositAccount(userId)
            .accounts({
              userPda: expectedPda,
              userAta: expectedAta,
              subscriptionTokenMint: testMint,
              payer: payer.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .signers([payer])
            .rpc();

        results.push({
          userId,
          pda: expectedPda,
          ata: expectedAta,
          tx: result
        });

        console.log(`✅ Created account for ${userId}: ${expectedPda.toString()}`);
      }

      // Verify all accounts
      for (const { userId, pda, ata } of results) {
        const pdaAccount = await program.account.userPda.fetch(pda);
        const ataAccount = await getTokenAccount(connection, ata);

        expect(pdaAccount.userId).to.equal(userId);
        expect(ataAccount.owner.toString()).to.equal(pda.toString());
      }

      console.log(`✅ Successfully created ${users.length} user accounts`);
    });
  });

  describe("Token Operations", () => {
    it("Should be able to mint tokens to user's ATA", async () => {
      const mintAmount = 1000 * Math.pow(10, 9); // 1000 tokens with 9 decimals

      console.log(`\n💰 Minting tokens to user's ATA:`);
      console.log(`   Amount: ${mintAmount / Math.pow(10, 9)} tokens`);
      console.log(`   ATA: ${userAtaAddress.toString()}`);

      // Mint tokens to the user's ATA (owned by PDA)
      const mintTx = await mintTo(
          connection,
          payer,
          testMint,
          userAtaAddress,
          payer.publicKey,
          mintAmount
      );

      console.log("✅ Mint transaction:", mintTx);

      // Verify balance
      const ataAccount = await getTokenAccount(connection, userAtaAddress);
      console.log(`💰 ATA Balance: ${Number(ataAccount.amount) / Math.pow(10, 9)} tokens`);

      expect(Number(ataAccount.amount)).to.equal(mintAmount);
    });
  });

  describe("Token Deposit Tests", () => {
    let userTokenAccount: PublicKey;
    const depositAmount = 500 * Math.pow(10, 9); // 500 tokens with 9 decimals

    before(async () => {
      // Create user's personal token account for depositing from
      userTokenAccount = getAssociatedTokenAddressSync(
          testMint,
          payer.publicKey,
          false
      );

      // Create the user's token account using the correct import
      const createAtaIx = createAssociatedTokenAccountInstruction(
          payer.publicKey, // payer
          userTokenAccount, // ata
          payer.publicKey, // owner
          testMint // mint
      );


      const createAtaTx = new anchor.web3.Transaction().add(createAtaIx);
      await anchor.web3.sendAndConfirmTransaction(connection, createAtaTx, [payer]);


      // Mint tokens to user's personal account
      await mintTo(
          connection,
          payer,
          testMint,
          userTokenAccount,
          payer.publicKey,
          1000 * Math.pow(10, 9) // 1000 tokens
      );

      console.log(`✅ Setup complete for deposit tests:`);
      console.log(`   User Token Account: ${userTokenAccount.toString()}`);
      console.log(`   Minted 1000 tokens to user account`);
    });

    it("Should deposit tokens to user's PDA ATA", async () => {
      console.log(`\n💰 Depositing tokens to PDA ATA:`);
      console.log(`   Amount: ${depositAmount / Math.pow(10, 9)} tokens`);
      console.log(`   From: ${userTokenAccount.toString()}`);
      console.log(`   To: ${userAtaAddress.toString()}`);

      // Check balances before deposit
      const userBalanceBefore = await getTokenAccount(connection, userTokenAccount);
      const pdaBalanceBefore = await getTokenAccount(connection, userAtaAddress);

      console.log(`   User balance before: ${Number(userBalanceBefore.amount) / Math.pow(10, 9)}`);
      console.log(`   PDA balance before: ${Number(pdaBalanceBefore.amount) / Math.pow(10, 9)}`);

      const tx = await program.methods
          .depositTokens(TEST_USER_ID, new anchor.BN(depositAmount))
          .accounts({
            userPda: userPdaAddress,
            userPdaAta: userAtaAddress,
            userTokenAccount: userTokenAccount,
            mint: testMint,
            user: payer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([payer])
          .rpc();

      console.log("✅ Deposit transaction:", tx);

      // Check balances after deposit
      const userBalanceAfter = await getTokenAccount(connection, userTokenAccount);
      const pdaBalanceAfter = await getTokenAccount(connection, userAtaAddress);

      console.log(`   User balance after: ${Number(userBalanceAfter.amount) / Math.pow(10, 9)}`);
      console.log(`   PDA balance after: ${Number(pdaBalanceAfter.amount) / Math.pow(10, 9)}`);

      // Assertions
      expect(Number(userBalanceAfter.amount)).to.equal(Number(userBalanceBefore.amount) - depositAmount);
      expect(Number(pdaBalanceAfter.amount)).to.equal(Number(pdaBalanceBefore.amount) + depositAmount);
    });

    it("Should fail deposit with insufficient balance", async () => {
      const excessiveAmount = 10000 * Math.pow(10, 9); // More than user has

      try {
        await program.methods
            .depositTokens(TEST_USER_ID, new anchor.BN(excessiveAmount))
            .accounts({
              userPda: userPdaAddress,
              userPdaAta: userAtaAddress,
              userTokenAccount: userTokenAccount,
              mint: testMint,
              user: payer.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([payer])
            .rpc();

        expect.fail("Expected transaction to fail");
      } catch (error) {
        console.log("✅ Correctly failed with insufficient balance");
        expect(error.message).to.include("insufficient");
      }
    });

    it("Should fail deposit with zero amount", async () => {
      try {
        await program.methods
            .depositTokens(TEST_USER_ID, new anchor.BN(0))
            .accounts({
              userPda: userPdaAddress,
              userPdaAta: userAtaAddress,
              userTokenAccount: userTokenAccount,
              mint: testMint,
              user: payer.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([payer])
            .rpc();

        expect.fail("Expected transaction to fail");
      } catch (error) {
        console.log("✅ Correctly failed with zero amount");
        expect(error.message).to.include("InvalidAmount");
      }
    });

    it("Should deposit to another user's ATA", async () => {
      // Create another user
      const anotherUserId = "AnotherUser";
      const [anotherPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("deposit"), Buffer.from(anotherUserId)],
          program.programId
      );
      const anotherAta = getAssociatedTokenAddressSync(testMint, anotherPda, true);

      // Create the other user's account first
      await program.methods
          .createUserDepositAccount(anotherUserId)
          .accounts({
            userPda: anotherPda,
            userAta: anotherAta,
            subscriptionTokenMint: testMint,
            payer: payer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([payer])
          .rpc();

      const depositToAnotherAmount = 100 * Math.pow(10, 9);

      // Deposit to another user's ATA
      const tx = await program.methods
          .depositTokens(anotherUserId, new anchor.BN(depositToAnotherAmount))
          .accounts({
            userPda: anotherPda,
            userPdaAta: anotherAta,
            userTokenAccount: userTokenAccount,
            mint: testMint,
            user: payer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([payer])
          .rpc();

      console.log("✅ Deposited to another user's ATA:", tx);

      // Verify balance
      const anotherAtaBalance = await getTokenAccount(connection, anotherAta);
      expect(Number(anotherAtaBalance.amount)).to.equal(depositToAnotherAmount);
    });

    it("Should handle multiple deposits to same ATA", async () => {
      const firstDeposit = 50 * Math.pow(10, 9);
      const secondDeposit = 75 * Math.pow(10, 9);

      // Get initial balance
      const initialBalance = await getTokenAccount(connection, userAtaAddress);
      const initialAmount = Number(initialBalance.amount);

      // First deposit
      await program.methods
          .depositTokens(TEST_USER_ID, new anchor.BN(firstDeposit))
          .accounts({
            userPda: userPdaAddress,
            userPdaAta: userAtaAddress,
            userTokenAccount: userTokenAccount,
            mint: testMint,
            user: payer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([payer])
          .rpc();

      // Second deposit
      await program.methods
          .depositTokens(TEST_USER_ID, new anchor.BN(secondDeposit))
          .accounts({
            userPda: userPdaAddress,
            userPdaAta: userAtaAddress,
            userTokenAccount: userTokenAccount,
            mint: testMint,
            user: payer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([payer])
          .rpc();

      // Verify final balance
      const finalBalance = await getTokenAccount(connection, userAtaAddress);
      const expectedAmount = initialAmount + firstDeposit + secondDeposit;

      console.log(`✅ Multiple deposits successful:`);
      console.log(`   Initial: ${initialAmount / Math.pow(10, 9)}`);
      console.log(`   Final: ${Number(finalBalance.amount) / Math.pow(10, 9)}`);
      console.log(`   Expected: ${expectedAmount / Math.pow(10, 9)}`);

      expect(Number(finalBalance.amount)).to.equal(expectedAmount);
    });
  });

  describe("Program Initialize Function", () => {
    it("Should initialize the program with admin and treasury", async () => {
      // Calculate expected PDA addresses
      const [adminStateAddress] = PublicKey.findProgramAddressSync(
          [Buffer.from("admin")],
          program.programId
      );

      const [treasuryStateAddress] = PublicKey.findProgramAddressSync(
          [Buffer.from("treasury"), testMint.toBuffer()],
          program.programId
      );

      const treasuryAtaAddress = getAssociatedTokenAddressSync(
          testMint,
          treasuryStateAddress,
          true
      );

      console.log(`\n🔧 Initializing program:`);
      console.log(`   Token Mint: ${testMint.toString()}`);
      console.log(`   Admin State PDA: ${adminStateAddress.toString()}`);
      console.log(`   Treasury State PDA: ${treasuryStateAddress.toString()}`);
      console.log(`   Treasury ATA: ${treasuryAtaAddress.toString()}`);

      const tx = await program.methods
          .initialize(testMint)
          .accounts({
            adminState: adminStateAddress,
            treasuryState: treasuryStateAddress,
            treasuryAta: treasuryAtaAddress,
            tokenMint: testMint,
            payer: payer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([payer])
          .rpc();

      console.log("✅ Initialize transaction:", tx);

      // Verify admin state
      const adminState = await program.account.adminState.fetch(adminStateAddress);

      expect(adminState.admin.toString()).to.equal(payer.publicKey.toString());
      expect(adminState.createdAt.toNumber()).to.be.greaterThan(0);

      // Verify treasury state
      const treasuryState = await program.account.treasuryState.fetch(treasuryStateAddress);
      console.log("treasury state == ", treasuryState)
      expect(treasuryState.tokenMint.toString()).to.equal(testMint.toString());
      expect(treasuryState.treasuryAta.toString()).to.equal(treasuryAtaAddress.toString());
      expect(treasuryState.createdAt.toNumber()).to.be.greaterThan(0);

      // Verify treasury ATA was created
      const treasuryAtaAccount = await getTokenAccount(connection, treasuryAtaAddress);
      expect(treasuryAtaAccount.owner.toString()).to.equal(treasuryStateAddress.toString());
      expect(treasuryAtaAccount.mint.toString()).to.equal(testMint.toString());

      console.log(`✅ Program initialization verified successfully`);
    });
  });

  describe("Admin Transfer to Treasury", () => {
    let adminStateAddress: PublicKey;
    let treasuryStateAddress: PublicKey;
    let treasuryAtaAddress: PublicKey;

    before(async () => {
      // Calculate PDA addresses (these should exist from previous initialization)
      [adminStateAddress] = PublicKey.findProgramAddressSync(
          [Buffer.from("admin")],
          program.programId
      );

      [treasuryStateAddress] = PublicKey.findProgramAddressSync(
          [Buffer.from("treasury"), testMint.toBuffer()],
          program.programId
      );

      treasuryAtaAddress = getAssociatedTokenAddressSync(
          testMint,
          treasuryStateAddress,
          true
      );
    });

    it("Should transfer tokens from user PDA to treasury", async () => {
      const transferAmount = 200 * Math.pow(10, 9); // 200 tokens

      // Get initial balances
      const userAtaBalanceBefore = await getTokenAccount(connection, userAtaAddress);

      // console.log("userAtaBalanceBefore == ", userAtaBalanceBefore)
      const treasuryAtaBalanceBefore = await getTokenAccount(connection, treasuryAtaAddress);
      // console.log("treasuryAtaBalanceBefore == ", treasuryAtaBalanceBefore)

      console.log(`\n💰 Admin transferring to treasury:`);
      console.log(`   Amount: ${transferAmount / Math.pow(10, 9)} tokens`);
      console.log(`   From user ATA: ${userAtaAddress.toString()}`);
      console.log(`   To treasury ATA: ${treasuryAtaAddress.toString()}`);
      console.log(`   User balance before: ${Number(userAtaBalanceBefore.amount) / Math.pow(10, 9)}`);
      console.log(`   Treasury balance before: ${Number(treasuryAtaBalanceBefore.amount) / Math.pow(10, 9)}`);

      const tx = await program.methods
          .adminTransferToTreasury(TEST_USER_ID, new anchor.BN(transferAmount))
          .accounts({
            adminState: adminStateAddress,
            treasuryState: treasuryStateAddress,
            userPda: userPdaAddress,
            userPdaAta: userAtaAddress,
            treasuryAta: treasuryAtaAddress,
            mint: testMint,
            admin: payer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([payer])
          .rpc();

      console.log("✅ Admin transfer transaction:", tx);

      // Verify balances after transfer
      const userAtaBalanceAfter = await getTokenAccount(connection, userAtaAddress);
      const treasuryAtaBalanceAfter = await getTokenAccount(connection, treasuryAtaAddress);

      console.log(`   User balance after: ${Number(userAtaBalanceAfter.amount) / Math.pow(10, 9)}`);
      console.log(`   Treasury balance after: ${Number(treasuryAtaBalanceAfter.amount) / Math.pow(10, 9)}`);

      // Assertions
      expect(Number(userAtaBalanceAfter.amount)).to.equal(Number(userAtaBalanceBefore.amount) - transferAmount);
      expect(Number(treasuryAtaBalanceAfter.amount)).to.equal(Number(treasuryAtaBalanceBefore.amount) + transferAmount);

      console.log("✅ Admin transfer to treasury completed successfully");
    });
  });

  describe("Update Admin", () => {
    let adminStateAddress: PublicKey;
    let newAdmin: Keypair;

    before(async () => {
      // Calculate admin state PDA address
      [adminStateAddress] = PublicKey.findProgramAddressSync(
          [Buffer.from("admin")],
          program.programId
      );

      // Create new admin keypair
      newAdmin = Keypair.generate();

      // Airdrop SOL to new admin for transaction fees (if needed)
      const airdropTx = await connection.requestAirdrop(newAdmin.publicKey, anchor.web3.LAMPORTS_PER_SOL);
      await connection.confirmTransaction(airdropTx);
    });

    it("Should update admin successfully", async () => {
      // Get current admin info
      const adminStateBefore = await program.account.adminState.fetch(adminStateAddress);

      console.log(`\n👑 Updating admin:`);
      console.log(`   Current admin: ${adminStateBefore.admin.toString()}`);
      console.log(`   New admin: ${newAdmin.publicKey.toString()}`);

      const tx = await program.methods
          .updateAdmin(newAdmin.publicKey)
          .accounts({
            adminState: adminStateAddress,
            currentAdmin: payer.publicKey,
          })
          .signers([payer])
          .rpc();

      console.log("✅ Update admin transaction:", tx);

      // Verify admin was updated
      let adminStateAfter = await program.account.adminState.fetch(adminStateAddress);

      console.log(`   Updated admin: ${adminStateAfter.admin.toString()}`);

      expect(adminStateAfter.admin.toString()).to.equal(newAdmin.publicKey.toString());
      expect(adminStateAfter.admin.toString()).to.not.equal(adminStateBefore.admin.toString());

      console.log("✅ Admin updated successfully");

      // now admin is  ==>  payer.publicKey
      // and old amin is  ==>  newAdmin.publicKey

      // make old admin back
      const txNew = await program.methods
          .updateAdmin(payer.publicKey)
          .accounts({
            adminState: adminStateAddress,
            currentAdmin: newAdmin.publicKey,
          })
          .signers([newAdmin])
          .rpc();

      console.log("✅ Update admin transaction:", txNew);

      // Verify admin was updated
      adminStateAfter = await program.account.adminState.fetch(adminStateAddress);

      console.log(`second time Updated admin: ${adminStateAfter.admin.toString()}`);

      expect(adminStateAfter.admin.toString()).to.equal(payer.publicKey.toString());
      expect(adminStateAfter.admin.toString()).to.equal(adminStateBefore.admin.toString());



    });
  });

  describe("Batch Admin Transfer to Treasury", () => {
    let adminStateAddress: PublicKey;
    let treasuryStateAddress: PublicKey;
    let treasuryAtaAddress: PublicKey;

    // Define some test users and their properties
    const batchUsers = [
      { userId: "UserA", amount: 100 },
      { userId: "UserB", amount: 50 },
      { userId: "UserC", amount: 75 },
    ];
    const decimals = 9; // Assuming 9 decimals for the testMint

    let userInfos: {
      userId: string;
      pda: PublicKey;
      ata: PublicKey;
      initialBalance: number;
    }[] = [];

    before(async () => {
      // Calculate common addresses
      [adminStateAddress] = PublicKey.findProgramAddressSync(
          [Buffer.from("admin")],
          program.programId
      );

      [treasuryStateAddress] = PublicKey.findProgramAddressSync(
          [Buffer.from("treasury"), testMint.toBuffer()],
          program.programId
      );

      treasuryAtaAddress = getAssociatedTokenAddressSync(
          testMint,
          treasuryStateAddress,
          true
      );

      // 1. Create User PDAs and ATAs for batchUsers
      // 2. Mint tokens to their ATAs
      for (const user of batchUsers) {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from("deposit"), Buffer.from(user.userId)],
            program.programId
        );
        const ata = getAssociatedTokenAddressSync(testMint, pda, true);

        // Create User PDA and ATA
        await program.methods
            .createUserDepositAccount(user.userId)
            .accounts({
              userPda: pda,
              userAta: ata,
              subscriptionTokenMint: testMint,
              payer: payer.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .signers([payer])
            .rpc();

        // Mint tokens to their ATA (ensure enough for transfers)
        const mintAmount = user.amount * 2 * Math.pow(10, decimals); // Mint double the transfer amount for safety
        await mintTo(connection, payer, testMint, ata, payer.publicKey, mintAmount);

        const initialBalance = Number((await getTokenAccount(connection, ata)).amount);
        userInfos.push({
          userId: user.userId,
          pda: pda,
          ata: ata,
          initialBalance: initialBalance,
        });

        console.log(`Prepared user ${user.userId}: PDA=${pda.toString()}, ATA=${ata.toString()}, Initial Balance=${initialBalance / Math.pow(10, decimals)}`);
      }
      console.log(`✅ Setup complete for batch transfer tests`);
    });

    it("Should successfully transfer tokens from multiple users to treasury in a batch", async () => {
      // Collect user IDs and amounts for the instruction
      const userIds = batchUsers.map(u => u.userId);
      const amounts = batchUsers.map(u => new anchor.BN(u.amount * Math.pow(10, decimals))); // Convert to BN

      // Collect `remaining_accounts` in the correct order (PDA, ATA, PDA, ATA, ...)
      const remainingAccounts = [];
      for (const userInfo of userInfos) {
        remainingAccounts.push({
          pubkey: userInfo.pda,
          isWritable: false, // UserPDA is read-only in the instruction
          isSigner: false,
        });
        remainingAccounts.push({
          pubkey: userInfo.ata,
          isWritable: true, // UserATA is written to
          isSigner: false, // PDA is authority, not the ATA itself
        });
      }

      const treasuryInitialBalance = Number((await getTokenAccount(connection, treasuryAtaAddress)).amount);
      console.log(`\nTreasury initial balance: ${treasuryInitialBalance / Math.pow(10, decimals)}`);

      console.log(`\n🔄 Performing batch transfer:`);
      console.log(`   Users: ${userIds.join(', ')}`);
      console.log(`   Amounts: ${amounts.map(a => a.toNumber() / Math.pow(10, decimals)).join(', ')}`);

      const tx = await program.methods
          .adminBatchTransferToTreasury(userIds, amounts)
          .accounts({
            adminState: adminStateAddress,
            treasuryState: treasuryStateAddress,
            treasuryAta: treasuryAtaAddress,
            mint: testMint,
            admin: payer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .remainingAccounts(remainingAccounts)
          .signers([payer])
          .rpc();

      console.log("✅ Batch transfer transaction:", tx);

      // Verify final balances
      let totalTransferred = 0;
      for (let i = 0; i < userInfos.length; i++) {
        const userInfo = userInfos[i];
        const transferAmount = amounts[i].toNumber(); // Get the number amount back
        totalTransferred += transferAmount;

        const userAtaBalanceAfter = Number((await getTokenAccount(connection, userInfo.ata)).amount);
        const expectedUserBalance = userInfo.initialBalance - transferAmount;

        console.log(`   ${userInfo.userId} balance after: ${userAtaBalanceAfter / Math.pow(10, decimals)} (Expected: ${expectedUserBalance / Math.pow(10, decimals)})`);
        expect(userAtaBalanceAfter).to.equal(expectedUserBalance);
      }

      const treasuryFinalBalance = Number((await getTokenAccount(connection, treasuryAtaAddress)).amount);
      const expectedTreasuryBalance = treasuryInitialBalance + totalTransferred;

      console.log(`Treasury final balance: ${treasuryFinalBalance / Math.pow(10, decimals)} (Expected: ${expectedTreasuryBalance / Math.pow(10, decimals)})`);
      expect(treasuryFinalBalance).to.equal(expectedTreasuryBalance);

      console.log("✅ Batch admin transfer to treasury completed successfully");
    });
  });


  // describe("Edge Cases and Error Handling", () => {
  //   it("Should handle empty user ID gracefully", async () => {
  //     try {
  //       const [expectedPda] = PublicKey.findProgramAddressSync(
  //           [Buffer.from("deposit"), Buffer.from("")],
  //           program.programId
  //       );
  //
  //       const expectedAta = getAssociatedTokenAddressSync(
  //           testMint,
  //           expectedPda,
  //           true
  //       );
  //
  //       await program.methods
  //           .createUserDepositAccount("")
  //           .accounts({
  //             userPda: expectedPda,
  //             userAta: expectedAta,
  //             subscriptionTokenMint: testMint,
  //             payer: payer.publicKey,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  //             systemProgram: SystemProgram.programId,
  //           })
  //           .signers([payer])
  //           .rpc();
  //
  //       console.log("⚠️  Empty user ID was allowed (consider adding validation)");
  //     } catch (error) {
  //       console.log("✅ Empty user ID correctly rejected");
  //     }
  //   });
  //
  //   it("Should handle very long user ID", async () => {
  //     const longUserId = "A".repeat(100); // 100 character user ID
  //
  //     try {
  //       const [expectedPda] = PublicKey.findProgramAddressSync(
  //           [Buffer.from("deposit"), Buffer.from(longUserId)],
  //           program.programId
  //       );
  //
  //       const expectedAta = getAssociatedTokenAddressSync(
  //           testMint,
  //           expectedPda,
  //           true
  //       );
  //
  //       await program.methods
  //           .createUserDepositAccount(longUserId)
  //           .accounts({
  //             userPda: expectedPda,
  //             userAta: expectedAta,
  //             subscriptionTokenMint: testMint,
  //             payer: payer.publicKey,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  //             systemProgram: SystemProgram.programId,
  //           })
  //           .signers([payer])
  //           .rpc();
  //
  //       console.log("⚠️  Very long user ID was allowed");
  //     } catch (error) {
  //       console.log("✅ Long user ID correctly handled:", error.message);
  //     }
  //   });
  // });
  //
  // describe("Program Integration Tests", () => {
  //   it("Should demonstrate complete workflow", async () => {
  //     const workflowUserId = "WorkflowTest";
  //
  //     console.log(`\n🔄 Complete workflow demonstration for user: ${workflowUserId}`);
  //
  //     // Step 1: Find PDA address
  //     const pdaResult = await program.methods
  //         .findUserPdaAddress(workflowUserId)
  //         .rpc();
  //     console.log(`1️⃣ Found PDA address: ${pdaResult}`);
  //
  //     // Step 2: Create user deposit account
  //     const [expectedPda] = PublicKey.findProgramAddressSync(
  //         [Buffer.from("deposit"), Buffer.from(workflowUserId)],
  //         program.programId
  //     );
  //
  //     const expectedAta = getAssociatedTokenAddressSync(
  //         testMint,
  //         expectedPda,
  //         true
  //     );
  //
  //     const createResult = await program.methods
  //         .createUserDepositAccount(workflowUserId)
  //         .accounts({
  //           userPda: expectedPda,
  //           userAta: expectedAta,
  //           subscriptionTokenMint: testMint,
  //           payer: payer.publicKey,
  //           tokenProgram: TOKEN_PROGRAM_ID,
  //           associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  //           systemProgram: SystemProgram.programId,
  //         })
  //         .signers([payer])
  //         .rpc();
  //     console.log(`2️⃣ Created deposit account: ${createResult}`);
  //
  //     // Step 3: Get user info
  //     const userInfo = await program.methods
  //         .getUserDepositInfo()
  //         .accounts({
  //           userPda: expectedPda,
  //         })
  //         .view();
  //     console.log(`3️⃣ Retrieved user info: ${userInfo.userId}`);
  //
  //     // Step 4: Create additional ATA
  //     const secondMint = await createMint(connection, payer, payer.publicKey, null, 6);
  //     const secondAta = getAssociatedTokenAddressSync(secondMint, expectedPda, true);
  //
  //     const additionalAtaResult = await program.methods
  //         .createAdditionalAta(workflowUserId)
  //         .accounts({
  //           userPda: expectedPda,
  //           newAta: secondAta,
  //           mint: secondMint,
  //           payer: payer.publicKey,
  //           tokenProgram: TOKEN_PROGRAM_ID,
  //           associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  //           systemProgram: SystemProgram.programId,
  //         })
  //         .signers([payer])
  //         .rpc();
  //     console.log(`4️⃣ Created additional ATA: ${additionalAtaResult}`);
  //
  //     // Step 5: Mint tokens to both ATAs
  //     await mintTo(connection, payer, testMint, expectedAta, payer.publicKey, 500 * Math.pow(10, 9));
  //     await mintTo(connection, payer, secondMint, secondAta, payer.publicKey, 250 * Math.pow(10, 6));
  //
  //     // Verify final state
  //     const ata1Balance = await getTokenAccount(connection, expectedAta);
  //     const ata2Balance = await getTokenAccount(connection, secondAta);
  //
  //     console.log(`5️⃣ Final balances:`);
  //     console.log(`   ATA1 (${testMint.toString().slice(0, 8)}...): ${Number(ata1Balance.amount) / Math.pow(10, 9)}`);
  //     console.log(`   ATA2 (${secondMint.toString().slice(0, 8)}...): ${Number(ata2Balance.amount) / Math.pow(10, 6)}`);
  //
  //     console.log(`✅ Complete workflow successful!`);
  //   });
  // });
  //
  // // Performance and load testing
  // describe("Performance Tests", () => {
  //   it("Should handle batch user creation efficiently", async () => {
  //     const batchSize = 5;
  //     const userIds = Array.from({ length: batchSize }, (_, i) => `BatchUser${i}`);
  //
  //     console.log(`\n⚡ Performance test: Creating ${batchSize} users`);
  //     const startTime = Date.now();
  //
  //     const promises = userIds.map(async (userId) => {
  //       const [expectedPda] = PublicKey.findProgramAddressSync(
  //           [Buffer.from("deposit"), Buffer.from(userId)],
  //           program.programId
  //       );
  //
  //       const expectedAta = getAssociatedTokenAddressSync(
  //           testMint,
  //           expectedPda,
  //           true
  //       );
  //
  //       return program.methods
  //           .createUserDepositAccount(userId)
  //           .accounts({
  //             userPda: expectedPda,
  //             userAta: expectedAta,
  //             subscriptionTokenMint: testMint,
  //             payer: payer.publicKey,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  //             systemProgram: SystemProgram.programId,
  //           })
  //           .signers([payer])
  //           .rpc();
  //     });
  //
  //     const results = await Promise.all(promises);
  //     const endTime = Date.now();
  //
  //     console.log(`✅ Created ${batchSize} users in ${endTime - startTime}ms`);
  //     console.log(`📊 Average time per user: ${(endTime - startTime) / batchSize}ms`);
  //
  //     expect(results).to.have.length(batchSize);
  //   });
  // });

});