import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate"
import { GasPrice } from "@cosmjs/stargate"
import { Bech32Address } from "@keplr-wallet/cosmos"
import { getKeplrFromWindow } from "@keplr-wallet/stores"
import { ChainInfo } from "@keplr-wallet/types"
import {
  KeplrWalletConnectV1,
  Wallet,
  WalletManagerProvider,
} from "@noahsaso/cosmodal"
import WalletConnect from "@walletconnect/client"
import type { AppProps } from "next/app"
import { FunctionComponent } from "react"

const MyApp: FunctionComponent<AppProps> = ({ Component, pageProps }) => (
  <WalletManagerProvider
    walletConnectClientMeta={{
      name: "CosmodalExampleDApp",
      description: "A dApp using the @noahsaso/cosmodal library.",
      url: "https://noahsaso-cosmodal.vercel.app",
      icons: ["https://moonphase.is/image.svg"],
    }}
    wallets={AvailableWallets}
  >
    <Component {...pageProps} />
  </WalletManagerProvider>
)

export default MyApp

const CHAIN_ID: string = "uni-3"
const GAS_PRICE: string = "0.0025ujunox"
const CHAIN_RPC_NODE: string = "https://rpc.uni.juno.deuslabs.fi"
const CHAIN_INFO: ChainInfo = {
  rpc: "https://rpc.uni.juno.deuslabs.fi",
  rest: "https://lcd.uni.juno.deuslabs.fi",
  chainId: "uni-3",
  chainName: "Juno Testnet",
  stakeCurrency: {
    coinDenom: "junox",
    coinMinimalDenom: "ujunox",
    coinDecimals: 6,
  },
  bip44: {
    coinType: 118,
  },
  bech32Config: Bech32Address.defaultBech32Config("juno"),
  currencies: [
    {
      coinDenom: "junox",
      coinMinimalDenom: "ujunox",
      coinDecimals: 6,
    },
  ],
  feeCurrencies: [
    {
      coinDenom: "junox",
      coinMinimalDenom: "ujunox",
      coinDecimals: 6,
    },
  ],
  coinType: 118,
  features: ["ibc-transfer", "ibc-go"],
  // If this field is not provided, Keplr extension will set the default gas price as (low: 0.01, average: 0.025, high: 0.04).
  gasPriceStep: {
    low: 0.03,
    average: 0.04,
    high: 0.05,
  },
}

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
    getName: async (client) => {
      const info = await client.getKey(CHAIN_ID)
      return info?.name
    },
    getOfflineSigner: async (client) => {
      await client.enable(CHAIN_ID)
      return await client.getOfflineSignerAuto(CHAIN_ID)
    },
    getSigningClient: async (_, signer) => {
      if (!signer) return

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
    getName: async (client) => {
      const info = await client.getKey(CHAIN_ID)
      return info?.name
    },
    getOfflineSigner: async (client) => {
      await client.experimentalSuggestChain(CHAIN_INFO)
      await client.enable(CHAIN_ID)
      return await client.getOfflineSignerAuto(CHAIN_ID)
    },
    getSigningClient: async (_, signer) => {
      if (!signer) return

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
    ? ([
        {
          id: "walletconnect-keplr",
          name: "WalletConnect",
          description: "Keplr Mobile",
          imageUrl: "/walletconnect-keplr.png",
          isWalletConnect: true,
          isMobileWeb: false,
          getClient: async (walletConnect) => {
            if (walletConnect?.connected)
              return new KeplrWalletConnectV1(walletConnect, [CHAIN_INFO])
            throw new Error("Mobile wallet not connected.")
          },
          getName: async (client) => {
            const info = await client.getKey(CHAIN_ID)
            return info?.name
          },
          getOfflineSigner: async (client) => {
            // WalletConnect does not support suggesting chain.
            await client.enable(CHAIN_ID)
            // WalletConnect only supports Amino signing.
            return await client.getOfflineSignerOnlyAmino(CHAIN_ID)
          },
          getSigningClient: async (_, signer) => {
            if (!signer) return

            return await SigningCosmWasmClient.connectWithSigner(
              CHAIN_RPC_NODE,
              signer,
              { gasPrice: GasPrice.fromString(GAS_PRICE) }
            )
          },
        },
      ] as Wallet[])
    : []),
]
