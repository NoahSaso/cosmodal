import { ChainInfo } from "@keplr-wallet/types"

export const getChainInfo = (
  chainInfoList: ChainInfo[],
  chainId: ChainInfo["chainId"]
) => {
  const chainInfo = chainInfoList.find((info) => info.chainId === chainId)
  if (!chainInfo) {
    throw new Error(
      `Chain ID "${chainId}" does not exist among provided ChainInfo objects. Available Chain IDs: ${chainInfoList
        .map(({ chainId }) => chainId)
        .join(",")}`
    )
  }
  return chainInfo
}
