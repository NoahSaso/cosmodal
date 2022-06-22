import { ChainInfo } from "@keplr-wallet/types"
import { createContext, useContext, useEffect, useState } from "react"

import {
  ConnectedWallet,
  IWalletManagerContext,
  Status,
  UseWalletResponse,
} from "../types"
import { getChainInfo, getConnectedWalletInfo, Wallets } from "../utils"

export const WalletManagerContext = createContext<IWalletManagerContext | null>(
  null
)

export const useWalletManager = () => {
  const context = useContext(WalletManagerContext)
  if (!context) {
    throw new Error("You forgot to use WalletManagerProvider")
  }

  return context
}

export const useWallet = (
  chainId?: ChainInfo["chainId"]
): UseWalletResponse => {
  const {
    status: _status,
    error: _error,
    connectedWallet: _connectedWallet,
    chainInfoList,
    getSigningCosmWasmClientOptions,
    getSigningStargateClientOptions,
  } = useWalletManager()

  const [chainIdStatus, setChainIdStatus] = useState<Status>(
    Status.Initializing
  )
  const [chainIdError, setChainIdError] = useState<unknown>()
  const [chainIdConnectedWallet, setChainIdConnectedWallet] =
    useState<ConnectedWallet>()
  useEffect(() => {
    if (_status !== Status.Connected || !_connectedWallet || !chainId) {
      // If the initial wallet client is not yet connected, this chainId
      // cannot be connected to yet and is thus still initializing.
      setChainIdStatus(Status.Initializing)
      setChainIdConnectedWallet(undefined)
      setChainIdError(undefined)
      return
    }

    const connect = async () => {
      setChainIdStatus(Status.Connecting)
      setChainIdError(undefined)

      const chainInfo = getChainInfo(chainInfoList, chainId)

      const wallet = Wallets.find(
        ({ type }) => _connectedWallet.walletType === type
      )
      // Smoke test, should never happen.
      if (!wallet) {
        throw new Error(`Internal error: could not find wallet.`)
      }

      setChainIdConnectedWallet(
        // TODO: Cache
        await getConnectedWalletInfo(
          wallet,
          _connectedWallet.walletClient,
          chainInfo,
          await getSigningCosmWasmClientOptions?.(chainInfo),
          await getSigningStargateClientOptions?.(chainInfo)
        )
      )
      setChainIdStatus(Status.Connected)
    }

    connect().catch((error) => {
      console.error(error)
      setChainIdError(error)
      setChainIdStatus(Status.Errored)
    })
  }, [
    _status,
    _connectedWallet,
    chainId,
    chainInfoList,
    getSigningCosmWasmClientOptions,
    getSigningStargateClientOptions,
  ])

  const status = chainId ? chainIdStatus : _status
  const error = chainId ? chainIdError : _error
  const connectedWallet = chainId ? chainIdConnectedWallet : _connectedWallet

  return { status, error, ...connectedWallet }
}
