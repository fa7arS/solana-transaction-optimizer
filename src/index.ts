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

const normalTxs = async() =>{

  const solAmount = 0.0001;
  const bonding_curve_data = await sdk.fetchBondingCurve(mint);
  const tokenAmount = sdk.getTokenAmount(bonding_curve_data, solAmount);

  console.log("Token amount to receive:", tokenAmount);

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

    console.log("without lookup table the transaction size ---", transaction.serialize().byteLength);

    // const simulation = await connection.simulateTransaction(transaction);
    // console.log("here is simulation res---", simulation);
  }
}

const lookupTableAddressCreation = async() =>{

   const lookup_address =  await createLUT(signer,connection);

   if(!lookup_address) throw("no account find---");

   console.log("here is teh lookup address---", lookup_address?.toBase58());

    const lookupTableAccount = (
        await connection.getAddressLookupTable(lookup_address)
    ).value;

    if (lookupTableAccount == null) {
        console.log("Lookup table account not found!");
    }

    const accounts: PublicKey[] = []; // Array with all new keys to push to the new LUT

    // fetching all accounts for the lookup inster
    const global = new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
    const fee_recipent = new PublicKey("AVmoTthdrX6tKt4nDjco2D775W2YK3sDhxPcMmzUAmTY");
    const bonding_curve = PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"),mint.toBuffer()],program_id)[0];
    const associated_bonding_curve = await getAssociatedTokenAddress(mint,bonding_curve,true);
    const user_ata = await getAssociatedTokenAddress(mint,signer.publicKey);
    const  creator_vault = PublicKey.findProgramAddressSync(
        [Buffer.from("creator-vault"), creator.toBuffer()],
        program_id,
    )[0];
    const event_authority = new PublicKey("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1");
    const global_volume_accumulator = new PublicKey("Hq2wp8uJ9jCPsYgNHex8RtqdvMPfVGoYwjvF1ATiwn2Y");
    const user_volume_accumulator = new PublicKey("28GfGdLbF6o2qmTuBLrr5HUnYJdUsj8ZARDu26hQRyrG");   // this account can vary for diffrent wallet address
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

      const extendInstruction = AddressLookupTableProgram.extendLookupTable({
            lookupTable: lookup_address,
            authority: signer.publicKey,
            payer: signer.publicKey,
            addresses: accounts,
        });

       await createAndSendV0Tx([extendInstruction],signer,connection);
}


const buyWithLookup = async() => {
     
  const solAmount = 0.0001;
  const bonding_curve_data = await sdk.fetchBondingCurve(mint);
  const tokenAmount = sdk.getTokenAmount(bonding_curve_data, solAmount);

  console.log("Token amount to receive:", tokenAmount);

  const global = await sdk.fetchGlobal();

  const tx1 = await sdk.getBuyTxs(
    global,
    mint,
    signer.publicKey,
    100,
    new BN(tokenAmount),
    new BN(solAmount * LAMPORTS_PER_SOL)
  );


  if(tx1.success){

    const lookupTableAccount = (
  await connection.getAddressLookupTable(lookup_address)
).value;



    if(!lookupTableAccount) throw("no account find---");
    // console.log("here is all address---", lookupTableAccount);

    let latestBlockhash = await connection.getLatestBlockhash();


    const messageV0 = new TransactionMessage({
      payerKey: signer.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [...tx1.data]
    }).compileToV0Message([lookupTableAccount]);

    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([signer]);

    console.log("with lookup table the transaction size ---", transaction.serialize().byteLength);

    // const simulation = await connection.simulateTransaction(transaction);
    // console.log("here is simulation res---", simulation);
  }





}

// normalTxs();
// lookupTxs();
buyWithLookup();