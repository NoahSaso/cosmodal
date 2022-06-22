import { createContext, useContext } from "react"

import { WalletManagerContextInterface } from "../types"

export const WalletManagerContext =
  createContext<WalletManagerContextInterface | null>(null)

export const useWalletManager = () => {
  const context = useContext(WalletManagerContext)
  if (!context) {
    throw new Error("You forgot to use WalletManagerProvider")
  }

  return context
}

export const useWallet = () => {
  const { state, error, connectedWallet } = useWalletManager()

  return { ...connectedWallet, state, error }
}
