import { useState } from 'react'
import { useCardmedWifiConnection } from '../hooks/useCardmedWifiConnection'
import { CardmedWifiConfigView } from './CardmedWifiConfigView'
import { CardmedWifiPairView } from './CardmedWifiPairView'

export function CardmedWifiProvisionPage() {
  const conn = useCardmedWifiConnection()
  const [screen, setScreen] = useState<'pair' | 'config'>('pair')

  if (screen === 'config') {
    return (
      <CardmedWifiConfigView
        conn={conn}
        onBackToPair={() => {
          conn.clearError()
          if (conn.isAuthenticated) {
            conn.disconnect()
          } else {
            conn.resetUnreachable()
          }
          setScreen('pair')
        }}
      />
    )
  }

  return <CardmedWifiPairView conn={conn} onConnected={() => setScreen('config')} />
}
