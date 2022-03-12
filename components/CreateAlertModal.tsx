import React, { FunctionComponent, useEffect, useMemo, useState } from 'react'
import { PlusCircleIcon, TrashIcon } from '@heroicons/react/outline'
import { Source } from '@notifi-network/notifi-core'
import Modal from './Modal'
import Input, { Label } from './Input'
import { ElementTitle } from './styles'
import useMangoStore, { programId } from '../stores/useMangoStore'
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
const nameForAlert = (health: number, email: string, phone: string): string =>
  `Alert for Email: ${email} Phone: ${phone} When Health <= ${health}`

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
      dappAddress: programId.toBase58(),
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

  const { sources } = data || {}

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

  // message signer to login from SDK
  const adapter = async (message: Uint8Array) => {
    const signed = await wallet.signMessage(message)
    // Sollet Adapter signMessage returns Uint8Array
    if (signed instanceof Uint8Array) {
      return signed
    }
    return signed.signature
  }

  const createNotifiAlert = async function () {
    setLoading(true)
    // user is not authenticated
    if (!isAuthenticated() && wallet && wallet.publicKey) {
      try {
        await logIn({ signMessage: adapter })
      } catch (e) {
        handleError([e])
        throw e
      }
    }

    if (connected && isAuthenticated()) {
      const filter = sourceToUse.applicableFilters.find(
        (f) => f.filterType === 'VALUE_THRESHOLD'
      )
      try {
        const healthInt = parseInt(health, 10)
        const res = await createAlert({
          filterId: filter.id,
          sourceId: sourceToUse.id,
          groupName: mangoAccount.publicKey.toBase58(),
          name: nameForAlert(healthInt, email, phone),
          emailAddress: email === '' ? null : email,
          phoneNumber: phone.length < 12 ? null : phone,
          telegramId: null,
          filterOptions: {
            threshold: healthInt,
          },
        })
        // return notifiAlertId
        return res.id
      } catch (e) {
        handleError([e])
        throw e
      }
    }
    setLoading(false)
  }

  const deleteNotifiAlert = async function (alert) {
    setLoading(true)
    // user is not authenticated
    if (!isAuthenticated() && wallet && wallet.publicKey) {
      try {
        await logIn({ signMessage: adapter })
      } catch (e) {
        handleError([e])
        throw e
      }
    }

    if (connected && isAuthenticated()) {
      try {
        await deleteAlert({ alertId: alert.notifiAlertId })
      } catch (e) {
        handleError([e])
        throw e
      }
    }
    setLoading(false)
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
    if (!email && !phone) {
      notify({
        title: t('alerts:notifi-type-required'),
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

    let notifiAlertId
    // send alert to Notifi
    try {
      notifiAlertId = await createNotifiAlert()
    } catch (e) {
      handleError([e])
      return
    }

    const body = {
      mangoGroupPk: mangoGroup.publicKey.toString(),
      mangoAccountPk: mangoAccount.publicKey.toString(),
      health,
      alertProvider: 'notifi',
      email,
      notifiAlertId,
    }
    const success: any = await actions.createAlert(body)
    if (success) {
      setErrorMessage('')
      setShowAlertForm(false)
    }
  }

  async function onDeleteAlert(alert) {
    // delete alert from Notifi
    try {
      await deleteNotifiAlert(alert)
    } catch (e) {
      handleError([e])
      // if an error thrown from notifi, like 404
      // do we want to stop delelting it from mango db ?
      return
    }

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
                <div className="flex w-full items-center justify-between">
                  <div className="w-20" />
                  <ElementTitle noMarginBottom>
                    {t('alerts:active-alerts')}
                  </ElementTitle>
                  <Button
                    className="min-w-20 flex h-8 items-center justify-center pt-0 pb-0 text-xs"
                    disabled={activeAlerts.length >= ALERT_LIMIT}
                    onClick={() => setShowAlertForm(true)}
                  >
                    <div className="flex items-center">
                      <PlusCircleIcon className="mr-1.5 h-4 w-4" />
                      {t('alerts:new-alert')}
                    </div>
                  </Button>
                </div>
              </Modal.Header>
              <div className="mt-2 border-b border-th-fgd-4">
                {errorMessage.length > 0 ? (
                  <div className="mt-1 text-xxs text-th-fgd-3">
                    {errorMessage}
                  </div>
                ) : null}
                {activeAlerts.map((alert, index) => (
                  <div
                    className="flex items-center justify-between border-t border-th-fgd-4 p-4"
                    key={`${alert._id}${index}`}
                  >
                    <div className="text-th-fgd-1">
                      {t('alerts:alert-info', { health: alert.health })}
                    </div>
                    <TrashIcon
                      className="default-transition h-5 w-5 cursor-pointer text-th-fgd-3 hover:text-th-primary"
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
              <div className="mt-4 flex items-end">
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
                        <div className="text-base font-bold text-th-fgd-3">
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
                disabled={isLoading || (!email && !phone)}
              >
                {t('alerts:create-alert')}
              </Button>
              <LinkButton
                className="mt-4 w-full text-center"
                onClick={handleCancelCreateAlert}
              >
                {t('cancel')}
              </LinkButton>
            </>
          ) : error ? (
            <div>
              <InlineNotification title={error} type="error" />
              <Button
                className="mx-auto mt-6 flex justify-center"
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
                className="m-auto flex justify-center"
                onClick={() => setShowAlertForm(true)}
              >
                {t('alerts:new-alert')}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="h-12 w-full animate-pulse rounded-md bg-th-bkg-3" />
          <div className="h-12 w-full animate-pulse rounded-md bg-th-bkg-3" />
          <div className="h-12 w-full animate-pulse rounded-md bg-th-bkg-3" />
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
