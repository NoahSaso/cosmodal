# @noahsaso/cosmodal

A wallet connector with mobile WalletConnect support for the Cosmos ecosystem.

## Setup

1. Install the Cosmodal package in your React project

```
yarn add @noahsaso/cosmodal

# OR

npm install --save @noahsaso/cosmodal
```

2. Import `WalletManagerProvider` and wrap it around your whole app. Only include it once as an ancestor of all components that need to access the wallet. Likely you'll want this in your root App component.

```tsx
import { FunctionComponent } from "react"
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate"
import { GasPrice } from "@cosmjs/stargate"
import { getKeplrFromWindow } from "@keplr-wallet/stores"
import { ChainInfo } from "@keplr-wallet/types"
import WalletConnect from "@walletconnect/client"
import {
  KeplrWalletConnectV1,
  Wallet,
  WalletClient,
  WalletManagerProvider,
} from "@noahsaso/cosmodal"
import type { AppProps } from "next/app"
import Head from "next/head"
import { EmbedChainInfos } from "../config"

const CHAIN_ID = "juno-1"
const GAS_PRICE = "0.0025ujuno"
const CHAIN_RPC_NODE = "https://rpc..."
const CHAIN_INFO: ChainInfo = "..."

const AvailableWallets: Wallet[] = [
  {
    id: "mobile-web",
    name: "",
    description: "",
    imageUrl: "",
    isWalletConnect: false,
    // Will not be shown in the picker since `isMobileWeb` is true.
    isMobileWeb: true,
    getClient: getKeplrFromWindow,
    getSigningClient: async (client) => {
      await client.enable(CHAIN_ID)
      const signer = await client.getOfflineSignerAuto(CHAIN_ID)
      return await SigningCosmWasmClient.connectWithSigner(
        CHAIN_RPC_NODE,
        signer,
        { gasPrice: GasPrice.fromString(GAS_PRICE) }
      )
    },
  },
  {
    id: "keplr-wallet-extension",
    name: "Keplr Wallet",
    description: "Keplr Chrome Extension",
    imageUrl: "/keplr-wallet-extension.png",
    isWalletConnect: false,
    isMobileWeb: false,
    getClient: getKeplrFromWindow,
    getSigningClient: async (client) => {
      await client.experimentalSuggestChain(CHAIN_INFO)
      await client.enable(CHAIN_ID)
      const signer = await client.getOfflineSignerAuto(CHAIN_ID)
      return await SigningCosmWasmClient.connectWithSigner(
        CHAIN_RPC_NODE,
        signer,
        { gasPrice: GasPrice.fromString(GAS_PRICE) }
      )
    },
    onSelect: async () => {
      const hasKeplr = !!(await getKeplrFromWindow())
      if (!hasKeplr) {
        throw new Error("Keplr not installed.")
      }
    },
  },
  // WalletConnect only supports mainnet. Not testnet.
  ...(CHAIN_ID === "juno-1"
    ? [
        {
          id: "walletconnect-keplr",
          name: "WalletConnect",
          description: "Keplr Mobile",
          imageUrl: "/walletconnect-keplr.png",
          isWalletConnect: true,
          isMobileWeb: false,
          getClient: async (walletConnect?: WalletConnect) => {
            if (walletConnect?.connected)
              return new KeplrWalletConnectV1(walletConnect, [CHAIN_INFO])
            throw new Error("Mobile wallet not connected.")
          },
          getSigningClient: async (client) => {
            // WalletConnect does not support suggesting chain.
            await client.enable(CHAIN_ID)
            // WalletConnect only supports Amino signing.
            const signer = await client.getOfflineSignerOnlyAmino(CHAIN_ID)
            return await SigningCosmWasmClient.connectWithSigner(
              CHAIN_RPC_NODE,
              signer,
              { gasPrice: GasPrice.fromString(GAS_PRICE) }
            )
          },
        },
      ]
    : []),
]

const MyApp: FunctionComponent<AppProps> = ({ Component, pageProps }) => (
  <WalletManagerProvider
    clientMeta={{
      name: "CosmodalExampleDAPP",
      description: "A dapp using the cosmodal library.",
      url: "https://cosmodal.example.app",
      icons: ["https://cosmodal.example.app/walletconnect.png"],
    }}
    wallets={AvailableWallets}
  >
    <Component {...pageProps} />
  </WalletManagerProvider>
)

export default MyApp
```

3. Manage the wallet by using the `useWalletManager` hook in your components. You can use the hook in as many components as you want since the same objects are always returned (as long as there is only one WalletManagerProvider ancestor).

```tsx
import { useWalletManager } from "@noahsaso/cosmodal"
import type { NextPage } from "next"
import { useEffect, useState } from "react"

const CW20_CONTRACT_ADDRESS = "..."
const RECIPIENT_ADDDRESS = "..."

const Home: NextPage = () => {
  const {
    connect,
    disconnect,
    connectedWallet,
    signingClient,
    connectionError,
  } = useWalletManager()

  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  useEffect(() => {
    if (!connectedWallet || !signingClient) return

    // Get the name of the connected wallet.
    connectedWallet.client.getKey(CHAIN_ID).then((key) => {
      setName(key.name)
    })
    // Get the address of the connected wallet.
    connectedWallet.client.getAccounts().then((accounts) => {
      setAddress(accounts[0].address)

      // Transfer 10 tokens from the wallet to the recipient address.
      signingClient
        .execute(
          walletAddress,
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
    })
  }, [connectedWallet])

  return connectedWallet ? (
    <div>
      <p>
        Name: <b>{name}</b>
      </p>
      <p>
        Address: <b>{address}</b>
      </p>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  ) : (
    <div>
      <button onClick={connect}>Connect</button>
      {connectionError && <p>{connectionError.message}</p>}
    </div>
  )
}

export default Home
```

## API

### Relevant types

```tsx
interface Wallet {
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
  ) => Promise<WalletClient | undefined>
  // A function that returns the SigningCosmWasmClient for this wallet.
  // Note: WalletConnect clients only support Amino signing and do not
  // support suggesting chain.
  // If not defined, signingClient will be undefined.
  getSigningClient?: (
    client: WalletClient
  ) => Promise<SigningCosmWasmClient | undefined> | undefined
  // A function whose response is awaited right after the wallet is
  // picked. If this throws an error, the selection process is
  // interrupted, `connectionError` is set to the thrown error, and all
  // modals are closed.
  onSelect?: () => Promise<void>
}

interface ModalClassNames {
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

interface IClientMeta {
  description: string
  url: string
  icons: string[]
  name: string
}

interface ConnectedWallet {
  wallet: Wallet
  walletClient: WalletClient
  signingClient: SigningCosmWasmClient
}

interface WalletManagerContextInterface {
  // Function to begin the connection process. This will either display
  // the wallet picker modal or immediately attempt to connect to a wallet
  // when `preselectedWalletId` is set.
  connect: () => void
  // Function that disconnects from the connected wallet.
  disconnect: () => Promise<void>
  // Connected wallet information and client.
  connectedWallet?: ConnectedWallet
  // Signing client for the connected wallet.
  signingClient?: SigningCosmWasmClient
  // Error encountered during the connection process, likely thrown by a
  // wallet's `getClient` or `getSigningClient`.
  connectionError?: unknown
  // If this app is running inside the Keplr Mobile web interface.
  isMobileWeb: boolean
}

interface WalletManagerProviderProps {
  // Wallets available for connection.
  wallets: Wallet[]
  // Class names applied to various components for custom theming.
  classNames?: ModalClassNames
  // Custom close icon.
  closeIcon?: ReactNode
  // Descriptive info about the webapp which gets displayed when enabling a
  // WalletConnect wallet (e.g. name, image, etc.).
  walletConnectClientMeta?: IClientMeta
  // A custom loader to display in the modals, such as enabling the wallet.
  renderLoader?: () => ReactNode
  // If set to true on mount, the connect function will be called as soon
  // as possible. If `preselectedWalletId` is also set, or the value for
  // the `localStorageKey` is set and `useLocalStorageForAutoConnect` is
  // set to true, `preselectedWalletId` taking precedence over the
  // localStorage value, the connect function will skip the selection modal
  // and attempt to connect to this wallet immediately. This can be used
  // to seamlessly reconnect a past session.
  attemptAutoConnect?: boolean
  // When set to a valid wallet ID, the connect function will skip the
  // selection modal and attempt to connect to this wallet immediately.
  preselectedWalletId?: string
  // localStorage key for saving or loading the wallet ID, according to the
  // other enabled props.
  localStorageKey?: string
  // When set to true, `localStorageKey` is defined, and the localStorage
  // value contains a valid wallet ID, the connect function will skip the
  // selection modal and attempt to connect to this wallet immediately.
  useLocalStorageForAutoConnect?: boolean
  // When set to true and `localStorageKey` is defined, the connected
  // wallet ID will be stored in the provided localStorage key.
  saveToLocalStorageOnConnect?: boolean
  // When set to true and `localStorageKey` is defined, the localStorage
  // key will be cleared when the wallet is disconnected.
  clearLocalStorageOnDisconnect?: boolean
  // Callback that will be attached as a listener to the
  // `keplr_keystorechange` event on the window object.
  onKeplrKeystoreChangeEvent?: (event: Event) => unknown
}
```

### WalletManagerProvider

This component takes the following properties:

| Property                        | Type                        | Required | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------- | --------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wallets`                       | `Wallet[]`                  | &#x2611; | Wallets available for connection.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `classNames`                    | `ModalClassNames`           |          | Class names applied to various components for custom theming.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `closeIcon`                     | `ReactNode`                 |          | Custom close icon.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `walletConnectClientMeta`       | `IClientMeta`               |          | Descriptive info about the React app which gets displayed when enabling a WalletConnect wallet (e.g. name, image, etc.).                                                                                                                                                                                                                                                                                                                                      |
| `renderLoader`                  | `() => ReactNode`           |          | A custom loader to display in a few modals, such as when enabling the wallet.                                                                                                                                                                                                                                                                                                                                                                                 |
| `attemptAutoConnect`            | `boolean`                   |          | If set to true on mount, the connect function will be called as soon as possible. If `preselectedWalletId` is also set, or the value for the `localStorageKey` is set and `useLocalStorageForAutoConnect` is set to true, `preselectedWalletId` taking precedence over the localStorage value, the connect function will skip the selection modal and attempt to connect to this wallet immediately. This can be used to seamlessly reconnect a past session. |
| `preselectedWalletId`           | `string`                    |          | When set to a valid wallet ID, the connect function will skip the selection modal and attempt to connect to this wallet immediately.                                                                                                                                                                                                                                                                                                                          |
| `localStorageKey`               | `string`                    |          | localStorage key for saving or loading the wallet ID, according to the other enabled props.                                                                                                                                                                                                                                                                                                                                                                   |
| `useLocalStorageForAutoConnect` | `boolean`                   |          | When set to true, `localStorageKey` is defined, and the localStorage value contains a valid wallet ID, the connect function will skip the selection modal and attempt to connect to this wallet immediately.                                                                                                                                                                                                                                                  |
| `saveToLocalStorageOnConnect`   | `boolean`                   |          | When set to true and `localStorageKey` is defined, the connected wallet ID will be stored in the provided localStorage key.                                                                                                                                                                                                                                                                                                                                   |
| `clearLocalStorageOnDisconnect` | `boolean`                   |          | When set to true and `localStorageKey` is defined, the localStorage key will be cleared when the wallet is disconnected.                                                                                                                                                                                                                                                                                                                                      |
| `onKeplrKeystoreChangeEvent`    | `(event: Event) => unknown` |          | Callback that will be attached as a listener to the `keplr_keystorechange` event on the window object.                                                                                                                                                                                                                                                                                                                                                        |

### useWalletManager

This hook returns the following properties in an object (`WalletManagerContextInterface`):

| Property          | Type                                 | Description                                                                                                                                                                                      |
| ----------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `connect`         | `() => void`                         | Function to begin the connection process. This will either display the wallet picker modal or immediately attempt to connect to a wallet depending on the props passed to WalletManagerProvider. |
| `disconnect`      | `() => Promise<void>`                | Function that disconnects from the connected wallet.                                                                                                                                             |
| `connectedWallet` | `ConnectedWallet \| undefined`       | Connected wallet information and client.                                                                                                                                                         |
| `signingClient`   | `SigningCosmWasmClient \| undefined` | Signing client for the connected wallet.                                                                                                                                                         |
| `connectionError` | `unknown`                            | Error encountered during the connection process, likely thrown by a wallet's `getClient` or `getSigningClient`.                                                                                  |
| `isMobileWeb`     | `boolean`                            | If this app is running inside the Keplr Mobile web interface.                                                                                                                                    |
