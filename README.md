# @noahsaso/cosmodal

A wallet connector with mobile WalletConnect support for the Cosmos ecosystem.

## Example

The example is deployed on Vercel at https://noahsaso-cosmodal.vercel.app.

It can also be run locally using these commands:

```sh
# Clone the repo.
git clone https://github.com/NoahSaso/cosmodal
# Enter the example folder.
cd cosmodal/example

# Start the Next.js dev server.
npm install && npm run dev
# OR
yarn && yarn dev
```

## Setup

1. Install the Cosmodal package in your React project

```sh
npm install --save @noahsaso/cosmodal
# OR
yarn add @noahsaso/cosmodal
```

2. Import `WalletManagerProvider` and wrap it around your whole app. Only include it once as an ancestor of all components that need to access the wallet. Likely you'll want this in your root App component. Check out the example code to see how to define wallets.

```tsx
const MyApp: FunctionComponent<AppProps> = ({ Component, pageProps }) => (
  <WalletManagerProvider
    defaultChainId={ChainInfoID.Juno1}
    enabledWallets={[WalletType.Keplr, WalletType.WalletConnectKeplr]}
    walletConnectClientMeta={{
      name: "CosmodalExampleDAPP",
      description: "A dapp using the cosmodal library.",
      url: "https://cosmodal.example.app",
      icons: ["https://cosmodal.example.app/walletconnect.png"],
    }}
  >
    <Component {...pageProps} />
  </WalletManagerProvider>
)

export default MyApp
```

3. Manage the wallet by using the `useWalletManager` hook in your pages and components. You can use the hook in as many components as you want since the same objects are always returned (as long as there is only one WalletManagerProvider ancestor).

```tsx
const Home: NextPage = () => {
  const { connect, disconnect, connectedWallet, error } = useWalletManager()

  return connectedWallet ? (
    <div>
      <p>
        Name: <b>{connectedWallet.name}</b>
      </p>
      <p>
        Address: <b>{connectedWallet.address}</b>
      </p>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  ) : (
    <div>
      <button onClick={connect}>Connect</button>
      {error && <p>{error.message}</p>}
    </div>
  )
}

export default Home
```

## API

### WalletManagerProvider

This component takes the following properties:

| Property                          | Type                                                             | Required | Description                                                                                                                                          |
| --------------------------------- | ---------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabledWalletTypes`              | `WalletType[]`                                                   | &#x2611; | Wallet types available for connection.                                                                                                               |
| `defaultChainId`                  | `string`                                                         | &#x2611; | Chain ID to initially connect to and selected by default if nothing is passed to the hook. Must be present in one of the objects in `chainInfoList`. |
| `chainInfoOverrides`              | `ChainInfoOverrides \| undefined`                                |          | List or getter of additional or replacement ChainInfo objects. These will take precedent over internal definitions by comparing `chainId`.           |
| `classNames`                      | `ModalClassNames`                                                |          | Class names applied to various components for custom theming.                                                                                        |
| `closeIcon`                       | `ReactNode`                                                      |          | Custom close icon.                                                                                                                                   |
| `walletConnectClientMeta`         | `IClientMeta`                                                    |          | Descriptive info about the React app which gets displayed when enabling a WalletConnect wallet (e.g. name, image, etc.).                             |
| `renderLoader`                    | `() => ReactNode`                                                |          | A custom loader to display in a few modals, such as when enabling the wallet.                                                                        |
| `preselectedWalletType`           | `WalletType`                                                     |          | When set to a valid wallet type, the connect function will skip the selection modal and attempt to connect to this wallet immediately.               |
| `localStorageKey`                 | `string`                                                         |          | localStorage key for saving, loading, and auto connecting to a wallet.                                                                               |
| `onKeplrKeystoreChangeEvent`      | `(event: Event) => unknown`                                      |          | Callback that will be attached as a listener to the `keplr_keystorechange` event on the window object.                                               |
| `getSigningCosmWasmClientOptions` | `SigningClientGetter<SigningCosmWasmClientOptions> \| undefined` |          | Getter for options passed to SigningCosmWasmClient on connection.                                                                                    |
| `getSigningStargateClientOptions` | `SigningClientGetter<SigningStargateClientOptions> \| undefined` |          | Getter for options passed to SigningStargateClient on connection.                                                                                    |

### useWalletManager

This hook returns the following fields (`IWalletManagerContext`):

| Property                          | Type                                                             | Description                                                                                                                                                                                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connect`                         | `() => void`                                                     | Function to begin the connection process. This will either display the wallet picker modal or immediately attempt to connect to a wallet depending on the props passed to WalletManagerProvider.                                                                              |
| `disconnect`                      | `() => Promise<void>`                                            | Function that disconnects from the connected wallet.                                                                                                                                                                                                                          |
| `connectedWallet`                 | `ConnectedWallet \| undefined`                                   | Connected wallet info and clients for interacting with the chain.                                                                                                                                                                                                             |
| `status`                          | `WalletConnectionStatus`                                         | Status of cosmodal.                                                                                                                                                                                                                                                           |
| `error`                           | `unknown`                                                        | Error encountered during the connection process.                                                                                                                                                                                                                              |
| `isEmbeddedKeplrMobileWeb`        | `boolean`                                                        | If this app is running inside the Keplr Mobile web interface.                                                                                                                                                                                                                 |
| `chainInfoOverrides`              | `ChainInfoOverrides \| undefined`                                | List or getter of additional or replacement ChainInfo objects. These will take precedent over internal definitions by comparing `chainId`. This is passed through from the provider props to allow composition of your own hooks, and for use in the built-in useWallet hook. |
| `getSigningCosmWasmClientOptions` | `SigningClientGetter<SigningCosmWasmClientOptions> \| undefined` |                                                                                                                                                                                                                                                                               | Getter for options passed to SigningCosmWasmClient on connection. This is passed through from the provider props to allow composition of your own hooks, and for use in the built-in useWallet hook. |
| `getSigningStargateClientOptions` | `SigningClientGetter<SigningStargateClientOptions> \| undefined` |                                                                                                                                                                                                                                                                               | Getter for options passed to SigningStargateClient on connection. This is passed through from the provider props to allow composition of your own hooks, and for use in the built-in useWallet hook. |

### useWallet

This hooks returns the following fields (`ConnectedWallet` with `status` and `error` added):

| Property                | Type                                 | Description                                              |
| ----------------------- | ------------------------------------ | -------------------------------------------------------- |
| `status`                | `WalletConnectionStatus`             | Status of connection.                                    |
| `error`                 | `unknown`                            | Error encountered during the connection process.         |
| `wallet`                | `Wallet \| undefined`                | Wallet.                                                  |
| `walletClient`          | `WalletClient \| undefined`          | Wallet client.                                           |
| `chainInfo`             | `ChainInfo \| undefined`             | Chain info the clients are connected to.                 |
| `offlineSigner`         | `OfflineSigner \| undefined`         | Offline signer for the wallet client.                    |
| `name`                  | `string \| undefined`                | User's name for their wallet.                            |
| `address`               | `string \| undefined`                | Wallet address.                                          |
| `signingCosmWasmClient` | `SigningCosmWasmClient \| undefined` | Signing client for interacting with CosmWasm chain APIs. |
| `signingStargateClient` | `SigningStargateClient \| undefined` | Signing client for interacting with Stargate chain APIs. |

### Relevant types

```tsx
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

type WalletClient = Keplr | KeplrWalletConnectV1

enum WalletType {
  Keplr = "keplr",
  WalletConnectKeplr = "walletconnect_keplr",
}

interface ConnectedWallet {
  // Wallet.
  wallet: Wallet
  // Wallet client.
  walletClient: WalletClient
  // Chain info the clients are connected to.
  chainInfo: ChainInfo
  // Offline signer for the wallet client.
  offlineSigner: OfflineSigner
  // Name of wallet.
  name: string
  // Wallet address.
  address: string
  // Signing client for interacting with CosmWasm chain APIs.
  signingCosmWasmClient: SigningCosmWasmClient
  // Signing client for interacting with Stargate chain APIs.
  signingStargateClient: SigningStargateClient
}

enum WalletConnectionStatus {
  Initializing,
  AttemptingAutoConnection,
  // Don't call connect until this state is reached.
  ReadyForConnection,
  Connecting,
  Connected,
  Resetting,
  Errored,
}

type SigningClientGetter<T> = (
  chainInfo: ChainInfo
) => T | Promise<T | undefined> | undefined

type ChainInfoOverrides =
  | ChainInfo[]
  | (() => undefined | ChainInfo[] | Promise<undefined | ChainInfo[]>)

interface IWalletManagerContext {
  // Function to begin the connection process. This will either display
  // the wallet picker modal or immediately attempt to connect to a wallet
  // when `preselectedWalletType` is set.
  connect: () => void
  // Function that disconnects from the connected wallet.
  disconnect: () => Promise<void>
  // Connected wallet info and clients for interacting with the chain.
  connectedWallet?: ConnectedWallet
  // Status of cosmodal.
  status: WalletConnectionStatus
  // Error encountered during the connection process.
  error?: unknown
  // If this app is running inside the Keplr Mobile web interface.
  isEmbeddedKeplrMobileWeb: boolean
  // List or getter of additional or replacement ChainInfo objects. These
  // will take precedent over internal definitions by comparing `chainId`.
  // This is passed through from the provider props to allow composition
  // of your own hooks, and for use in the built-in useWallet hook.
  chainInfoOverrides?: ChainInfoOverrides
  // Getter for options passed to SigningCosmWasmClient on connection.
  // This is passed through from the provider props to allow composition
  // of your own hooks, and for use in the built-in useWallet hook.
  getSigningCosmWasmClientOptions?: SigningClientGetter<SigningCosmWasmClientOptions>
  // Getter for options passed to SigningStargateClient on connection.
  // This is passed through from the provider props to allow composition
  // of your own hooks, and for use in the built-in useWallet hook.
  getSigningStargateClientOptions?: SigningClientGetter<SigningStargateClientOptions>
}

interface WalletManagerProviderProps {
  // Wallet types available for connection.
  enabledWalletTypes: WalletType[]
  // Chain ID to initially connect to and selected by default if nothing
  // is passed to the hook. Must be present in one of the objects in
  // `chainInfoList`.
  defaultChainId: string
  // List or getter of additional or replacement ChainInfo objects. These
  // will take precedent over internal definitions by comparing `chainId`.
  chainInfoOverrides?: ChainInfoOverrides
  // Class names applied to various components for custom theming.
  classNames?: ModalClassNames
  // Custom close icon.
  closeIcon?: ReactNode
  // Descriptive info about the webapp which gets displayed when enabling a
  // WalletConnect wallet (e.g. name, image, etc.).
  walletConnectClientMeta?: IClientMeta
  // A custom loader to display in the modals, such as enabling the wallet.
  renderLoader?: () => ReactNode
  // When set to a valid wallet type, the connect function will skip the
  // selection modal and attempt to connect to this wallet immediately.
  preselectedWalletType?: `${WalletType}`
  // localStorage key for saving, loading, and auto connecting to a wallet.
  localStorageKey?: string
  // Callback that will be attached as a listener to the
  // `keplr_keystorechange` event on the window object.
  onKeplrKeystoreChangeEvent?: (event: Event) => unknown
  // Getter for options passed to SigningCosmWasmClient on connection.
  getSigningCosmWasmClientOptions?: SigningClientGetter<SigningCosmWasmClientOptions>
  // Getter for options passed to SigningStargateClient on connection.
  getSigningStargateClientOptions?: SigningClientGetter<SigningStargateClientOptions>
}
```
