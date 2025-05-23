import {
  AminoSignResponse,
  BroadcastMode,
  OfflineSigner,
  StdSignature,
  StdSignDoc,
  StdTx,
} from "@cosmjs/launchpad"
import { DirectSignResponse, OfflineDirectSigner } from "@cosmjs/proto-signing"
import { IndexedDBKVStore, KVStore } from "@keplr-wallet/common"
import {
  CosmJSOfflineSigner,
  CosmJSOfflineSignerOnlyAmino,
} from "@keplr-wallet/provider"
import {
  ChainInfo,
  ChainInfoWithoutEndpoints,
  ICNSAdr36Signatures,
  KeplrIntereactionOptions,
  KeplrMode,
  KeplrSignOptions,
  Key,
} from "@keplr-wallet/types"
import { isAndroid, isMobile } from "@walletconnect/browser-utils"
import {
  IConnector,
  IJsonRpcRequest,
  IRequestOptions,
} from "@walletconnect/types"
import { payloadId } from "@walletconnect/utils"
import Axios from "axios"
import { Buffer } from "buffer"
import deepmerge from "deepmerge"
import { SecretUtils } from "secretjs/types/enigmautils"

import { WalletClient } from "../../../types"

// VersionFormatRegExp checks if a chainID is in the format required for parsing versions
// The chainID should be in the form: `{identifier}-{version}`
const ChainVersionFormatRegExp = /(.+)-([\d]+)/

function parseChainId(chainId: string): {
  identifier: string
  version: number
} {
  const split = chainId.split(ChainVersionFormatRegExp).filter(Boolean)
  if (split.length !== 2) {
    return {
      identifier: chainId,
      version: 0,
    }
  } else {
    return { identifier: split[0], version: parseInt(split[1]) }
  }
}

export const MANUAL_WALLET_CONNECT_DISCONNECT =
  "MANUAL_WALLET_CONNECT_DISCONNECT"

export type KeplrGetKeyWalletConnectV1Response = {
  address: string
  algo: string
  bech32Address: string
  isNanoLedger: boolean
  name: string
  pubKey: string
  isKeystone: boolean
}

export type KeplrKeystoreMayChangedEventParam = {
  algo: string
  name: string
  isNanoLedger: boolean
  keys: {
    chainIdentifier: string
    address: string
    bech32Address: string
    pubKey: string
    isKeystone: boolean
  }[]
}

export class KeplrWalletConnectV1 implements WalletClient {
  kvStore: KVStore
  onBeforeSendRequest?: (
    request: Partial<IJsonRpcRequest>,
    options?: IRequestOptions
  ) => Promise<void> | void
  onAfterSendRequest?: (
    response: any,
    request: Partial<IJsonRpcRequest>,
    options?: IRequestOptions
  ) => Promise<void> | void
  // When creating a new WalletConnect session, the user will be taken to
  // Keplr Mobile via a deep link. The session is established immediately
  // with no further interaction, and the next step is to enable the chain.
  // Enabling the chain will prompt the user to approve the chain, which
  // occurs in the background once the mobile app is opened. Then it will
  // tell them to go back to the browser, and on returning to the browser,
  // they will see a second deep link prompt, a result of the enable
  // request that occurred in the background previously. When establishing
  // a new WalletConnect session, let's make sure we don't prompt the user
  // to open the app twice.
  dontOpenAppOnEnable = false

  constructor(
    public readonly connector: IConnector,
    public readonly chainInfos: ChainInfo[],
    options: {
      kvStore?: KVStore
      onBeforeSendRequest?: KeplrWalletConnectV1["onBeforeSendRequest"]
      onAfterSendRequest?: KeplrWalletConnectV1["onAfterSendRequest"]
    } = {}
  ) {
    this.kvStore =
      options.kvStore ?? new IndexedDBKVStore("keplr_wallet_connect")
    this.onBeforeSendRequest = options.onBeforeSendRequest
    this.onAfterSendRequest = options.onAfterSendRequest

    connector.on("disconnect", () => {
      this.clearSaved()
    })

    connector.on("call_request", this.onCallReqeust)
  }

  async disconnect(): Promise<void> {
    // Kill WalletConnect session if connected.
    await this.connector
      .killSession({
        message: MANUAL_WALLET_CONNECT_DISCONNECT,
      })
      .catch(console.error)

    // Clear saved data.
    this.clearSaved()

    // Remove session from localStorage since it tries to use the same session
    // as last time on future attempts. When the user manually disconnects, we
    // want to clear this state in case something is wrong with the session or
    // they are trying to change their wallet and it won't detect the change.
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("walletconnect")
    }
  }

  async disable(_chainIds: string[]): Promise<void> {
    throw new Error("Method not implemented.")
  }

  async signICNSAdr36(
    _chainId: string,
    _contractAddress: string,
    _owner: string,
    _username: string,
    _addressChainIds: string[]
  ): Promise<ICNSAdr36Signatures> {
    throw new Error("Method not implemented.")
  }

  async experimentalSignEIP712CosmosTx_v0(
    _chainId: string,
    _signer: string,
    _eip712: {
      types: Record<string, { name: string; type: string }[] | undefined>
      domain: Record<string, any>
      primaryType: string
    },
    _signDoc: StdSignDoc,
    _signOptions?: KeplrSignOptions | undefined
  ): Promise<AminoSignResponse> {
    throw new Error("Method not implemented.")
  }

  async getChainInfosWithoutEndpoints(): Promise<ChainInfoWithoutEndpoints[]> {
    return this.chainInfos
  }

  async changeKeyRingName(_opts: {
    defaultName: string
    editable?: boolean | undefined
  }): Promise<string> {
    throw new Error("Method not implemented.")
  }

  signEthereum(): Promise<Uint8Array> {
    throw new Error("Method not implemented.")
  }

  readonly version: string = "0.9.0"
  readonly mode: KeplrMode = "walletconnect"

  defaultOptions: KeplrIntereactionOptions = {}

  protected readonly onCallReqeust = async (
    error: Error | null,
    payload: any | null
  ) => {
    if (error) {
      console.log(error)
      return
    }

    if (!payload) {
      return
    }

    if (
      payload.method === "keplr_keystore_may_changed_event_wallet_connect_v1"
    ) {
      const param = payload.params[0] as
        | KeplrKeystoreMayChangedEventParam
        | undefined
      if (!param) {
        return
      }

      const lastSeenKeys = await this.getAllLastSeenKey()
      if (!lastSeenKeys) {
        return
      }

      const mayChangedKeyMap: Record<
        string,
        KeplrGetKeyWalletConnectV1Response
      > = {}
      for (const mayChangedKey of param.keys) {
        mayChangedKeyMap[mayChangedKey.chainIdentifier] = {
          address: mayChangedKey.address,
          algo: param.algo,
          bech32Address: mayChangedKey.bech32Address,
          isNanoLedger: param.isNanoLedger,
          name: param.name,
          pubKey: mayChangedKey.pubKey,
          isKeystone: mayChangedKey.isKeystone,
        }
      }

      let hasChanged = false

      for (const chainId of Object.keys(lastSeenKeys)) {
        const savedKey = lastSeenKeys[chainId]
        if (savedKey) {
          const { identifier } = parseChainId(chainId)
          const mayChangedKey = mayChangedKeyMap[identifier]
          if (mayChangedKey) {
            if (
              mayChangedKey.algo !== savedKey.algo ||
              mayChangedKey.name !== savedKey.name ||
              mayChangedKey.isNanoLedger !== savedKey.isNanoLedger ||
              mayChangedKey.address !== savedKey.address ||
              mayChangedKey.bech32Address !== savedKey.bech32Address ||
              mayChangedKey.pubKey !== savedKey.pubKey ||
              mayChangedKey.isKeystone !== savedKey.isKeystone
            ) {
              hasChanged = true

              lastSeenKeys[chainId] = mayChangedKey
            }
          }
        }
      }

      if (hasChanged) {
        await this.saveAllLastSeenKey(lastSeenKeys)
        window.dispatchEvent(new Event("keplr_keystorechange"))
      }
    }
  }

  protected async clearSaved(): Promise<void> {
    await Promise.all([
      this.kvStore.set(this.getKeyHasEnabled(), null),
      this.kvStore.set(this.getKeyLastSeenKey(), null),
    ])
  }

  protected async sendCustomRequest(
    request: Partial<IJsonRpcRequest>,
    options?: IRequestOptions
  ): Promise<any> {
    // If mobile, attempt to open app to approve request.
    if (isMobile()) {
      switch (request.method) {
        case "keplr_enable_wallet_connect_v1": {
          if (this.dontOpenAppOnEnable) break
          // Fall through to open the app.
        }
        // eslint-disable-next-line no-fallthrough
        case "keplr_sign_amino_wallet_connect_v1":
          // Prompt to open the app.
          window.location.href = isAndroid()
            ? "intent://wcV1#Intent;package=com.chainapsis.keplr;scheme=keplrwallet;end;"
            : "keplrwallet://wcV1"
      }
    }

    if (this.onBeforeSendRequest) {
      await this.onBeforeSendRequest(request, options)
    }

    const res = await this.connector.sendCustomRequest(request, options)

    if (this.onAfterSendRequest) {
      await this.onAfterSendRequest(res, request, options)
    }

    return res
  }

  async enable(chainIds: string | string[]): Promise<void> {
    if (typeof chainIds === "string") {
      chainIds = [chainIds]
    }

    const hasEnabledChainIds = await this.getHasEnabledChainIds()
    let allEnabled = true
    for (const chainId of chainIds) {
      if (hasEnabledChainIds.indexOf(chainId) < 0) {
        allEnabled = false
        break
      }
    }

    if (allEnabled) {
      return
    }

    await this.sendCustomRequest({
      id: payloadId(),
      jsonrpc: "2.0",
      method: "keplr_enable_wallet_connect_v1",
      params: chainIds,
    })

    await this.saveHasEnabledChainIds(chainIds)
  }

  protected getKeyHasEnabled() {
    return `${this.connector.session.key}-enabled`
  }

  protected async getHasEnabledChainIds(): Promise<string[]> {
    return (await this.kvStore.get<string[]>(this.getKeyHasEnabled())) ?? []
  }

  protected async saveHasEnabledChainIds(chainIds: string[]) {
    const hasEnabledChainIds = await this.getHasEnabledChainIds()
    for (const chainId of chainIds) {
      if (hasEnabledChainIds.indexOf(chainId) < 0) {
        hasEnabledChainIds.push(chainId)
      }
    }
    await this.kvStore.set(this.getKeyHasEnabled(), hasEnabledChainIds)
  }

  enigmaDecrypt(
    _chainId: string,
    _ciphertext: Uint8Array,
    _nonce: Uint8Array
  ): Promise<Uint8Array> {
    throw new Error("Not yet implemented")
  }

  enigmaEncrypt(
    _chainId: string,
    _contractCodeHash: string,
    // eslint-disable-next-line @typescript-eslint/ban-types
    _msg: object
  ): Promise<Uint8Array> {
    throw new Error("Not yet implemented")
  }

  async experimentalSuggestChain(_chainInfo: ChainInfo): Promise<void> {
    // Do nothing.
  }

  getEnigmaPubKey(_chainId: string): Promise<Uint8Array> {
    throw new Error("Not yet implemented")
  }

  getEnigmaTxEncryptionKey(
    _chainId: string,
    _nonce: Uint8Array
  ): Promise<Uint8Array> {
    throw new Error("Not yet implemented")
  }

  getEnigmaUtils(_chainId: string): SecretUtils {
    throw new Error("Not yet implemented")
  }

  async getKey(chainId: string): Promise<Key> {
    const lastSeenKey = await this.getLastSeenKey(chainId)
    if (lastSeenKey) {
      return {
        address: Buffer.from(lastSeenKey.address, "hex"),
        algo: lastSeenKey.algo,
        bech32Address: lastSeenKey.bech32Address,
        isNanoLedger: lastSeenKey.isNanoLedger,
        name: lastSeenKey.name,
        pubKey: Buffer.from(lastSeenKey.pubKey, "hex"),
        isKeystone: lastSeenKey.isKeystone,
      }
    }

    const response = (
      await this.sendCustomRequest({
        id: payloadId(),
        jsonrpc: "2.0",
        method: "keplr_get_key_wallet_connect_v1",
        params: [chainId],
      })
    )[0] as KeplrGetKeyWalletConnectV1Response

    await this.saveLastSeenKey(chainId, response)

    return {
      address: Buffer.from(response.address, "hex"),
      algo: response.algo,
      bech32Address: response.bech32Address,
      isNanoLedger: response.isNanoLedger,
      name: response.name,
      pubKey: Buffer.from(response.pubKey, "hex"),
      isKeystone: response.isKeystone,
    }
  }

  protected getKeyLastSeenKey() {
    return `${this.connector.session.key}-key`
  }

  protected async getLastSeenKey(
    chainId: string
  ): Promise<KeplrGetKeyWalletConnectV1Response | undefined> {
    const saved = await this.getAllLastSeenKey()
    return saved ? saved[chainId] : undefined
  }

  protected async getAllLastSeenKey() {
    return await this.kvStore.get<{
      [chainId: string]: KeplrGetKeyWalletConnectV1Response | undefined
    }>(this.getKeyLastSeenKey())
  }

  protected async saveAllLastSeenKey(data: {
    [chainId: string]: KeplrGetKeyWalletConnectV1Response | undefined
  }) {
    await this.kvStore.set(this.getKeyLastSeenKey(), data)
  }

  protected async saveLastSeenKey(
    chainId: string,
    response: KeplrGetKeyWalletConnectV1Response
  ) {
    const saved = (await this.getAllLastSeenKey()) ?? {}
    saved[chainId] = response
    await this.saveAllLastSeenKey(saved)
  }

  signArbitrary(
    _chainId: string,
    _signer: string,
    _data: string | Uint8Array
  ): Promise<StdSignature> {
    throw new Error("Not yet implemented")
  }

  verifyArbitrary(
    _chainId: string,
    _signer: string,
    _data: string | Uint8Array,
    _signature: StdSignature
  ): Promise<boolean> {
    throw new Error("Not yet implemented")
  }

  getOfflineSigner(chainId: string): OfflineSigner & OfflineDirectSigner {
    return new CosmJSOfflineSigner(chainId, this)
  }

  async getOfflineSignerAuto(
    chainId: string
  ): Promise<OfflineSigner | OfflineDirectSigner> {
    const key = await this.getKey(chainId)
    return key.isNanoLedger
      ? new CosmJSOfflineSignerOnlyAmino(chainId, this)
      : new CosmJSOfflineSigner(chainId, this)
  }

  getOfflineSignerOnlyAmino(chainId: string): OfflineSigner {
    return new CosmJSOfflineSignerOnlyAmino(chainId, this)
  }

  getSecret20ViewingKey(
    _chainId: string,
    _contractAddress: string
  ): Promise<string> {
    throw new Error("Not yet implemented")
  }

  async sendTx(
    chainId: string,
    tx: StdTx | Uint8Array,
    mode: BroadcastMode
  ): Promise<Uint8Array> {
    const chainInfo = this.chainInfos.find(
      (chainInfo) => chainInfo.chainId === chainId
    )
    if (!chainInfo) throw new Error("No chain info found.")

    const restInstance = Axios.create({
      baseURL: chainInfo.rest,
    })

    const isProtoTx = Buffer.isBuffer(tx) || tx instanceof Uint8Array

    const params = isProtoTx
      ? {
          tx_bytes: Buffer.from(tx as any).toString("base64"),
          mode: (() => {
            switch (mode) {
              case "async":
                return "BROADCAST_MODE_ASYNC"
              case "block":
                return "BROADCAST_MODE_BLOCK"
              case "sync":
                return "BROADCAST_MODE_SYNC"
              default:
                return "BROADCAST_MODE_UNSPECIFIED"
            }
          })(),
        }
      : {
          tx,
          mode: mode,
        }

    const result = await restInstance.post(
      isProtoTx ? "/cosmos/tx/v1beta1/txs" : "/txs",
      params
    )

    const txResponse = isProtoTx ? result.data["tx_response"] : result.data

    if (txResponse.code != null && txResponse.code !== 0) {
      throw new Error(txResponse["raw_log"])
    }

    return Buffer.from(txResponse.txhash, "hex")
  }

  async signAmino(
    chainId: string,
    signer: string,
    signDoc: StdSignDoc,
    signOptions: KeplrSignOptions = {}
  ): Promise<AminoSignResponse> {
    return (
      await this.sendCustomRequest({
        id: payloadId(),
        jsonrpc: "2.0",
        method: "keplr_sign_amino_wallet_connect_v1",
        params: [
          chainId,
          signer,
          signDoc,
          deepmerge(this.defaultOptions.sign ?? {}, signOptions),
        ],
      })
    )[0]
  }

  signDirect(
    _chainId: string,
    _signer: string,
    _signDoc: {
      bodyBytes?: Uint8Array | null
      authInfoBytes?: Uint8Array | null
      chainId?: string | null
      accountNumber?: Long | null
    },
    _signOptions: KeplrSignOptions = {}
  ): Promise<DirectSignResponse> {
    throw new Error("Not yet implemented")
  }

  suggestToken(
    _chainId: string,
    _contractAddress: string,
    _viewingKey?: string
  ): Promise<void> {
    throw new Error("Not yet implemented")
  }
}
