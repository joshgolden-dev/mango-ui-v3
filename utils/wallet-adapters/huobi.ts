import EventEmitter from 'eventemitter3'
import { PublicKey, Transaction } from '@solana/web3.js'
import { DEFAULT_PUBLIC_KEY, WalletAdapter } from '../../@types/types'

type HuobiEvent = 'disconnect' | 'connect'
type HuobiRequestMethod =
  | 'connect'
  | 'disconnect'
  | 'signMessage'
  | 'signTransaction'
  | 'signAllTransactions'

interface HuobiProvider {
  publicKey?: PublicKey
  isConnected?: boolean
  autoApprove?: boolean
  signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  on: (event: HuobiEvent, handler: (args: any) => void) => void
  request: (method: HuobiRequestMethod, params: any) => Promise<any>
  listeners: (event: HuobiEvent) => (() => void)[]
}

export class HuobiWalletAdapter extends EventEmitter implements WalletAdapter {
  constructor() {
    super()
    this.connect = this.connect.bind(this)
  }

  private get _provider(): HuobiProvider | undefined {
    if ((window as any)?.huobiWallet?.isHuobiWallet) {
      return (window as any).huobiWallet
    }
    return undefined
  }

  private _handleConnect = (...args) => {
    this.emit('connect', ...args)
  }

  private _handleDisconnect = (...args) => {
    this.emit('disconnect', ...args)
  }

  get connected() {
    return this._provider?.isConnected || false
  }

  get autoApprove() {
    return this._provider?.autoApprove || false
  }

  async signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }> {
    if (!this._provider) {
      return null
    }

    return this._provider.signMessage(message)
  }

  async signAllTransactions(
    transactions: Transaction[]
  ): Promise<Transaction[]> {
    if (!this._provider) {
      return transactions
    }

    return this._provider.signAllTransactions(transactions)
  }

  get publicKey() {
    return this._provider?.publicKey || DEFAULT_PUBLIC_KEY
  }

  async signTransaction(transaction: Transaction) {
    if (!this._provider) {
      return transaction
    }

    return this._provider.signTransaction(transaction)
  }

  connect() {
    if (!this._provider) {
      return
    }
    if (!this._provider.listeners('connect').length) {
      this._provider?.on('connect', this._handleConnect)
    }
    if (!this._provider.listeners('disconnect').length) {
      this._provider?.on('disconnect', this._handleDisconnect)
    }
    return this._provider?.connect()
  }

  disconnect() {
    if (this._provider) {
      this._provider.disconnect()
    }
  }
}
