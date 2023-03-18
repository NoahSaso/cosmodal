import { Wallet, WalletType } from "../types"

// TODO: Move imageUrl, and maybe name/description, to user configuration somehow, or incorporate in planned configurable UI overhaul.

export const LeapWallet: Wallet = {
  type: WalletType.Leap,
  name: "Leap Wallet",
  description: "Leap Cosmos Extension",
  imageUrl:
    "https://raw.githubusercontent.com/leapwallet/assets/2289486990e1eaf9395270fffd1c41ba344ef602/images/leap-cosmos-logo.png",
  getClient: async () => window.leap,
  getOfflineSignerFunction: (client) =>
    // This function expects to be bound to the `client` instance.
    client.getOfflineSignerAuto.bind(client),
  windowKeystoreRefreshEvent: "leap_keystorechange",
}

export const KeplrWallet: Wallet = {
  type: WalletType.Keplr,
  name: "Keplr Wallet",
  description: "Keplr Chrome Extension",
  imageUrl: "/keplr-wallet-extension.png",
  getClient: async () =>
    (await import("@keplr-wallet/stores")).getKeplrFromWindow(),
  getOfflineSignerFunction: (client) =>
    // This function expects to be bound to the `client` instance.
    client.getOfflineSignerAuto.bind(client),
  windowKeystoreRefreshEvent: "keplr_keystorechange",
}

export const WalletConnectKeplrWallet: Wallet = {
  type: WalletType.WalletConnectKeplr,
  name: "WalletConnect",
  description: "Keplr Mobile",
  imageUrl: "/walletconnect-keplr.png",
  getClient: async (chainInfo, walletConnect) => {
    if (walletConnect?.connected) {
      return new (await import("../connectors")).KeplrWalletConnectV1(
        walletConnect,
        [chainInfo]
      )
    }
    throw new Error("Mobile wallet not connected.")
  },
  // WalletConnect only supports Amino signing.
  getOfflineSignerFunction: (client) =>
    // This function expects to be bound to the `client` instance.
    client.getOfflineSignerOnlyAmino.bind(client),
  windowKeystoreRefreshEvent: "keplr_keystorechange",
}

export const Wallets: Wallet[] = [KeplrWallet, WalletConnectKeplrWallet]
