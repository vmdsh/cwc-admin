interface Opt { value: string; label: string }
interface Props { id?: string; value: string; onChange:(v:string)=>void; options:Opt[]; placeholder?:string; disabled?:boolean }
export function Select({ id, value, onChange, options, placeholder='— Select —', disabled }:Props) {
  return (
    <select id={id} value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}>
      <option value="">{placeholder}</option>
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
