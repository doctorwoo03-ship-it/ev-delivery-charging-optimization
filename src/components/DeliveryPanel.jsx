import { useState } from 'react'

const EMPTY_FORM = { name: '', address: '', lat: '', lng: '' }

function DeliveryPanel({ deliveries, onAdd, onDelete }) {
  const [form, setForm] = useState(EMPTY_FORM)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!form.name.trim()) {
      alert('배송지명을 입력해주세요.')
      return
    }

    const latNum = parseFloat(form.lat)
    const lngNum = parseFloat(form.lng)

    if (isNaN(latNum) || isNaN(lngNum)) {
      alert('위도와 경도는 유효한 숫자여야 합니다.\n예) 위도: 37.5045, 경도: 127.0490')
      return
    }

    onAdd({
      id: Date.now(),
      name: form.name.trim(),
      address: form.address.trim(),
      lat: latNum,
      lng: lngNum,
    })

    setForm(EMPTY_FORM)
  }

  return (
    <section className="delivery-panel">
      <h2 className="delivery-panel-title">배송지 관리</h2>

      <form className="delivery-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <input
            className="form-input"
            type="text"
            name="name"
            placeholder="배송지명"
            value={form.name}
            onChange={handleChange}
          />
          <input
            className="form-input"
            type="text"
            name="address"
            placeholder="주소 (선택)"
            value={form.address}
            onChange={handleChange}
          />
          <input
            className="form-input form-input-short"
            type="text"
            name="lat"
            placeholder="위도 (예: 37.5045)"
            value={form.lat}
            onChange={handleChange}
          />
          <input
            className="form-input form-input-short"
            type="text"
            name="lng"
            placeholder="경도 (예: 127.0490)"
            value={form.lng}
            onChange={handleChange}
          />
          <button className="btn-add" type="submit">
            추가
          </button>
        </div>
      </form>

      <ul className="delivery-list">
        {deliveries.length === 0 && (
          <li className="delivery-empty">등록된 배송지가 없습니다.</li>
        )}
        {deliveries.map((d, i) => (
          <li key={d.id} className="delivery-item">
            <span className="delivery-index">{i + 1}</span>
            <div className="delivery-info">
              <span className="delivery-name">{d.name}</span>
              <span className="delivery-coords">
                {d.address ? d.address : `${d.lat}, ${d.lng}`}
              </span>
            </div>
            <button
              className="btn-delete"
              onClick={() => onDelete(d.id)}
              type="button"
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default DeliveryPanel
