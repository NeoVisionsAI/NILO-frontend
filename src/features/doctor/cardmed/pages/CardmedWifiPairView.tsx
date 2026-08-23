import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { toast } from '@/lib/toast'
import { ROOT_PATHS } from '@/router/paths'
import { CARDMED_WIFI_AP_PREFIX, CARDMED_WIFI_GUI_URL } from '../wifi/constants'
import './CardmedDevicePage.css'
import './CardmedWifiProvisionPage.css'

export function CardmedWifiPairView() {
  const [apSuffix, setApSuffix] = useState('')

  const apHint = apSuffix.trim()
    ? `${CARDMED_WIFI_AP_PREFIX}${apSuffix.trim().toLowerCase()}`
    : `${CARDMED_WIFI_AP_PREFIX}xxxx`

  function handleConfigureCardMed() {
    const opened = window.open(CARDMED_WIFI_GUI_URL, '_blank', 'noopener,noreferrer')
    if (!opened) {
      toast.error('No se pudo abrir la pestaña. Comprueba que el navegador no bloquee ventanas emergentes.')
      return
    }
    toast.info('Se abrió la configuración del dispositivo en otra pestaña.')
  }

  return (
    <div className="nilo-cardmed nilo-cardmed-wifi">
      <header className="nilo-cardmed__header">
        <Link to={ROOT_PATHS.doctor} className="nilo-cardmed__back">
          <MaterialIcon name="arrow_back" size={20} />
          <span>Volver</span>
        </Link>
        <div className="nilo-cardmed__header-main">
          <h1>Emparejar con Nilocardmed</h1>
          <p>Conecta la tablet al punto de acceso WiFi del dispositivo</p>
        </div>
      </header>

      <section className="nilo-cardmed-wifi__idle">
        <div className="nilo-cardmed__connect-hero">
          <div className="nilo-cardmed__connect-hero-icon" aria-hidden="true">
            <MaterialIcon name="wifi_tethering" size={32} />
          </div>
          <div className="nilo-cardmed__connect-hero-copy">
            <h2>Paso 1 — WiFi del Pi</h2>
            <p>
              Conecta la tablet a la red <strong>{apHint}</strong> (xxxx = últimos 4 hex de la MAC; visible en la
              lista WiFi del dispositivo).
            </p>
            <p className="nilo-cardmed__connect-note">
              Vuelve aquí y pulsa <strong>Configurar CardMed</strong>. Se abrirá la configuración del dispositivo en
              otra pestaña ({CARDMED_WIFI_GUI_URL}). Sin internet en el AP es normal.
            </p>
          </div>
          <div className="nilo-cardmed__connect-actions">
            <button type="button" className="nilo-cardmed__primary" onClick={handleConfigureCardMed}>
              <MaterialIcon name="open_in_new" size={22} />
              Configurar CardMed
            </button>
          </div>
        </div>

        <div className="nilo-cardmed__connect-by-name">
          <h3>Sufijo del AP (opcional)</h3>
          <p>Últimos 4 caracteres hex de la MAC para ver el nombre exacto de la red.</p>
          <div className="nilo-cardmed__connect-by-name-row">
            <label className="nilo-cardmed__field nilo-cardmed__connect-by-name-field">
              Sufijo MAC
              <div className="nilo-cardmed__ble-name-input">
                <span className="nilo-cardmed__ble-name-prefix">{CARDMED_WIFI_AP_PREFIX}</span>
                <input
                  type="text"
                  value={apSuffix}
                  onChange={(e) => setApSuffix(e.target.value.replace(/[^a-fA-F0-9]/g, '').slice(0, 4))}
                  placeholder="a1b2"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={4}
                />
              </div>
            </label>
          </div>
        </div>
      </section>
    </div>
  )
}
