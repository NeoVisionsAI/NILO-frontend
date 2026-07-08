/** Subvista "Historial": eventos clínicos del paciente. */
export function HistoryTab() {
  const events = [
    { date: '01/07 08:15', text: 'Administración de medicación pautada.' },
    { date: '30/06 22:40', text: 'Alerta de taquicardia resuelta.' },
    { date: '30/06 09:00', text: 'Revisión médica completada.' },
  ]
  return (
    <ul className="u-stack">
      {events.map((e) => (
        <li key={e.date} className="u-row" style={{ alignItems: 'baseline' }}>
          <span className="u-muted" style={{ minWidth: 96 }}>{e.date}</span>
          <span>{e.text}</span>
        </li>
      ))}
    </ul>
  )
}
