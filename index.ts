import { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import dotenv from "dotenv";
import { PumpFunSDK } from "latest-pumpfun-sdk";
import BN from "bn.js";
import { createAndSendV0Tx } from "./txsExecutor";

dotenv.config();


const connection = new Connection(clusterApiUrl("mainnet-beta"),"confirmed");
const signer = Keypair.fromSecretKey(bs58.decode(process.env.SIGNER_KEY!));
const sdk = new PumpFunSDK(connection);


const normalTxs = async() =>{
  const mint = new PublicKey("9rwU5ex3PAp6TZ4PQ68nnGHtcRmnD5Hyo4QzYWZVpump")


  const solAmount = 0.01;
  const bonding_curve_data = await sdk.fetchBondingCurve(mint);
  const tokenAmount = sdk.getTokenAmount(bonding_curve_data, solAmount);

  console.log("💰 Token amount to receive:", tokenAmount);

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
    createAndSendV0Tx([...tx1.data],signer,connection);
  }
}





normalTxs();