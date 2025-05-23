import {
  WalletConnectionStatus,
  useWallet,
  useWalletManager,
} from "@noahsaso/cosmodal"
import type { NextPage } from "next"
import { useCallback, useState } from "react"

const Home: NextPage = () => {
  const { connect, disconnect } = useWalletManager()
  const {
    status: walletStatus,
    error,
    name,
    address,
    publicKey,
    signingCosmWasmClient,
  } = useWallet()

  const [contractAddress, setContractAddress] = useState("")
  const [msg, setMsg] = useState("")
  const [status, setStatus] = useState("")

  const execute = useCallback(async () => {
    if (!address || !signingCosmWasmClient) return

    setStatus("Loading...")

    try {
      // Parse message.
      const msgObject = JSON.parse(msg)

      // Execute message.
      const result = await signingCosmWasmClient.execute(
        address,
        contractAddress,
        msgObject,
        "auto"
      )

      console.log(result)
      setStatus(`Executed. TX: ${result.transactionHash}`)
    } catch (err) {
      console.error(err)
      setStatus(`Error: ${err instanceof Error ? err.message : `${err}`}`)
    }
  }, [address, contractAddress, msg, signingCosmWasmClient])

  return (
    <div className="absolute top-0 right-0 left-0 bottom-0 flex justify-center items-center">
      <div className="flex flex-col items-stretch gap-2 max-w-[90vw] max-h-[90vh]">
        {walletStatus === WalletConnectionStatus.Connected ? (
          <>
            <p>
              Name: <b>{name}</b>
            </p>
            <p>
              Address: <b>{address}</b>
            </p>
            <p>
              Public key: <b>{publicKey?.hex ?? "<empty>"}</b>
            </p>
            <button
              onClick={disconnect}
              className="px-3 py-2 rounded-md border border-gray bg-gray-200 hover:opacity-70"
            >
              Disconnect
            </button>

            <h1 className="text-lg mt-4">Execute Smart Contract</h1>
            <input
              type="text"
              placeholder="Contract Address"
              className="px-4 py-2 rounded-md outline"
              value={contractAddress}
              onChange={(event) => setContractAddress(event.target.value)}
            />

            <h2 className="text-lg mt-2">Message</h2>
            <textarea
              className="p-4 rounded-md outline font-mono"
              rows={10}
              value={msg}
              onChange={(event) => setMsg(event.target.value)}
            />

            <button
              onClick={execute}
              className="px-3 py-2 rounded-md border border-gray bg-gray-200 hover:opacity-70 mt-4"
            >
              Execute
            </button>

            {status && (
              <pre className="overflow-scroll text-xs mt-2">{status}</pre>
            )}
          </>
        ) : (
          <>
            <button
              onClick={connect}
              disabled={
                walletStatus !== WalletConnectionStatus.ReadyForConnection
              }
              className="px-3 py-2 rounded-md border border-gray bg-gray-200 hover:opacity-70"
            >
              {walletStatus !== WalletConnectionStatus.ReadyForConnection
                ? "Connecting"
                : "Connect"}
            </button>
            {error ? (
              <p>{error instanceof Error ? error.message : `${error}`}</p>
            ) : undefined}
          </>
        )}
      </div>
    </div>
  )
}

export default Home
