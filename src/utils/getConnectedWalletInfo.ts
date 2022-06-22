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
  const offlineSigner = await wallet.getOfflineSignerFunction(client)(
    chainInfo.chainId
  )

  const name = (await client.getKey(chainInfo.chainId))?.name ?? ""
  const address = (await offlineSigner.getAccounts())[0]?.address
  if (address === undefined) {
    throw new Error("Failed to retrieve wallet address.")
  }

  const signingCosmWasmClient = await SigningCosmWasmClient.connectWithSigner(
    chainInfo.rpc,
    offlineSigner,
    signingCosmWasmClientOptions
  )
  const signingStargateClient = await SigningStargateClient.connectWithSigner(
    chainInfo.rpc,
    offlineSigner,
    signingStargateClientOptions
  )

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
