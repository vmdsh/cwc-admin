import { useRef, useState } from 'react'
import { uploadImage } from '../lib/upload'
interface Props { value:string; onChange:(url:string)=>void; folder:string; placeholder?:string }
export function ImageUpload({ value, onChange, folder, placeholder='https://… or upload' }:Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const handleFile = async (e:React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); setError('')
    try { onChange(await uploadImage(file, folder)) }
    catch(err) { setError((err as Error).message) }
    finally { setUploading(false); if(fileRef.current) fileRef.current.value='' }
  }
  return (
    <div className="img-upload-wrap">
      <div className="img-upload-row">
        <input type="text" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} />
        <button type="button" className="upload-btn" onClick={()=>fileRef.current?.click()} disabled={uploading}>
          {uploading ? <><span className="spinner"/>Uploading…</> : '📁 Upload'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFile}/>
      </div>
      {error && <div style={{color:'var(--danger)',fontSize:'.75rem'}}>{error}</div>}
      {value && <img src={value} alt="preview" className="upload-preview"/>}
    </div>
  )
}
