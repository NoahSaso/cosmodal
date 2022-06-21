import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate"
import { OfflineSigner } from "@cosmjs/proto-signing"
import { Keplr } from "@keplr-wallet/types"
import WalletConnect from "@walletconnect/client"

import { KeplrWalletConnectV1 } from "./connectors"

export type WalletClient = Keplr | KeplrWalletConnectV1

export interface Wallet {
  // A unique identifier among all wallets.
  id: string
  // The name of the wallet.
  name: string
  // A description of the wallet.
  description: string
  // The URL of the wallet logo.
  imageUrl: string
  // If this wallet client uses WalletConnect.
  isWalletConnect: boolean
  // If this wallet should be selected for mobile web. It will not be
  // shown in the selector modal. It will autoconnect in mobile web.
  isMobileWeb: boolean
  // A function that returns an instantiated wallet client, with
  // walletConnect passed if `isWalletConnect` is true.
  getClient: (
    walletConnect?: WalletConnect
  ) => WalletClient | Promise<WalletClient | undefined>
  // A function that returns the OfflineSigner for this wallet.
  // If undefined, offlineSigner will be undefined.
  getOfflineSigner?: (
    client: WalletClient
  ) => OfflineSigner | Promise<OfflineSigner | undefined> | undefined
  // A function that returns the name for this wallet.
  // If not defined, name will be undefined. If `getOfflineSigner` is
  // undefined, the `offlineSigner` argument will be undefined,
  getName?: (
    client: WalletClient,
    offlineSigner?: OfflineSigner
  ) => string | Promise<string | undefined> | undefined
  // A function that returns the SigningCosmWasmClient for this wallet.
  // If undefined, signingClient will be undefined. If `getOfflineSigner`
  // is undefined, the `offlineSigner` argument will be undefined.
  getSigningClient?: (
    client: WalletClient,
    offlineSigner?: OfflineSigner
  ) =>
    | SigningCosmWasmClient
    | Promise<SigningCosmWasmClient | undefined>
    | undefined
  // A function whose response is awaited right after the wallet is
  // picked. If this throws an error, the selection process is
  // interrupted, `connectionError` is set to the thrown error, and all
  // modals are closed.
  onSelect?: () => Promise<void>
}

export interface ConnectedWallet {
  wallet: Wallet
  walletClient: WalletClient
  name?: string
  address?: string
  offlineSigner?: OfflineSigner
  signingClient?: SigningCosmWasmClient
}

export interface ModalClassNames {
  modalContent?: string
  modalOverlay?: string
  modalHeader?: string
  modalSubheader?: string
  modalCloseButton?: string
  walletList?: string
  wallet?: string
  walletImage?: string
  walletInfo?: string
  walletName?: string
  walletDescription?: string
  textContent?: string
}
