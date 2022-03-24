import { SolletWalletAdapter } from '@solana/wallet-adapter-sollet'
import { notify } from '../../utils/notifications'

export function SolletExtensionAdapter(_, network) {
  const sollet = (window as any).sollet
  if (sollet) {
    return new SolletWalletAdapter({ network })
  }

  return {
    on: () => {},
    connect: () => {
      notify({
        title: 'Sollet Extension Error',
        type: 'error',
        description:
          'Please install the Sollet Extension for Chrome and then reload this page.',
      })
    },
  }
}
