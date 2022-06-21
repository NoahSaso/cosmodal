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

3. Manage the wallet by using the `useWalletManager` hook in your pages and components. You can use the hook in as many components as you want since the same objects are always returned (as long as there is only one WalletManagerProvider ancestor).

```tsx
const Home: NextPage = () => {
  const { connect, disconnect, connectedWallet, connectionError } =
    useWalletManager()

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
      {connectionError && <p>{connectionError.message}</p>}
    </div>
  )
}

export default Home
```

## API

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

| Property          | Type                           | Description                                                                                                                                                                                      |
| ----------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `connect`         | `() => void`                   | Function to begin the connection process. This will either display the wallet picker modal or immediately attempt to connect to a wallet depending on the props passed to WalletManagerProvider. |
| `disconnect`      | `() => Promise<void>`          | Function that disconnects from the connected wallet.                                                                                                                                             |
| `connectedWallet` | `ConnectedWallet \| undefined` | Connected wallet info and clients for interacting with the chain.                                                                                                                                |
| `connectionError` | `unknown`                      | Error encountered during the connection process, likely thrown by a wallet's `getClient` or `getSigningClient`.                                                                                  |
| `isMobileWeb`     | `boolean`                      | If this app is running inside the Keplr Mobile web interface.                                                                                                                                    |

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
  ) => WalletClient | Promise<WalletClient | undefined>
  // A function that returns the `OfflineSigner` for this wallet.
  // If undefined, `offlineSigner` and `address` will be undefined in the
  // `connectedWallet` object.
  getOfflineSigner?: (
    client: WalletClient
  ) => OfflineSigner | Promise<OfflineSigner | undefined> | undefined
  // A function that returns the name for this wallet.
  // If undefined, `name` will be undefined in the `connectedWallet`
  // object. If `getOfflineSigner` is undefined, the `offlineSigner`
  // argument will be undefined.
  getName?: (
    client: WalletClient,
    offlineSigner?: OfflineSigner
  ) => string | Promise<string | undefined> | undefined
  // A function that returns the SigningCosmWasmClient for this wallet.
  // If undefined, `signingClient` will be undefined. If `getOfflineSigner`
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
