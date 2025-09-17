import { AddressLookupTableProgram, clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import dotenv from "dotenv";
import { PumpFunSDK } from "latest-pumpfun-sdk";
import BN from "bn.js";
import { createAndSendV0Tx } from "../txsExecutor";
import { createLUT } from "./createLookupTable";
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";

dotenv.config();

const connection = new Connection(clusterApiUrl("mainnet-beta"),"confirmed");
const signer = Keypair.fromSecretKey(bs58.decode(process.env.SIGNER_KEY!));
const sdk = new PumpFunSDK(connection);
const lookup_address = new PublicKey("E4b5B9C3hapUZY7qfbLXTsPdaRzUT1HbT7uGRS19DXyL");
const program_id = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const mint = new PublicKey("9rwU5ex3PAp6TZ4PQ68nnGHtcRmnD5Hyo4QzYWZVpump");
const creator = new PublicKey("Gqd1HsMwhNMHtqL1iZ2M23DriBPJdnbJR8PEBUCPDvB");

const normalTxs = async() => {
    console.log("\n[INFO] Creating NORMAL transaction (without lookup table)...");
    
    try {
        const solAmount = 0.0001;
        const bonding_curve_data = await sdk.fetchBondingCurve(mint);
        const tokenAmount = sdk.getTokenAmount(bonding_curve_data, solAmount);

        console.log(`[DATA] Token amount to receive: ${tokenAmount}`);
        console.log(`[DATA] SOL amount to spend: ${solAmount}`);

        const global = await sdk.fetchGlobal();

        const tx1 = await sdk.getBuyTxs(
            global,
            mint,
            signer.publicKey,
            100,
            new BN(tokenAmount),
            new BN(solAmount * LAMPORTS_PER_SOL)
        );

        if (tx1.success) {
            let latestBlockhash = await connection.getLatestBlockhash();

            const messageV0 = new TransactionMessage({
                payerKey: signer.publicKey,
                recentBlockhash: latestBlockhash.blockhash,
                instructions: [...tx1.data]
            }).compileToV0Message();

            const transaction = new VersionedTransaction(messageV0);
            transaction.sign([signer]);

            const txSize = transaction.serialize().byteLength;
            console.log(`[RESULT] Normal transaction size: ${txSize} bytes`);
            console.log(`[RESULT] Number of instructions: ${tx1.data.length}`);
            console.log(`[RESULT] Number of signers: 1`);
            console.log(`[SUCCESS] Normal transaction created successfully`);

            return {
                size: txSize,
                instructions: tx1.data.length,
                signers: 1,
                success: true
            };
        } else {
            console.log("[ERROR] Failed to create buy transaction");
            return { success: false };
        }
    } catch (error) {
        console.log("[ERROR] Error in normalTxs:", error);
        return { success: false, error };
    }
}

const lookupTableAddressCreation = async() => {
    console.log("\n[INFO] Creating and extending lookup table...");
    
    try {
        const lookup_address = await createLUT(signer, connection);

        if (!lookup_address) throw("No lookup address created");

        console.log(`[RESULT] Lookup table address: ${lookup_address.toBase58()}`);

        const lookupTableAccount = (
            await connection.getAddressLookupTable(lookup_address)
        ).value;

        if (lookupTableAccount == null) {
            console.log("[ERROR] Lookup table account not found!");
            return;
        }

        const accounts: PublicKey[] = [];

        // Fetching all accounts for the lookup table
        const global = new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
        const fee_recipent = new PublicKey("AVmoTthdrX6tKt4nDjco2D775W2YK3sDhxPcMmzUAmTY");
        const bonding_curve = PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"),mint.toBuffer()],program_id)[0];
        const associated_bonding_curve = await getAssociatedTokenAddress(mint,bonding_curve,true);
        const user_ata = await getAssociatedTokenAddress(mint,signer.publicKey);
        const creator_vault = PublicKey.findProgramAddressSync(
            [Buffer.from("creator-vault"), creator.toBuffer()],
            program_id,
        )[0];
        const event_authority = new PublicKey("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1");
        const global_volume_accumulator = new PublicKey("Hq2wp8uJ9jCPsYgNHex8RtqdvMPfVGoYwjvF1ATiwn2Y");
        const user_volume_accumulator = new PublicKey("28GfGdLbF6o2qmTuBLrr5HUnYJdUsj8ZARDu26hQRyrG");
        const fee_config = new PublicKey("8Wf5TiAheLUqBrKXeYg2JtAFFMWtKdG2BSFgqUcPVwTt");

        accounts.push(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            event_authority,
            global,
            program_id,
            associated_bonding_curve,
            bonding_curve,
            SystemProgram.programId,
            SYSVAR_RENT_PUBKEY,
            signer.publicKey,
            fee_config,
            fee_recipent,
            global_volume_accumulator,
            user_volume_accumulator,
            user_ata,
            creator_vault
        );

        console.log(`[INFO] Adding ${accounts.length} accounts to lookup table`);

        const extendInstruction = AddressLookupTableProgram.extendLookupTable({
            lookupTable: lookup_address,
            authority: signer.publicKey,
            payer: signer.publicKey,
            addresses: accounts,
        });

        await createAndSendV0Tx([extendInstruction], signer, connection);
        console.log(`[SUCCESS] Lookup table extended successfully with ${accounts.length} accounts`);
        
        return lookup_address;
    } catch (error) {
        console.log("[ERROR] Error creating/extending lookup table:", error);
        throw error;
    }
}

const buyWithLookup = async() => {
    console.log("\n[INFO] Creating transaction WITH lookup table...");
    
    try {
        const solAmount = 0.0001;
        const bonding_curve_data = await sdk.fetchBondingCurve(mint);
        const tokenAmount = sdk.getTokenAmount(bonding_curve_data, solAmount);

        console.log(`[DATA] Token amount to receive: ${tokenAmount}`);
        console.log(`[DATA] SOL amount to spend: ${solAmount}`);

        const global = await sdk.fetchGlobal();

        const tx1 = await sdk.getBuyTxs(
            global,
            mint,
            signer.publicKey,
            100,
            new BN(tokenAmount),
            new BN(solAmount * LAMPORTS_PER_SOL)
        );

        if (tx1.success) {
            const lookupTableAccount = (
                await connection.getAddressLookupTable(lookup_address)
            ).value;

            if (!lookupTableAccount) throw("No lookup table account found");
            
            console.log(`[INFO] Using lookup table: ${lookup_address.toBase58()}`);
            console.log(`[DATA] Lookup table contains ${lookupTableAccount.state.addresses.length} addresses`);

            let latestBlockhash = await connection.getLatestBlockhash();

            const messageV0 = new TransactionMessage({
                payerKey: signer.publicKey,
                recentBlockhash: latestBlockhash.blockhash,
                instructions: [...tx1.data]
            }).compileToV0Message([lookupTableAccount]);

            const transaction = new VersionedTransaction(messageV0);
            transaction.sign([signer]);

            const txSize = transaction.serialize().byteLength;
            console.log(`[RESULT] Lookup table transaction size: ${txSize} bytes`);
            console.log(`[RESULT] Number of instructions: ${tx1.data.length}`);
            console.log(`[RESULT] Number of signers: 1`);
            console.log(`[SUCCESS] Lookup table transaction created successfully`);

            return {
                size: txSize,
                instructions: tx1.data.length,
                signers: 1,
                lookupTableAccounts: lookupTableAccount.state.addresses.length,
                success: true
            };
        } else {
            console.log("[ERROR] Failed to create buy transaction");
            return { success: false };
        }
    } catch (error) {
        console.log("[ERROR] Error in buyWithLookup:", error);
        return { success: false, error };
    }
}

const LookupImprovement = async() => {
    console.log("\n" + "=".repeat(60));
    console.log("SOLANA LOOKUP TABLE COMPARISON ANALYSIS");
    console.log("=".repeat(60));
    
    try {
        // Run both transaction types
        const normalResult = await normalTxs();
        const lookupResult = await buyWithLookup();

        console.log("\n" + "=".repeat(60));
        console.log("COMPARISON RESULTS");
        console.log("=".repeat(60));

        if (normalResult.success && lookupResult.success && normalResult.size && lookupResult.size) {
            const byteSavings = normalResult.size - lookupResult.size;
            const percentReduction = ((byteSavings / normalResult.size) * 100).toFixed(2);
            const efficiencyGain = ((normalResult.size / lookupResult.size) - 1) * 100;

            console.log(`\nTRANSACTION SIZES:`);
            console.log(`   Normal Transaction:     ${normalResult.size} bytes`);
            console.log(`   With Lookup Table:      ${lookupResult.size} bytes`);
            console.log(`   Absolute Savings:       ${byteSavings} bytes`);
            
            console.log(`\nEFFICIENCY METRICS:`);
            console.log(`   Size Reduction:         ${percentReduction}%`);
            console.log(`   Efficiency Gain:        ${efficiencyGain.toFixed(2)}%`);
            console.log(`   Compression Ratio:      ${(normalResult.size / lookupResult.size).toFixed(2)}:1`);

            console.log(`\nTRANSACTION DETAILS:`);
            console.log(`   Instructions:           ${normalResult.instructions}`);
            console.log(`   Signers:               ${normalResult.signers}`);
            if (lookupResult.lookupTableAccounts) {
                console.log(`   Lookup Table Accounts:  ${lookupResult.lookupTableAccounts}`);
            }

            console.log(`\nANALYSIS:`);
            if (parseFloat(percentReduction) > 50) {
                console.log(`   EXCELLENT: ${percentReduction}% reduction is highly effective!`);
            } else if (parseFloat(percentReduction) > 30) {
                console.log(`   GOOD: ${percentReduction}% reduction provides solid benefits`);
            } else if (parseFloat(percentReduction) > 15) {
                console.log(`   MODERATE: ${percentReduction}% reduction is decent`);
            } else {
                console.log(`   MINIMAL: ${percentReduction}% reduction may not justify complexity`);
            }

            console.log(`\nCOST IMPLICATIONS:`);
            console.log(`   Note: Solana fees are signature-based, not size-based`);
            console.log(`   Benefits: Better network efficiency, reliability, and future-proofing`);
            
            console.log(`\nNETWORK IMPACT:`);
            const bandwidthSaved = (byteSavings / 1024).toFixed(2);
            console.log(`   Bandwidth Saved:        ${bandwidthSaved} KB per transaction`);
            console.log(`   Block Space Efficiency: ${percentReduction}% more efficient`);

            // Performance recommendations
            console.log(`\nRECOMMENDATIONS:`);
            if (parseFloat(percentReduction) > 40) {
                console.log(`   [RECOMMENDED] Highly recommend using lookup tables for this use case`);
                console.log(`   [RECOMMENDED] Consider implementing for similar transaction patterns`);
            } else if (parseFloat(percentReduction) > 20) {
                console.log(`   [RECOMMENDED] Lookup tables provide good value for this use case`);
                console.log(`   [SUGGESTION] Monitor for additional optimization opportunities`);
            } else {
                console.log(`   [CAUTION] Evaluate if lookup table complexity is worth the savings`);
                console.log(`   [SUGGESTION] Consider batching more operations to increase efficiency`);
            }

        } else {
            console.log("\nCOMPARISON FAILED:");
            if (!normalResult.success) {
                console.log(`   Normal transaction error: ${normalResult.error || 'Unknown error'}`);
            }
            if (!lookupResult.success) {
                console.log(`   Lookup transaction error: ${lookupResult.error || 'Unknown error'}`);
            }
        }

    } catch (error) {
        console.log(`\nCOMPARISON ERROR: ${error}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("ANALYSIS COMPLETE");
    console.log("=".repeat(60));
}

export {
    normalTxs,
    buyWithLookup,
    lookupTableAddressCreation,
    LookupImprovement
};

LookupImprovement();