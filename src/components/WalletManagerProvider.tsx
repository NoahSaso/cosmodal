import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate"
import { SigningStargateClient } from "@cosmjs/stargate"
import { ChainInfo } from "@keplr-wallet/types"
import WalletConnect from "@walletconnect/client"
import { IClientMeta } from "@walletconnect/types"
import React, {
  FunctionComponent,
  PropsWithChildren,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { KeplrWalletConnectV1 } from "../connectors"
import {
  ConnectedWallet,
  ModalClassNames,
  State,
  Wallet,
  WalletClient,
  WalletType,
} from "../types"
import {
  BaseModal,
  EnablingWalletModal,
  SelectWalletModal,
  WalletConnectModal,
} from "./ui"
import { WalletManagerContext } from "./WalletManagerContext"

// Causes SSR issues if importing this package directly... idk why
const getKeplrFromWindow = async () =>
  (await import("@keplr-wallet/stores")).getKeplrFromWindow()

const keplrWallet: Wallet = {
  type: WalletType.Keplr,
  name: "Keplr Wallet",
  description: "Keplr Chrome Extension",
  imageUrl: "/keplr-wallet-extension.png",
  getClient: getKeplrFromWindow,
  getOfflineSignerFunction: (client) => client.getOfflineSignerAuto,
}
const walletConnectKeplrWallet: Wallet = {
  type: WalletType.WalletConnectKeplr,
  name: "Keplr Wallet",
  description: "Keplr Chrome Extension",
  imageUrl: "/keplr-wallet-extension.png",
  getClient: async (chainInfo, walletConnect) => {
    if (walletConnect?.connected)
      return new KeplrWalletConnectV1(walletConnect, [chainInfo])
    throw new Error("Mobile wallet not connected.")
  },
  // WalletConnect only supports Amino signing.
  getOfflineSignerFunction: (client) => client.getOfflineSignerOnlyAmino,
}
const Wallets: Wallet[] = [keplrWallet, walletConnectKeplrWallet]

export type WalletManagerProviderProps = PropsWithChildren<{
  // Wallet types available for connection.
  enabledWalletTypes: WalletType[]
  // List of ChainInfo objects of possible chains that can be connected to.
  chainInfoList: ChainInfo[]
  // Chain ID to connect to. Must be present in one of the objects in
  // `chainInfoList`.
  chainId: ChainInfo["chainId"]
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
}>

export const WalletManagerProvider: FunctionComponent<
  WalletManagerProviderProps
> = ({
  children,
  enabledWalletTypes,
  chainInfoList,
  chainId,
  classNames,
  closeIcon,
  renderLoader,
  walletConnectClientMeta,
  preselectedWalletType,
  localStorageKey,
  onKeplrKeystoreChangeEvent,
}) => {
  //! STATE

  const enabledWallets = useMemo(
    () => Wallets.filter(({ type }) => enabledWalletTypes.includes(type)),
    [enabledWalletTypes]
  )

  const [isEmbeddedKeplrMobileWeb, setIsEmbeddedKeplrMobileWeb] =
    useState(false)

  // Modal State
  const [pickerModalOpen, setPickerModalOpen] = useState(false)
  const [walletEnableModalOpen, setWalletEnableModalOpen] = useState(false)
  // If set, opens QR code modal.
  const [walletConnectUri, setWalletConnectUri] = useState<string>()

  // WalletConnect State
  const [walletConnect, setWalletConnect] = useState<WalletConnect>()
  // Call when closing QR code modal manually.
  const onQrCloseCallback = useRef<() => void>()

  // Wallet connection State
  const [connectedWallet, setConnectedWallet] = useState<ConnectedWallet>()
  const [error, setError] = useState<unknown>()
  // Once mobile web is checked, we are ready to auto-connect.
  const [state, setState] = useState<State>(State.Initializing)
  // In case WalletConnect fails to load, we need to be able to retry.
  // This is done through clicking reset on the WalletConnectModal.
  const [connectingWallet, setConnectingWallet] = useState<Wallet>()
  const connectionAttemptRef = useRef(0)
  // Reset connection when it gets stuck somewhere.
  const [connectToWalletUponReset, setConnectToWalletUponReset] =
    useState<Wallet>()

  //! CALLBACKS

  // Retrieve chain info for initial wallet connection, throwing error if
  // not found.
  const _getConnectionChainInfo = useCallback(() => {
    const chainInfo = chainInfoList.find((info) => info.chainId === chainId)
    if (!chainInfo) {
      throw new Error(
        `Chain ID "${chainId}" does not exist among provided ChainInfo objects. Available Chain IDs: ${chainInfoList
          .map(({ chainId }) => chainId)
          .join(",")}`
      )
    }
    return chainInfo
  }, [chainInfoList, chainId])

  // Closes modals and clears connection state.
  const _cleanupAfterConnection = useCallback((walletClient?: WalletClient) => {
    // Close modals.
    setPickerModalOpen(false)
    setWalletConnectUri(undefined)
    setWalletEnableModalOpen(false)
    // Allow future enable requests to open the app.
    if (walletClient instanceof KeplrWalletConnectV1) {
      walletClient.dontOpenAppOnEnable = false
    }
    // No longer connecting a wallet.
    setConnectingWallet(undefined)
  }, [])

  // Disconnect from connected wallet.
  const disconnect = useCallback(
    async (dontKillWalletConnect?: boolean) => {
      // Disconnect wallet.
      setConnectedWallet(undefined)
      setState(State.ReadyForConnection)
      // Remove localStorage value.
      if (localStorageKey) {
        localStorage.removeItem(localStorageKey)
      }

      // Disconnect WalletConnect.
      setWalletConnect(undefined)
      if (walletConnect?.connected && !dontKillWalletConnect) {
        await walletConnect.killSession()
      }
    },
    [localStorageKey, walletConnect]
  )

  const _getConnectedWalletData = useCallback(
    async (wallet: Wallet, client: WalletClient) => {
      const chainInfo = _getConnectionChainInfo()

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

      const signingCosmWasmClient =
        await SigningCosmWasmClient.connectWithSigner(
          chainInfo.rpc,
          offlineSigner
          // TODO: Add back in.
          // {
          //   gasPrice: GasPrice.fromString(GAS_PRICE),
          // }
        )
      const signingStargateClient =
        await SigningStargateClient.connectWithSigner(
          chainInfo.rpc,
          offlineSigner
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
    },
    [_getConnectionChainInfo]
  )

  // Obtain WalletConnect if necessary, and connect to the wallet.
  const _connectToWallet = useCallback(
    async (wallet: Wallet) => {
      setState(State.Connecting)
      setError(undefined)
      setConnectingWallet(wallet)
      setPickerModalOpen(false)

      let walletClient: WalletClient | undefined
      let _walletConnect = walletConnect

      // The actual meat of enabling and getting the wallet clients.
      const finalizeWalletConnection = async (newWcSession?: boolean) => {
        // Cleared in `cleanupAfterConnection`.
        setWalletEnableModalOpen(true)

        walletClient = await wallet.getClient(
          _getConnectionChainInfo(),
          _walletConnect
        )
        if (!walletClient) {
          throw new Error("Failed to retrieve wallet client.")
        }

        // Prevent double app open request.
        if (walletClient instanceof KeplrWalletConnectV1) {
          walletClient.dontOpenAppOnEnable = !!newWcSession
        }

        // Save connected wallet data.
        setConnectedWallet(await _getConnectedWalletData(wallet, walletClient))

        // Save localStorage value.
        if (localStorageKey) {
          localStorage.setItem(localStorageKey, wallet.type)
        }

        setState(State.Connected)
      }

      try {
        // Connect to WalletConnect if necessary.
        if (wallet.type === WalletType.WalletConnectKeplr) {
          // Instantiate new WalletConnect instance if necessary.
          if (!_walletConnect) {
            _walletConnect = new WalletConnect({
              bridge: "https://bridge.walletconnect.org",
              signingMethods: [
                "keplr_enable_wallet_connect_v1",
                "keplr_sign_amino_wallet_connect_v1",
              ],
              qrcodeModal: {
                open: (uri: string, cb: () => void) => {
                  // Open QR modal by setting URI.
                  setWalletConnectUri(uri)
                  onQrCloseCallback.current = cb
                },
                // Occurs on disconnect, which is handled elsewhere.
                close: () => console.log("qrcodeModal.close"),
              },
              // clientMeta,
            })
            // clientMeta in constructor is ignored for some reason, so
            // let's set it directly :)))))))))))))
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            _walletConnect._clientMeta = walletConnectClientMeta
            setWalletConnect(_walletConnect)
          }

          if (_walletConnect.connected) {
            // WalletConnect already connected, nothing to do.
            await finalizeWalletConnection()
          } else {
            // Prevent double requests by checking which connection attempt
            // we're on before and after starting the connection attempt.
            const currConnectionAttempt = ++connectionAttemptRef.current

            // Executes walletConnect's qrcodeModal.open.
            await _walletConnect.connect()

            // If another connection attempt is being made, don't try to
            // enable if connect finishes. This prevents double requests.
            if (connectionAttemptRef.current !== currConnectionAttempt) {
              return
            }

            // Connect with new WalletConnect session.
            await finalizeWalletConnection(true)
          }
        } else {
          // No WalletConnect needed.
          await finalizeWalletConnection()
        }
      } catch (err) {
        console.error(err)
        setError(err)
        setState(State.Errored)
      } finally {
        _cleanupAfterConnection(walletClient)
      }
    },
    [
      walletConnect,
      _getConnectionChainInfo,
      _getConnectedWalletData,
      localStorageKey,
      walletConnectClientMeta,
      _cleanupAfterConnection,
    ]
  )

  // Begin connection process, either auto-selecting a wallet or opening
  // the selection modal.
  const beginConnection = useCallback(() => {
    // We need to check if we are in the embedded Keplr Mobile web before
    // connecting, since we will force the embedded Keplr wallet if
    // possible. This will only happen if `connect` is called very quickly
    // without waiting for `state` to reach at least
    // `State.AttemptingAutoConnection`, though ideally `connect` is only
    // called once `state` reaches `State.ReadyForConnection`.
    // TODO: Add some docs about this.
    if (state === State.Initializing) {
      throw new Error("Cannot connect while initializing.")
    }

    setState(State.Connecting)
    setError(undefined)

    const automaticWalletType =
      preselectedWalletType ||
      // Try to fetch value from localStorage.
      (localStorageKey && localStorage.getItem(localStorageKey)) ||
      undefined

    const skipModalWallet =
      // Mobile web mode takes precedence over automatic wallet.
      isEmbeddedKeplrMobileWeb
        ? keplrWallet
        : // If only one wallet is available, skip the modal and use it.
        enabledWallets.length === 1
        ? enabledWallets[0]
        : // Try to find the wallet to automatically connect to if present.
        automaticWalletType
        ? enabledWallets.find(({ type }) => type === automaticWalletType)
        : undefined

    if (skipModalWallet) {
      _connectToWallet(skipModalWallet)
      return
    }

    // If no default wallet, open modal to choose one.
    setPickerModalOpen(true)
  }, [
    state,
    preselectedWalletType,
    localStorageKey,
    isEmbeddedKeplrMobileWeb,
    enabledWallets,
    _connectToWallet,
  ])

  // Initiate reset.
  const _reset = useCallback(async () => {
    await disconnect().catch(console.error)
    // Set after disconnect, since disconnect sets state to
    // ReadyForConnection.
    setState(State.Resetting)
    // Try resetting all wallet state and reconnecting.
    if (connectingWallet) {
      setConnectToWalletUponReset(connectingWallet)
      _cleanupAfterConnection()
    } else {
      // If no wallet to reconnect to, just reload.
      window.location.reload()
    }
  }, [_cleanupAfterConnection, connectingWallet, disconnect])

  //! EFFECTS

  // Detect if in embedded Keplr Mobile browser, and set ready after.
  useEffect(() => {
    if (state !== State.Initializing) return

    getKeplrFromWindow()
      .then(
        (keplr) =>
          keplr &&
          keplr.mode === "mobile-web" &&
          setIsEmbeddedKeplrMobileWeb(true)
      )
      .finally(() => setState(State.AttemptingAutoConnection))
  }, [state])

  // Auto connect on mount handler, after the above mobile web check.
  useEffect(() => {
    if (state !== State.AttemptingAutoConnection) return
    setState(State.ReadyForConnection)

    if (
      // If inside Keplr mobile web, auto connect.
      isEmbeddedKeplrMobileWeb ||
      // If localStorage value present, auto connect.
      (localStorageKey && !!localStorage.getItem(localStorageKey))
    ) {
      beginConnection()
    }
  }, [state, beginConnection, isEmbeddedKeplrMobileWeb, localStorageKey])

  // Execute onQrCloseCallback if WalletConnect URI is cleared, since it
  // has now been closed.
  useEffect(() => {
    if (!walletConnectUri && onQrCloseCallback) {
      onQrCloseCallback.current?.()
      onQrCloseCallback.current = undefined
    }
  }, [walletConnectUri, onQrCloseCallback])

  // Attempt reconnecting to a wallet after resetting if we have set a
  // wallet to select after resetting.
  useEffect(() => {
    if (
      state === State.Resetting &&
      !connectingWallet &&
      connectToWalletUponReset
    ) {
      setConnectToWalletUponReset(undefined)
      // Updates state to Connecting.
      _connectToWallet(connectToWalletUponReset)
    }
  }, [connectingWallet, state, _connectToWallet, connectToWalletUponReset])

  // WalletConnect disconnect listener.
  useEffect(() => {
    if (!walletConnect) return

    // Detect disconnected WC session and clear wallet state.
    walletConnect.on("disconnect", () => {
      console.log("WalletConnect disconnected.")
      disconnect(true)
      _cleanupAfterConnection()
    })
  }, [_cleanupAfterConnection, disconnect, walletConnect])

  // keplr_keystorechange event listener.
  useEffect(() => {
    if (!onKeplrKeystoreChangeEvent) {
      return
    }

    // Add event listener.
    window.addEventListener("keplr_keystorechange", onKeplrKeystoreChangeEvent)

    // Remove event listener on clean up.
    return () => {
      window.removeEventListener(
        "keplr_keystorechange",
        onKeplrKeystoreChangeEvent
      )
    }
  }, [onKeplrKeystoreChangeEvent])

  return (
    <WalletManagerContext.Provider
      value={{
        connect: beginConnection,
        disconnect,
        connectedWallet,
        state,
        error,
        isEmbeddedKeplrMobileWeb,
      }}
    >
      {children}

      <SelectWalletModal
        classNames={classNames}
        closeIcon={closeIcon}
        isOpen={state !== State.Resetting && pickerModalOpen}
        onClose={() => setPickerModalOpen(false)}
        selectWallet={_connectToWallet}
        wallets={Wallets}
      />
      <WalletConnectModal
        classNames={classNames}
        closeIcon={closeIcon}
        isOpen={state !== State.Resetting && !!walletConnectUri}
        onClose={() => disconnect().finally(_cleanupAfterConnection)}
        reset={_reset}
        uri={walletConnectUri}
      />
      <EnablingWalletModal
        classNames={classNames}
        closeIcon={closeIcon}
        isOpen={state !== State.Resetting && walletEnableModalOpen}
        onClose={() => setWalletEnableModalOpen(false)}
        renderLoader={renderLoader}
        reset={_reset}
      />
      <BaseModal
        classNames={classNames}
        isOpen={state === State.Resetting}
        maxWidth="24rem"
        title="Resetting..."
      >
        {renderLoader?.()}
      </BaseModal>
    </WalletManagerContext.Provider>
  )
}
