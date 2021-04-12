import xw from 'xwind'
import { useBalances } from '../hooks/useBalances'
import useMangoStore from '../stores/useMangoStore'
import { settleAll } from '../utils/mango'
import useConnection from '../hooks/useConnection'
import Button from '../components/Button'

const BalancesTable = () => {
  const balances = useBalances()
  const { programId, connection } = useConnection()

  async function handleSettleAll() {
    const markets = Object.values(
      useMangoStore.getState().selectedMangoGroup.markets
    )
    const marginAccount = useMangoStore.getState().selectedMarginAccount.current
    const mangoGroup = useMangoStore.getState().selectedMangoGroup.current
    const wallet = useMangoStore.getState().wallet.current

    try {
      await settleAll(
        connection,
        programId,
        mangoGroup,
        marginAccount,
        markets,
        wallet
      )
      // notify({
      //   message: 'Successfully settled funds',
      //   type: 'info',
      // });
    } catch (e) {
      console.warn('Error settling all:', e)
      if (e.message === 'No unsettled funds') {
        //   notify({
        //     message: 'There are no unsettled funds',
        //     type: 'error',
        //   });
      } else {
        // notify({
        //   message: 'Error settling funds',
        //   description: e.message,
        //   type: 'error',
        // });
      }
    }
  }

  return (
    <div css={xw`flex flex-col py-6`}>
      <div css={xw`-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8`}>
        <div css={xw`align-middle inline-block min-w-full sm:px-6 lg:px-8`}>
          {balances.length ? (
            <div css={xw`text-right`}>
              <Button onClick={handleSettleAll}>Settle All</Button>
            </div>
          ) : null}
          {balances.length ? (
            <div
              css={xw`shadow overflow-hidden border-b border-mango-dark-light sm:rounded-md`}
            >
              <table css={xw`min-w-full divide-y divide-mango-dark-light`}>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      css={xw`px-6 py-3 text-left text-base font-medium text-gray-300 tracking-wider`}
                    >
                      Coin
                    </th>
                    <th
                      scope="col"
                      css={xw`px-6 py-3 text-left text-base font-medium text-gray-300 tracking-wider`}
                    >
                      Deposits
                    </th>
                    <th
                      scope="col"
                      css={xw`px-6 py-3 text-left text-base font-medium text-gray-300 tracking-wider`}
                    >
                      Borrows
                    </th>
                    <th
                      scope="col"
                      css={xw`px-6 py-3 text-left text-base font-medium text-gray-300 tracking-wider`}
                    >
                      In Orders
                    </th>
                    <th
                      scope="col"
                      css={xw`px-6 py-3 text-left text-base font-medium text-gray-300 tracking-wider`}
                    >
                      Unsettled
                    </th>
                    <th
                      scope="col"
                      css={xw`px-6 py-3 text-left text-base font-medium text-gray-300 tracking-wider`}
                    >
                      Net
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((balance, index) => (
                    <tr
                      key={`${index}`}
                      css={
                        index % 2 === 0
                          ? xw`bg-mango-dark-light`
                          : xw`bg-mango-dark-lighter`
                      }
                    >
                      <td
                        css={xw`px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-light`}
                      >
                        {balance.coin}
                      </td>
                      <td
                        css={xw`px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-light`}
                      >
                        {balance.marginDeposits}
                      </td>
                      <td
                        css={xw`px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-light`}
                      >
                        {balance.borrows}
                      </td>
                      <td
                        css={xw`px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-light`}
                      >
                        {balance.orders}
                      </td>
                      <td
                        css={xw`px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-light`}
                      >
                        {balance.unsettled}
                      </td>
                      <td
                        css={xw`px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-light`}
                      >
                        {balance.net}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              css={xw`w-full text-center py-6 text-base bg-th-bkg-1 font-light text-th-fgd-4 rounded-md`}
            >
              No balances
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BalancesTable
