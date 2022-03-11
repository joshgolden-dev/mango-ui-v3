import React, { FunctionComponent, useEffect, useMemo, useState } from 'react'
import { PlusCircleIcon, TrashIcon } from '@heroicons/react/outline'
import { Alert as NotifiAlert, Source } from '@notifi-network/notifi-core'
import Modal from './Modal'
import Input, { Label } from './Input'
import { ElementTitle } from './styles'
import useMangoStore from '../stores/useMangoStore'
import Button, { LinkButton } from './Button'
import { notify } from '../utils/notifications'
import { useTranslation } from 'next-i18next'
import ButtonGroup from './ButtonGroup'
import InlineNotification from './InlineNotification'
import { NotifiIcon } from './icons'
import { EndpointTypes } from '../@types/types'
import {
  BlockchainEnvironment,
  GqlError,
  useNotifiClient,
} from '@notifi-network/notifi-react-hooks'

interface CreateAlertModalProps {
  onClose: () => void
  isOpen: boolean
  repayAmount?: string
  tokenSymbol?: string
}
const nameForHealth = (health: number): string => `Alert Health <= ${health}`
const healthForAlert = (alert: NotifiAlert): number => {
  const obj = JSON.parse(alert.filterOptions) ?? {}
  return obj.threshold ?? 0
}

const CreateAlertModal: FunctionComponent<CreateAlertModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation(['common', 'alerts'])
  const actions = useMangoStore((s) => s.actions)
  const mangoGroup = useMangoStore((s) => s.selectedMangoGroup.current)
  const mangoAccount = useMangoStore((s) => s.selectedMangoAccount.current)
  const activeAlerts = useMangoStore((s) => s.alerts.activeAlerts)
  const loading = useMangoStore((s) => s.alerts.loading)
  const submitting = useMangoStore((s) => s.alerts.submitting)
  const error = useMangoStore((s) => s.alerts.error)
  const cluster = useMangoStore((s) => s.connection.cluster)
  const wallet = useMangoStore((s) => s.wallet.current)
  const connected = useMangoStore((s) => s.wallet.connected)
  const [invalidAmountMessage, setInvalidAmountMessage] = useState('')
  const [health, setHealth] = useState('')
  const [showCustomHealthForm, setShowCustomHealthForm] = useState(false)
  const [showAlertForm, setShowAlertForm] = useState(false)
  // notifi loading state
  const [isLoading, setLoading] = useState<boolean>(false)
  // notifi error message
  const [errorMessage, setErrorMessage] = useState<string>('')

  const healthPresets = ['5', '10', '15', '25', '30']
  const ALERT_LIMIT = 5

  const endpoint = cluster ? (cluster as EndpointTypes) : 'mainnet'
  let env = BlockchainEnvironment.MainNetBeta
  switch (endpoint) {
    case 'mainnet':
      break
    case 'devnet':
      env = BlockchainEnvironment.DevNet
      break
    case 'localnet':
      env = BlockchainEnvironment.LocalNet
      break
  }
  const { data, logIn, isAuthenticated, createAlert, deleteAlert } =
    useNotifiClient({
      dappAddress: mangoGroup?.publicKey?.toString() ?? '',
      walletPublicKey: wallet?.publicKey?.toString() ?? '',
      env,
    })
  const [email, setEmail] = useState<string>('')
  const [phone, setPhone] = useState<string>('')

  const handleError = (errors: { message: string }[]) => {
    const err = errors.length > 0 ? errors[0] : null
    if (err instanceof GqlError) {
      setErrorMessage(`${err.message}: ${err.getErrorMessages().join(', ')}`)
    } else {
      setErrorMessage(err?.message ?? 'Unknown error')
    }
    setLoading(false)
  }

  const { alerts: notifiAlerts, sources } = data || {}
  const sourceToUse: Source | undefined = useMemo(() => {
    return sources?.find((it) => {
      const filter = it.applicableFilters?.find((filter) => {
        return filter.filterType === 'VALUE_THRESHOLD'
      })
      return filter !== undefined
    })
  }, [sources])

  const handlePhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value
    if (val.length > 1) {
      val = val.substring(2)
    }

    const re = /^[0-9\b]+$/
    if (val === '' || (re.test(val) && val.length <= 10)) {
      setPhone('+1' + val)
    }
  }

  const createNotifiAlert = async function () {
    setLoading(true)
    // user is not authenticated
    if (!isAuthenticated() && wallet && wallet.publicKey) {
      try {
        const adapter = async (message: Uint8Array) => {
          const signed = await wallet.signMessage(message)
          console.log('signed', signed, signed.signature)
          return signed.signature
        }
        await logIn({ signMessage: adapter })
      } catch (e) {
        handleError([e])
        throw e
      }
    }

    if (connected && isAuthenticated()) {
      console.log('Sending')
      console.log(email)
      const filter = sourceToUse.applicableFilters.find(
        (f) => f.filterType === 'VALUE_THRESHOLD'
      )
      try {
        const healthInt = parseInt(health, 10)
        await createAlert({
          filterId: filter.id,
          sourceId: sourceToUse.id,
          name: nameForHealth(healthInt),
          emailAddress: email === '' ? null : email,
          phoneNumber: phone.length < 12 ? null : phone,
          telegramId: null,
          filterOptions: {
            threshold: healthInt,
          },
        })
      } catch (e) {
        handleError([e])
        throw e
      }
    }
    setLoading(false)
  }

  const deleteNotifiAlert = async function (alert) {
    const alertToDelete = notifiAlerts?.find((a) => {
      const health = healthForAlert(a)
      return health === alert.health
    })
    if (alertToDelete !== undefined) {
      deleteAlert({ alertId: alertToDelete.id })
    }
    console.log('deleteNotifiAlert', alert, alertToDelete)
  }

  const validateEmailInput = (amount) => {
    if (Number(amount) <= 0) {
      setInvalidAmountMessage(t('enter-amount'))
    }
  }

  const onChangeEmailInput = (amount) => {
    setEmail(amount)
    setInvalidAmountMessage('')
  }

  async function onCreateAlert() {
    // send alert to Notifi
    try {
      await createNotifiAlert()
    } catch (e) {
      handleError([e])
      return
    }

    if (!email) {
      notify({
        title: t('alerts:email-address-required'),
        type: 'error',
      })
      return
    } else if (!health) {
      notify({
        title: t('alerts:alert-health-required'),
        type: 'error',
      })
      return
    }
    const body = {
      mangoGroupPk: mangoGroup.publicKey.toString(),
      mangoAccountPk: mangoAccount.publicKey.toString(),
      health,
      alertProvider: 'mail',
      email,
    }
    const success: any = await actions.createAlert(body)
    if (success) {
      setShowAlertForm(false)
    }
  }

  async function onDeleteAlert(alert) {
    // delete alert from Notifi
    await deleteNotifiAlert(alert)

    // delete alert from db
    actions.deleteAlert(alert._id)
  }

  const handleCancelCreateAlert = () => {
    if (activeAlerts.length > 0) {
      setShowAlertForm(false)
    } else {
      onClose()
    }
  }

  useEffect(() => {
    actions.loadAlerts(mangoAccount.publicKey)
  }, [])

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {!loading && !submitting ? (
        <>
          {activeAlerts.length > 0 && !showAlertForm ? (
            <>
              <Modal.Header>
                <div className="flex items-center justify-between w-full">
                  <div className="w-20" />
                  <ElementTitle noMarginBottom>
                    {t('alerts:active-alerts')}
                  </ElementTitle>
                  <Button
                    className="flex items-center justify-center pt-0 pb-0 h-8 text-xs min-w-20"
                    disabled={activeAlerts.length >= ALERT_LIMIT}
                    onClick={() => setShowAlertForm(true)}
                  >
                    <div className="flex items-center">
                      <PlusCircleIcon className="h-4 w-4 mr-1.5" />
                      {t('alerts:new-alert')}
                    </div>
                  </Button>
                </div>
              </Modal.Header>
              <div className="border-b border-th-fgd-4 mt-2">
                {activeAlerts.map((alert, index) => (
                  <div
                    className="border-t border-th-fgd-4 flex items-center justify-between p-4"
                    key={`${alert._id}${index}`}
                  >
                    <div className="text-th-fgd-1">
                      {t('alerts:alert-info', { health: alert.health })}
                    </div>
                    <TrashIcon
                      className="cursor-pointer default-transition h-5 text-th-fgd-3 w-5 hover:text-th-primary"
                      onClick={() => onDeleteAlert(alert)}
                    />
                  </div>
                ))}
              </div>
              {activeAlerts.length >= ALERT_LIMIT ? (
                <div className="mt-1 text-center text-xxs text-th-fgd-3">
                  {t('alerts:alerts-max')}
                </div>
              ) : null}
            </>
          ) : showAlertForm ? (
            <>
              <Modal.Header>
                <ElementTitle noMarginBottom>
                  {t('alerts:create-alert')}
                </ElementTitle>
                <p className="mt-1 text-center">
                  {t('alerts:alerts-disclaimer')}
                </p>
              </Modal.Header>
              {error ? (
                <div className="my-4">
                  <InlineNotification title={error} type="error" />
                </div>
              ) : null}
              <Label>{t('email-address')}</Label>
              <Input
                type="email"
                error={!!invalidAmountMessage}
                onBlur={(e) => validateEmailInput(e.target.value)}
                value={email || ''}
                onChange={(e) => onChangeEmailInput(e.target.value)}
              />
              <Label>{t('phone-number')}</Label>
              <Input type="tel" value={phone} onChange={handlePhone} />
              <div className="flex items-end mt-4">
                <div className="w-full">
                  <div className="flex justify-between">
                    <Label>{t('alerts:alert-health')}</Label>

                    <LinkButton
                      className="mb-1.5"
                      onClick={() =>
                        setShowCustomHealthForm(!showCustomHealthForm)
                      }
                    >
                      {showCustomHealthForm ? t('presets') : t('custom')}
                    </LinkButton>
                  </div>
                  {showCustomHealthForm ? (
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      onChange={(e) => setHealth(e.target.value)}
                      suffix={
                        <div className="font-bold text-base text-th-fgd-3">
                          %
                        </div>
                      }
                      value={health}
                    />
                  ) : (
                    <ButtonGroup
                      activeValue={health.toString()}
                      onChange={(p) => setHealth(p)}
                      unit="%"
                      values={healthPresets}
                    />
                  )}
                </div>
              </div>
              {errorMessage.length > 0 ? (
                <div className="mt-1 text-xxs text-th-fgd-3">
                  {errorMessage}
                </div>
              ) : (
                !isAuthenticated() && (
                  <div className="mt-1 text-xxs text-th-fgd-3">
                    {t('alerts:prompted-to-sign-transaction')}
                  </div>
                )
              )}
              <Button
                className="mt-6 w-full"
                onClick={() => onCreateAlert()}
                disabled={isLoading}
              >
                {t('alerts:create-alert')}
              </Button>
              <LinkButton
                className="mt-4 text-center w-full"
                onClick={handleCancelCreateAlert}
              >
                {t('cancel')}
              </LinkButton>
            </>
          ) : error ? (
            <div>
              <InlineNotification title={error} type="error" />
              <Button
                className="flex justify-center mt-6 mx-auto"
                onClick={() => actions.loadAlerts()}
              >
                {t('try-again')}
              </Button>
            </div>
          ) : (
            <div>
              <Modal.Header>
                <ElementTitle noMarginBottom>
                  {t('alerts:no-alerts')}
                </ElementTitle>
                <p className="mt-1 text-center">{t('alerts:no-alerts-desc')}</p>
              </Modal.Header>
              <Button
                className="flex justify-center m-auto"
                onClick={() => setShowAlertForm(true)}
              >
                {t('alerts:new-alert')}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="animate-pulse bg-th-bkg-3 h-12 rounded-md w-full" />
          <div className="animate-pulse bg-th-bkg-3 h-12 rounded-md w-full" />
          <div className="animate-pulse bg-th-bkg-3 h-12 rounded-md w-full" />
        </div>
      )}
      <Modal.Footer>
        <div className="flex item-center justify-between w-full mt-4 text-th-fgd-3">
          <div className="flex">
            <span>{t('alerts:powered-by')}</span>
            <span className="ml-2">
              <NotifiIcon className="w-10 h-5"></NotifiIcon>
            </span>
          </div>
          <div>
            <a
              href="https://docs.notifi.network/NotifiIntegrationsFAQ.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('learn-more')}
            </a>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  )
}

export default React.memo(CreateAlertModal)
