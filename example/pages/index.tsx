import { useWalletManager } from "@noahsaso/cosmodal"
import type { NextPage } from "next"
import { useCallback } from "react"

const CW20_CONTRACT_ADDRESS = "..."
const RECIPIENT_ADDDRESS = "..."

const Home: NextPage = () => {
  const { connect, disconnect, connectedWallet, connectionError } =
    useWalletManager()

  const transfer = useCallback(async () => {
    if (!connectedWallet?.address || !connectedWallet?.signingClient) return

    // Transfer 10 tokens from the wallet to the recipient address.
    connectedWallet.signingClient
      .execute(
        connectedWallet.address,
        CW20_CONTRACT_ADDRESS,
        {
          transfer: {
            amount: "10",
            recipient: RECIPIENT_ADDDRESS,
          },
        },
        "auto"
      )
      .then((result) => {
        console.log("Transferred 10 tokens in TX " + result.transactionHash)
        alert("Transferred 10 tokens")
      })
  }, [connectedWallet])

  return connectedWallet ? (
    <div>
      <p>
        Name: <b>{connectedWallet.name}</b>
      </p>
      <p>
        Address: <b>{connectedWallet.address}</b>
      </p>
      <button onClick={transfer}>Transfer</button>
      <br />
      <br />
      <button onClick={disconnect}>Disconnect</button>
    </div>
  ) : (
    <div>
      <button onClick={connect}>Connect</button>
      {connectionError ? (
        <p>
          {connectionError instanceof Error
            ? connectionError.message
            : `${connectionError}`}
        </p>
      ) : undefined}
    </div>
  )
}

export default Home
