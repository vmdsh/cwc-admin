interface Props { message:string; onConfirm:()=>void; onCancel:()=>void }
export function ConfirmDialog({ message, onConfirm, onCancel }:Props) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={e=>e.stopPropagation()}>
        <h4>Confirm Delete</h4>
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  )
}
