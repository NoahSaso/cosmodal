import "../styles/globals.css"

import { Bech32Address } from "@keplr-wallet/cosmos"
import { ChainInfo } from "@keplr-wallet/types"
import {
  WalletManagerProvider,
  WalletType,
} from "@noahsaso/cosmodal"
import type { AppProps } from "next/app"
import { FunctionComponent } from "react"
import { GasPrice } from "@cosmjs/stargate"

const LOCAL_STORAGE_KEY = "connectedWalletId"

const MyApp: FunctionComponent<AppProps> = ({ Component, pageProps }) => (
  <WalletManagerProvider
    walletConnectClientMeta={{
      name: "CosmodalExampleDApp",
      description: "A dApp using the @noahsaso/cosmodal library.",
      url: "https://noahsaso-cosmodal.vercel.app",
      icons: ["https://moonphase.is/image.svg"],
    }}
    enabledWalletTypes={[WalletType.Keplr, WalletType.WalletConnectKeplr]}
    renderLoader={() => <p>Loading...</p>}
    localStorageKey={LOCAL_STORAGE_KEY}
    chainInfoList={[JUNO_TESTNET_CHAIN_INFO]}
    defaultChainId={JUNO_TESTNET_CHAIN_INFO.chainId}
    getSigningCosmWasmClientOptions={(chainInfo) => ({
      gasPrice: GasPrice.fromString("0.0025" + chainInfo.feeCurrencies[0].coinMinimalDenom),
    })}
    getSigningStargateClientOptions={(chainInfo) => ({
      gasPrice: GasPrice.fromString("0.0025" + chainInfo.feeCurrencies[0].coinMinimalDenom),
    })}
  >
    <Component {...pageProps} />
  </WalletManagerProvider>
)

export default MyApp

const GAS_PRICE: string = "0.0025ujunox"
const JUNO_TESTNET_CHAIN_INFO: ChainInfo = {
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
