import {
  SigningCosmWasmClient,
  SigningCosmWasmClientOptions,
} from "@cosmjs/cosmwasm-stargate"
import {
  SigningStargateClient,
  SigningStargateClientOptions,
} from "@cosmjs/stargate"
import { ChainInfo } from "@keplr-wallet/types"

import { Wallet, WalletClient, WalletType } from "../types"

export const getConnectedWalletInfo = async (
  wallet: Wallet,
  client: WalletClient,
  chainInfo: ChainInfo,
  signingCosmWasmClientOptions?: SigningCosmWasmClientOptions,
  signingStargateClientOptions?: SigningStargateClientOptions
) => {
  // Only Keplr browser extension supports suggesting chain.
  // Not WalletConnect nor embedded Keplr Mobile web.
  if (wallet.type === WalletType.Keplr && client.mode !== "mobile-web") {
    await client.experimentalSuggestChain(chainInfo)
  }

  await client.enable(chainInfo.chainId)

  // Parallelize for efficiency.

  const [{ name }, offlineSigner] = await Promise.all([
    client.getKey(chainInfo.chainId),
    wallet.getOfflineSignerFunction(client)(chainInfo.chainId),
  ])

  const [address, signingCosmWasmClient, signingStargateClient] =
    await Promise.all([
      // Get address.
      offlineSigner.getAccounts().then((accounts) => accounts[0]?.address),
      // Get CosmWasm client.
      await SigningCosmWasmClient.connectWithSigner(
        chainInfo.rpc,
        offlineSigner,
        signingCosmWasmClientOptions
      ),
      // Get Stargate client.
      await SigningStargateClient.connectWithSigner(
        chainInfo.rpc,
        offlineSigner,
        signingStargateClientOptions
      ),
    ])

  if (address === undefined) {
    throw new Error("Failed to retrieve wallet address.")
  }

  return {
    walletType: wallet.type,
    walletClient: client,
    chainInfo,
    offlineSigner,
    name,
    address,
    signingCosmWasmClient,
    signingStargateClient,
  }
}
