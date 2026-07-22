// Semnătura vizuală a aplicației: orice status se randează ca o ștampilă de
// cerneală — dreptunghi conturat, litere mici-mari monospace — nu o pastilă
// plină, cum are orice alt CRM. `compact` renunță la rotație în tabele dense
// (rânduri de client, coloane de pipeline), unde ținuta trebuie să rămână
// disciplinată; varianta implicită (pagina de detaliu, istoric) își permite
// ușoara înclinare de ștampilă reală.
export default function StatusBadge({
  name,
  color,
  compact = false,
}: {
  name: string
  color: string
  compact?: boolean
}) {
  return (
    <span
      className="inline-block rounded-[3px] border-[1.5px] bg-surface px-2 py-0.5 font-data text-[10px] font-semibold uppercase leading-tight tracking-wider"
      style={{
        borderColor: color,
        color,
        transform: compact ? undefined : 'rotate(-1.2deg)',
      }}
    >
      {name}
    </span>
  )
}
