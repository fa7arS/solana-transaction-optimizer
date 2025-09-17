import { AddressLookupTableProgram, ComputeBudgetProgram, Connection, Keypair } from "@solana/web3.js"
import { createAndSendV0Tx } from "./txsExecutor";



export const createLUT = async (mainKP: Keypair,connection:Connection) => {
    let i = 0;

    while(true){
        if(i > 5) {
            console.log("Failed to create LUT");
            break;
        }

       const slot = await connection.getSlot();
       console.log("Slot:", slot);

       try {

        const [lookupTableInst,lookupTableAddress] = await AddressLookupTableProgram.createLookupTable({
            authority: mainKP.publicKey,
            payer: mainKP.publicKey,
            recentSlot: slot
        });

        console.log("Lookup Table Address:", lookupTableAddress.toBase58());

        const res = await createAndSendV0Tx([
            ComputeBudgetProgram.setComputeUnitLimit({units: 50_000}),
            ComputeBudgetProgram.setComputeUnitPrice({microLamports:500_000}),
            lookupTableInst
        ],mainKP,connection);

        if(!res) throw new Error("Failed to create LUT");

        console.log("LUT created successfully");
        console.log("Please wait for about 15 seconds...");

        await new Promise(resolve => setTimeout(resolve, 15000));

         return lookupTableAddress;
       } catch (error) {
        console.log("Retrying to create Lookuptable until it is created...")
        i++;
       }
    }

}