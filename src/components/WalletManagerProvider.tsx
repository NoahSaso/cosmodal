import WalletConnect from "@walletconnect/client"
import { IClientMeta } from "@walletconnect/types"
import React, {
  FunctionComponent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { KeplrWalletConnectV1 } from "../connectors"
import {
  ConnectedWallet,
  ModalClassNames,
  Wallet,
  WalletClient,
} from "../types"
import {
  BaseModal,
  EnablingWalletModal,
  SelectWalletModal,
  WalletConnectModal,
} from "./ui"
import { WalletManagerContext } from "./WalletManagerContext"

enum InitState {
  NeedMobileWeb,
  NeedAutoConnect,
  Ready,
}

// Causes SSR issues if importing this package directly... idk why
const getKeplrFromWindow = async () =>
  (await import("@keplr-wallet/stores")).getKeplrFromWindow()

export interface WalletManagerProviderProps {
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

export const WalletManagerProvider: FunctionComponent<
  WalletManagerProviderProps
> = ({
  children,
  wallets,
  classNames,
  closeIcon,
  renderLoader,
  walletConnectClientMeta,
  attemptAutoConnect,
  preselectedWalletId,
  localStorageKey,
  useLocalStorageForAutoConnect,
  saveToLocalStorageOnConnect,
  clearLocalStorageOnDisconnect,
  onKeplrKeystoreChangeEvent,
}) => {
  const [pickerModalOpen, setPickerModalOpen] = useState(false)
  // If set, opens QR code modal.
  const [walletConnectUri, setWalletConnectUri] = useState<string>()
  const [walletEnableModalOpen, setWalletEnableModalOpen] = useState(false)
  // Call when closing QR code modal manually.
  const onQrCloseCallback = useRef<() => void>()
  useEffect(() => {
    if (!walletConnectUri && onQrCloseCallback) {
      onQrCloseCallback.current?.()
      onQrCloseCallback.current = undefined
    }
  }, [walletConnectUri, onQrCloseCallback])

  // Wallet connection state.
  const [connectedWallet, setConnectedWallet] = useState<ConnectedWallet>()
  const [connectionError, setConnectionError] = useState<unknown>()
  const [walletConnect, setWalletConnect] = useState<WalletConnect>()
  // Once mobile web is checked, we are ready to auto-connect.
  const [initState, setInitState] = useState<InitState>(InitState.NeedMobileWeb)
  // In case WalletConnect fails to load, we need to be able to retry.
  // This is done through clicking reset on the WalletConnectModal.
  const [connectingWallet, setConnectingWallet] = useState<Wallet>()
  const connectionAttemptRef = useRef(0)

  // Detect if is inside Keplr mobile web, and set ready once checked.
  const [isMobileWeb, setIsMobileWeb] = useState(false)
  useEffect(() => {
    if (initState !== InitState.NeedMobileWeb) return

    getKeplrFromWindow()
      .then(
        (keplr) => keplr && keplr.mode === "mobile-web" && setIsMobileWeb(true)
      )
      .finally(() => setInitState(InitState.NeedAutoConnect))
  }, [initState])

  const cleanupAfterConnection = useCallback((walletClient?: WalletClient) => {
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

  const clearConnectedWallet = useCallback(() => {
    // Remove localStorage value.
    if (localStorageKey && clearLocalStorageOnDisconnect) {
      localStorage.removeItem(localStorageKey)
    }
    setConnectedWallet(undefined)
  }, [localStorageKey, clearLocalStorageOnDisconnect, setConnectedWallet])

  // Wallet connect disconnect listeners.
  useEffect(() => {
    if (!walletConnect) return

    // Detect disconnected WC session and clear wallet state.
    walletConnect.on("disconnect", () => {
      console.log("WalletConnect disconnected.")
      clearConnectedWallet()
      cleanupAfterConnection()
      setWalletConnect(undefined)
    })
  }, [cleanupAfterConnection, clearConnectedWallet, walletConnect])

  const disconnect = useCallback(async () => {
    clearConnectedWallet()
    if (walletConnect?.connected) {
      await walletConnect.killSession()
    }
    setWalletConnect(undefined)
  }, [clearConnectedWallet, walletConnect])

  const handleConnectionError = useCallback((error: unknown) => {
    console.error(error)
    setConnectionError(error)
  }, [])

  const enableAndSaveWallet = useCallback(
    async (
      wallet: Wallet,
      walletConnect?: WalletConnect,
      newWcSession?: boolean
    ) => {
      let walletClient
      try {
        walletClient = await wallet.getClient(walletConnect)
        if (walletClient) {
          setWalletEnableModalOpen(true)
          // Prevent double app open request.
          if (walletClient instanceof KeplrWalletConnectV1) {
            walletClient.dontOpenAppOnEnable = !!newWcSession
          }

          const offlineSigner = await wallet.getOfflineSigner?.(walletClient)
          const name = await wallet.getName?.(walletClient, offlineSigner)
          const address = (await offlineSigner?.getAccounts())?.[0]?.address
          const signingClient = await wallet.getSigningClient?.(
            walletClient,
            offlineSigner
          )

          // If successfully retrieves signing client, save.
          setConnectedWallet({
            wallet,
            walletClient,
            name,
            address,
            offlineSigner,
            signingClient,
          })

          // Save localStorage value.
          if (localStorageKey && saveToLocalStorageOnConnect) {
            localStorage.setItem(localStorageKey, wallet.id)
          }
        }
      } catch (err) {
        handleConnectionError(err)
      } finally {
        cleanupAfterConnection(walletClient)
      }
    },
    [
      cleanupAfterConnection,
      handleConnectionError,
      localStorageKey,
      saveToLocalStorageOnConnect,
    ]
  )

  const selectWallet = useCallback(
    async (wallet: Wallet) => {
      try {
        setConnectingWallet(wallet)
        setPickerModalOpen(false)
        await wallet.onSelect?.()

        if (wallet.isWalletConnect) {
          // Connect to WalletConnect.
          let _walletConnect = walletConnect
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
            await enableAndSaveWallet(wallet, _walletConnect)
          } else {
            // Executes walletConnect's qrcodeModal.open.
            const currConnectionAttempt = ++connectionAttemptRef.current
            await _walletConnect.connect()

            // If another connection attempt is being made, don't try to
            // enable if connect finishes. This prevents double requests.
            if (connectionAttemptRef.current === currConnectionAttempt) {
              await enableAndSaveWallet(wallet, _walletConnect, true)
            }
          }
        } else {
          // No WalletConnect needed.
          await enableAndSaveWallet(wallet)
        }
      } catch (err) {
        handleConnectionError(err)
      } finally {
        cleanupAfterConnection()
      }
    },
    [
      walletConnectClientMeta,
      enableAndSaveWallet,
      handleConnectionError,
      cleanupAfterConnection,
      walletConnect,
    ]
  )

  const connect = useCallback(() => {
    setConnectionError(undefined)

    const automaticWalletId =
      preselectedWalletId ||
      // If no `preselectedWalletId`, try to fetch value from localStorage.
      (localStorageKey &&
        useLocalStorageForAutoConnect &&
        localStorage.getItem(localStorageKey)) ||
      undefined

    const skipModalWallet =
      // Mobile web mode takes precedence over automatic wallet.
      (isMobileWeb && wallets.find(({ isMobileWeb }) => isMobileWeb)) ||
      // If only one wallet is available, skip the modal and use it.
      wallets.length === 1
        ? wallets[0]
        : // Try to find the wallet to automatically connect to if present.
        automaticWalletId
        ? wallets.find(({ id }) => id === automaticWalletId)
        : undefined
    if (skipModalWallet) {
      selectWallet(skipModalWallet)
      return
    }

    // If no default wallet, open modal to choose one.
    setPickerModalOpen(true)
  }, [
    preselectedWalletId,
    localStorageKey,
    useLocalStorageForAutoConnect,
    isMobileWeb,
    wallets,
    selectWallet,
  ])

  // Reset connection when it gets stuck somewhere.
  const [resetting, setResetting] = useState(false)
  const [selectWalletUponReset, setSelectWalletUponReset] = useState<Wallet>()
  // Reset once no longer connecting to a wallet but we have set a
  // wallet to select.
  useEffect(() => {
    if (resetting && !connectingWallet && selectWalletUponReset) {
      setResetting(false)
      setSelectWalletUponReset(undefined)
      setConnectionError(undefined)
      selectWallet(selectWalletUponReset)
    }
  }, [connectingWallet, resetting, selectWallet, selectWalletUponReset])
  // Initiate reset.
  const reset = useCallback(async () => {
    setResetting(true)
    await disconnect().catch(console.error)
    // Try resetting all wallet state and reconnecting.
    if (connectingWallet) {
      setSelectWalletUponReset(connectingWallet)
      cleanupAfterConnection()
    } else {
      // If no wallet to reconnect to, just reload.
      window.location.reload()
    }
  }, [cleanupAfterConnection, connectingWallet, disconnect, setResetting])

  // Attempt auto-connect if set or if in mobile web.
  useEffect(() => {
    if (initState !== InitState.NeedAutoConnect) return
    setInitState(InitState.Ready)

    if (attemptAutoConnect || isMobileWeb) connect()
  }, [attemptAutoConnect, initState, connect, isMobileWeb])

  // Listen for keplr_keystorechange event.
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
        connect,
        disconnect,
        connectedWallet,
        connectionError,
        isMobileWeb,
      }}
    >
      {children}

      <SelectWalletModal
        classNames={classNames}
        closeIcon={closeIcon}
        isOpen={!resetting && pickerModalOpen}
        onClose={() => setPickerModalOpen(false)}
        selectWallet={selectWallet}
        // Mobile web wallet will be auto chosen when in mobile web. It
        // cannot be selected.
        wallets={wallets.filter(({ isMobileWeb }) => !isMobileWeb)}
      />
      <WalletConnectModal
        classNames={classNames}
        closeIcon={closeIcon}
        isOpen={!resetting && !!walletConnectUri}
        onClose={() => disconnect().finally(cleanupAfterConnection)}
        reset={reset}
        uri={walletConnectUri}
      />
      <EnablingWalletModal
        classNames={classNames}
        closeIcon={closeIcon}
        isOpen={!resetting && walletEnableModalOpen}
        onClose={() => setWalletEnableModalOpen(false)}
        renderLoader={renderLoader}
        reset={reset}
      />
      <BaseModal
        classNames={classNames}
        isOpen={resetting}
        maxWidth="24rem"
        title="Resetting..."
      >
        {renderLoader?.()}
      </BaseModal>
    </WalletManagerContext.Provider>
  )
}
