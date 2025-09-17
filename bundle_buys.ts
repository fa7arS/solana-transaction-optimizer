import {
  AddressLookupTableProgram,
  clusterApiUrl,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import dotenv from "dotenv";
import { PumpFunSDK } from "latest-pumpfun-sdk";
import BN from "bn.js";
import { createAndSendV0Tx } from "./txsExecutor";
import { createLUT } from "./createLookupTable";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { privateKeys } from "./buyersKeys";

dotenv.config();

const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=8b6b98fb-7c47-481b-a7dc-4c760ce43572", "confirmed");
const signer = Keypair.fromSecretKey(bs58.decode(process.env.SIGNER_KEY!));
const sdk = new PumpFunSDK(connection);
const lookup_address = new PublicKey(
  "E4b5B9C3hapUZY7qfbLXTsPdaRzUT1HbT7uGRS19DXyL"
);
const program_id = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const mint = new PublicKey("9rwU5ex3PAp6TZ4PQ68nnGHtcRmnD5Hyo4QzYWZVpump");
const creator = new PublicKey("Gqd1HsMwhNMHtqL1iZ2M23DriBPJdnbJR8PEBUCPDvB");

// more buyers wallet
const all_signers = privateKeys.map((data) => {
  return Keypair.fromSecretKey(bs58.decode(data));
});

const normalbundleTxs = async () => {
  const solAmount = 0.0001;
  const bonding_curve_data = await sdk.fetchBondingCurve(mint);
  const tokenAmount = sdk.getTokenAmount(bonding_curve_data, solAmount);

  console.log("💰 Token amount to receive:", tokenAmount);

  const global = await sdk.fetchGlobal();

  const bundle_buy_itx = [];

  for (const keypair of all_signers) {
    const tx1 = await sdk.getBuyTxs(
      global,
      mint,
      keypair.publicKey,
      100,
      new BN(tokenAmount),
      new BN(solAmount * LAMPORTS_PER_SOL)
    );

    if (tx1.success) {
      bundle_buy_itx.push(...tx1.data);
    }
  }


     console.log("helooooo---")
    let latestBlockhash = await connection.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      payerKey: signer.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [...bundle_buy_itx],
    }).compileToV0Message();

        const transaction = new VersionedTransaction(messageV0);

        transaction.sign([...all_signers]);

    //  const simulate = await connection.simulateTransaction(transaction);
    //  console.log("here is simulation res---", simulate);  

     console.log("the transaction size is-----", transaction.serialize().byteLength)

};

const lookupTxs = async () => {


  for (let i = 0; i < all_signers.length; i++) {
    const balance = await connection.getBalance(all_signers[i].publicKey);

    console.log(
      "here is teh balance of: " + all_signers[i].publicKey.toBase58(),
      " ",
      balance / LAMPORTS_PER_SOL
    );
  }

     const lookup_address =  await createLUT(signer,connection);
     console.log("here is teh lookup address---", lookup_address?.toBase58());

     if(!lookup_address) throw("lookup account creation failed!!")

  const lookupTableAccount = (
      await connection.getAddressLookupTable(lookup_address)
  ).value;

  if (lookupTableAccount == null) {
      console.log("Lookup table account not found!");
  }

  const accounts: PublicKey[] = []; 

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

  // adding all the atas of all signers
  for (const keypair of all_signers) {
    const user_ata = await getAssociatedTokenAddress(mint, keypair.publicKey);
    accounts.push(user_ata);
  }

  const extendInstruction = AddressLookupTableProgram.extendLookupTable({
    lookupTable: lookup_address,
    authority: signer.publicKey,
    payer: signer.publicKey,
    addresses: accounts,
  });

  await createAndSendV0Tx([extendInstruction], signer, connection);
};

const bundleBuyWithLookup = async () => {
 
    const lookupTableAccount = (
      await connection.getAddressLookupTable(lookup_address)
    ).value;

    if (!lookupTableAccount) throw "no account find---";
    console.log("here is all address---", lookupTableAccount);

  const solAmount = 0.0001;
  const bonding_curve_data = await sdk.fetchBondingCurve(mint);
  const tokenAmount = sdk.getTokenAmount(bonding_curve_data, solAmount);

  console.log("💰 Token amount to receive:", tokenAmount);

  const global = await sdk.fetchGlobal();

  const bundle_buy_itx = [];

  for (const keypair of all_signers) {
    const tx1 = await sdk.getBuyTxs(
      global,
      mint,
      keypair.publicKey,
      100,
      new BN(tokenAmount),
      new BN(solAmount * LAMPORTS_PER_SOL)
    );

    if (tx1.success) {
      bundle_buy_itx.push(...tx1.data);
    }
  }


     console.log("helooooo---")
    let latestBlockhash = await connection.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      payerKey: signer.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [...bundle_buy_itx],
    }).compileToV0Message([lookupTableAccount]);

        const transaction = new VersionedTransaction(messageV0);

        transaction.sign([...all_signers,signer]);

      try{
     const simulate = await connection.simulateTransaction(transaction);
     console.log("here is simulation res---", simulate);
     
     const sign = await connection.sendTransaction(transaction);

     console.log("here is the signature----", sign);
      } 
      catch(e){
        console.log("error--",e);
      }

     console.log("without lookup tables the transaction size is -----", transaction.serialize().byteLength - 200)
   

};

// normalTxs();
// lookupTxs();
bundleBuyWithLookup();
// normalbundleTxs();
