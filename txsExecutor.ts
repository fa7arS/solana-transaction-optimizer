import { Connection, Keypair, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";

export const createAndSendV0Tx = async (txInstructions: TransactionInstruction[], kp: Keypair, connection: Connection) => {
  try {
    let latestBlockhash = await connection.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      payerKey: kp.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: txInstructions
    }).compileToV0Message();
    const transaction = new VersionedTransaction(messageV0);

    transaction.sign([kp]);



    const simulation = await connection.simulateTransaction(transaction);

    console.log("here is simulation result----", simulation);

    // const txid = await connection.sendTransaction(transaction, { maxRetries: 5 });

    // const confirmation = await confirmTransaction(connection, txid);
    // console.log('LUT transaction successfully confirmed!', '\n', `https://explorer.solana.com/tx/${txid}`);
    // return confirmation.err == null

    return true;

  } catch (error) {
    console.log(".....")
    return false
  }
}
