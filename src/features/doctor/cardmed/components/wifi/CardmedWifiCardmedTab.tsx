import type { CardmedTestData } from '../../wifi/types'
import './CardmedWifiCardmedTab.css'

interface CardmedWifiCardmedTabProps {
  busy: boolean
  configCode: string
  configJson: string
  cardmedConfig: Record<string, unknown> | null
  testResult: CardmedTestData | null
  onConfigCodeChange: (value: string) => void
  onConfigJsonChange: (value: string) => void
  onLoad: () => void
  onSaveCode: () => void
  onSaveJson: () => void
  onScanQr: () => void
  onTest: () => void
}

export function CardmedWifiCardmedTab({
  busy,
  configCode,
  configJson,
  cardmedConfig,
  testResult,
  onConfigCodeChange,
  onConfigJsonChange,
  onLoad,
  onSaveCode,
  onSaveJson,
  onScanQr,
  onTest,
}: CardmedWifiCardmedTabProps) {
  return (
    <div className="wifi-cardmed-tab">
      <div className="wifi-cardmed-tab__toolbar">
        <button type="button" onClick={onLoad} disabled={busy}>
          Leer config
        </button>
        <button type="button" onClick={onScanQr} disabled={busy}>
          Escanear QR (Pi)
        </button>
        <button type="button" className="nilo-cardmed__primary" onClick={onTest} disabled={busy}>
          Probar
        </button>
      </div>

      <div className="wifi-cardmed-tab__block">
        <label className="wifi-config-tab__field wifi-config-tab__field--wide">
          <span>Código manual (SITE|Sala|op|loc)</span>
          <div className="wifi-cardmed-tab__row">
            <input
              type="text"
              value={configCode}
              onChange={(e) => onConfigCodeChange(e.target.value)}
              disabled={busy}
            />
            <button type="button" onClick={onSaveCode} disabled={busy || !configCode.trim()}>
              Guardar
            </button>
          </div>
        </label>
      </div>

      <div className="wifi-cardmed-tab__block">
        <label className="wifi-config-tab__field wifi-config-tab__field--wide">
          <span>Config JSON</span>
          <textarea
            value={configJson}
            onChange={(e) => onConfigJsonChange(e.target.value)}
            rows={5}
            disabled={busy}
            spellCheck={false}
          />
          <button type="button" onClick={onSaveJson} disabled={busy || !configJson.trim()}>
            Guardar JSON
          </button>
        </label>
      </div>

      {cardmedConfig && (
        <pre className="nilo-cardmed__json m3-scroll">{JSON.stringify(cardmedConfig, null, 2)}</pre>
      )}

      {testResult?.steps && testResult.steps.length > 0 && (
        <div className="wifi-cardmed-tab__steps">
          <h3>Resultado de prueba</h3>
          <ol>
            {testResult.steps.map((step, index) => (
              <li key={`${step.name ?? 'step'}-${index}`} data-ok={step.ok ? 'true' : 'false'}>
                <strong>{step.name ?? `Paso ${index + 1}`}</strong>
                {step.message ? ` — ${step.message}` : ''}
              </li>
            ))}
          </ol>
          <pre className="nilo-cardmed__json m3-scroll">{JSON.stringify(testResult, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
