import { useState, useMemo, useEffect } from 'react'
import './App.css'

const TESLIM_TARIHI = new Date(2026, 10, 1) // Kasım 2026 (ay 0-indexed)

const PROJE_OPTIONS = [
  { label: 'Ivory Prime', fiyat: 350000 },
  { label: 'Ivory Tria - Daire Tip A', fiyat: 95000 },
  { label: 'Ivory Tria - Daire Tip B', fiyat: 90000 },
  { label: 'Ivory Tria - Penthouse', fiyat: 150000 },
]

const VADE_OPTIONS = [
  { label: 'Peşin', value: 'pesin' },
  { label: '6 Ay', value: '6' },
  { label: '12 Ay', value: '12' },
  { label: 'Özel', value: 'ozel' },
]

function getTeslimeKalanAy() {
  const now = new Date()
  const diffMs = TESLIM_TARIHI.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30.44)))
}

function getVadeAy(vade, customAy) {
  if (vade === 'pesin') return 0
  if (vade === '6') return 6
  if (vade === '12') return 12
  return Math.min(24, Number(customAy) || 0)
}

function getAyTarih(ayOffset) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + ayOffset)
  const aylar = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
  return `${aylar[d.getMonth()]} ${d.getFullYear()}`
}

function formatCurrency(val) {
  return new Intl.NumberFormat('en-GB', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(val))
}

function App() {
  const [projeIndex, setProjeIndex] = useState(0)
  const listeFiyati = PROJE_OPTIONS[projeIndex].fiyat
  const [vade, setVade] = useState('12')
  const [customAy, setCustomAy] = useState(18) // max 24
  const [pesinVal, setPesinVal] = useState(40)
  const [pesinMode, setPesinMode] = useState('%') // '%' or '£'
  const [anahtarVal, setAnahtarVal] = useState(10)
  const [anahtarMode, setAnahtarMode] = useState('%') // '%' or '£'
  const [anahtarManual, setAnahtarManual] = useState(false)

  const teslimeKalanAy = getTeslimeKalanAy()

  // Clamp peşinat to 0-100%
  const pesinPctClamped = pesinMode === '%'
    ? Math.min(100, Math.max(0, pesinVal))
    : Math.min(100, Math.max(0, listeFiyati > 0 ? (pesinVal / listeFiyati) * 100 : 0))

  // Auto-calculate anahtar: solve for minimum anahtar% so teslime kadar ödenen >= 40%
  // teslimeKadar = p + a + ((100 - p - a) / vade * min(teslimeKalanAy, vade))
  // 40 = p + a + (100-p-a)*r  where r = min(teslimeKalanAy, vade)/vade
  // a = (40 - p + pr - 100r) / (1-r)
  useEffect(() => {
    if (anahtarManual || vade === 'pesin') return
    const vadeAy = getVadeAy(vade, customAy)
    if (vadeAy <= 0) return
    const r = Math.min(teslimeKalanAy, vadeAy) / vadeAy
    const p = pesinPctClamped
    let a
    if (r >= 1) {
      a = 0
    } else {
      a = Math.max(0, (40 - p + p * r - 100 * r) / (1 - r))
    }
    a = Math.min(a, 100 - p)
    a = Math.round(a * 10) / 10
    if (anahtarMode === '%') {
      setAnahtarVal(a)
    } else {
      setAnahtarVal(Math.round(listeFiyati * a / 100))
    }
  }, [pesinVal, pesinMode, vade, customAy, listeFiyati, teslimeKalanAy])

  const hesap = useMemo(() => {
    const isPesin = vade === 'pesin'
    const vadeAy = getVadeAy(vade, customAy)

    // Effective percentages — clamp so peşinat ≤ 100%, anahtar ≤ (100 - peşinat)
    const pesinPctEff = pesinPctClamped
    const anahtarPctRaw = anahtarMode === '%'
      ? anahtarVal
      : (listeFiyati > 0 ? (anahtarVal / listeFiyati) * 100 : 0)
    // Vade 0 ise taksit yok → anahtar = kalan her şey
    const anahtarPctEff = vadeAy === 0
      ? (100 - pesinPctEff)
      : Math.min(anahtarPctRaw, 100 - pesinPctEff)
    const kalanPctEff = Math.max(0, 100 - pesinPctEff - anahtarPctEff)

    // Peşinat 0 ise ilk taksit peşinat sayılır
    const ilkTaksitPesinat = !isPesin && pesinPctEff === 0 && vadeAy > 0
    const efektifTaksitSayisi = ilkTaksitPesinat ? vadeAy - 1 : vadeAy
    const ilkTaksitPesinPct = ilkTaksitPesinat ? kalanPctEff / vadeAy : 0

    // Calculate how much is paid before delivery (teslime kadar):
    // peşinat (veya ilk taksit) + anahtar teslim + taksits up to teslimeKalanAy
    const taksitSayisiPre = isPesin ? 0 : efektifTaksitSayisi
    const efektifKalanPct = ilkTaksitPesinat ? kalanPctEff - ilkTaksitPesinPct : kalanPctEff
    const aylikTaksitPct = taksitSayisiPre > 0 ? efektifKalanPct / taksitSayisiPre : 0
    const teslimeKadarTaksitAy = Math.min(teslimeKalanAy, taksitSayisiPre)
    const teslimeKadarTaksitPct = aylikTaksitPct * teslimeKadarTaksitAy
    const efektifPesinPct = ilkTaksitPesinat ? ilkTaksitPesinPct : pesinPctEff
    const teslimeKadarToplamPct = efektifPesinPct + anahtarPctEff + teslimeKadarTaksitPct

    // --- İndirim Kuralları ---
    let indirimOrani = 0
    let indirimAciklama = ''
    const taksitYok = taksitSayisiPre === 0

    if (isPesin) {
      indirimOrani = 0.15
      indirimAciklama = 'Peşin ödeme — %15 indirim uygulandı.'
    } else if (taksitYok && pesinPctEff < 40) {
      indirimOrani = 0
      indirimAciklama = 'Taksitsiz planda peşinat en az %40 olmalıdır. Peşinat oranını artırın veya taksitli vade seçin.'
    } else if (teslimeKadarToplamPct < 40) {
      indirimOrani = 0
      indirimAciklama = 'Teslim öncesi toplam ödemenin en az %40 olması gerekmektedir.'
    } else if (pesinPctEff >= 50) {
      indirimOrani = 0.10
      indirimAciklama = 'Peşinat oranınız %50\'yi aştığı için %10 indirim uygulandı.'
    } else if (teslimeKadarToplamPct >= 60) {
      indirimOrani = 0.10
      indirimAciklama = 'Teslim öncesi toplamınız %60\'ı aştığı için %10 indirim uygulandı.'
    } else if (teslimeKadarToplamPct >= 50) {
      indirimOrani = 0.05
      const kalanIcinOnPct = Math.ceil(60 - teslimeKadarToplamPct)
      indirimAciklama = `Teslim öncesi toplamınız %50'yi aştığı için %5 indirim uygulandı. %10 indirim için toplamınızı %${kalanIcinOnPct} daha artırabilirsiniz.`
    } else {
      // %40-49 arası — geçerli plan ama indirim yok
      const kalanYuzde = Math.ceil(50 - teslimeKadarToplamPct)
      indirimAciklama = `Teslim öncesi toplamınızı %${kalanYuzde} daha artırarak %5 indirim kazanabilirsiniz!`
    }

    const netFiyat = listeFiyati * (1 - indirimOrani)

    let pesinTutari, anahtarTutari

    if (isPesin) {
      pesinTutari = netFiyat
      anahtarTutari = 0
    } else {
      pesinTutari = pesinMode === '%'
        ? netFiyat * (pesinVal / 100)
        : Math.min(pesinVal, netFiyat)
      // Vade 0 ise anahtarPctEff kullan (otomatik 100-peşinat)
      if (vadeAy === 0) {
        anahtarTutari = netFiyat * (anahtarPctEff / 100)
      } else {
        anahtarTutari = anahtarMode === '%'
          ? netFiyat * (anahtarVal / 100)
          : Math.min(anahtarVal, netFiyat)
      }
    }

    // Clamp so total doesn't exceed net
    if (pesinTutari + anahtarTutari > netFiyat) {
      anahtarTutari = Math.max(0, netFiyat - pesinTutari)
    }

    let kalanTutar = Math.max(0, netFiyat - pesinTutari - anahtarTutari)

    // Peşinat 0 ise ilk taksit peşinat olarak sayılır
    if (ilkTaksitPesinat) {
      pesinTutari = kalanTutar / vadeAy
      kalanTutar = kalanTutar - pesinTutari
    }

    const pesinPct = netFiyat > 0 ? (pesinTutari / netFiyat) * 100 : 0
    const anahtarPct = netFiyat > 0 ? (anahtarTutari / netFiyat) * 100 : 0
    const kalanPct = netFiyat > 0 ? (kalanTutar / netFiyat) * 100 : 0

    // Taksitler: ilk taksit peşinat olduysa bir eksik
    const taksitSayisi = isPesin ? 0 : efektifTaksitSayisi
    const aylikTaksit = taksitSayisi > 0 ? kalanTutar / taksitSayisi : 0

    // Build payment rows
    const rows = []
    let cumulative = 0

    if (isPesin) {
      cumulative += netFiyat
      rows.push({
        ay: 0,
        tarih: `${getAyTarih(0)} (Bugün)`,
        aciklama: 'Peşin Ödeme',
        tutar: netFiyat,
        kumulatif: cumulative,
      })
    } else {
      // Ay 0: Peşinat
      cumulative += pesinTutari
      rows.push({
        ay: 0,
        tarih: `${getAyTarih(0)} (Bugün)`,
        aciklama: ilkTaksitPesinat ? 'Peşinat (İlk Taksit)' : 'Peşinat',
        tutar: pesinTutari,
        kumulatif: cumulative,
      })

      // Taksitler: ilk taksit peşinat olduysa Ay 1'den başlar, numaralama 1/(N-1)
      // Normal durumda da Ay 1'den başlar, numaralama 1/N
      let anahtarEklendi = false
      let taksitNo = 0
      for (let i = 1; i <= vadeAy; i++) {
        const isTeslimAyi = i === teslimeKalanAy

        // İlk taksit peşinat olduysa, Ay 1 = ilk gerçek taksit (2. ödeme)
        // Normal durumda Ay 1 = ilk taksit
        const gercekTaksitVar = ilkTaksitPesinat ? (i > 0) : true
        if (gercekTaksitVar && taksitSayisi > 0 && taksitNo < taksitSayisi) {
          taksitNo++
          cumulative += aylikTaksit
          rows.push({
            ay: i,
            tarih: `${getAyTarih(i)}${isTeslimAyi ? ' (Teslim)' : ''}`,
            aciklama: `Taksit ${taksitNo}/${taksitSayisi}`,
            tutar: aylikTaksit,
            kumulatif: cumulative,
          })
        }

        // Anahtar teslimi teslim ayında
        if (isTeslimAyi && anahtarTutari > 0) {
          cumulative += anahtarTutari
          rows.push({
            ay: i,
            tarih: `${getAyTarih(i)} (Teslim)`,
            aciklama: 'Anahtar Teslimi',
            tutar: anahtarTutari,
            kumulatif: cumulative,
          })
          anahtarEklendi = true
        }
      }

      // Vade teslimden kısaysa anahtar teslimi henüz eklenmemiş olabilir
      if (!anahtarEklendi && anahtarTutari > 0) {
        cumulative += anahtarTutari
        rows.push({
          ay: teslimeKalanAy,
          tarih: `${getAyTarih(teslimeKalanAy)} (Teslim)`,
          aciklama: 'Anahtar Teslimi',
          tutar: anahtarTutari,
          kumulatif: cumulative,
        })
      }
    }

    const taksitYokHatasi = taksitYok && pesinPctEff < 40
    const gecersiz = !isPesin && (teslimeKadarToplamPct < 40 || taksitYokHatasi)

    return {
      indirimOrani,
      indirimAciklama,
      netFiyat,
      pesinTutari,
      anahtarTutari,
      kalanTutar,
      taksitSayisi,
      aylikTaksit,
      rows,
      isPesin,
      vadeAy,
      pesinPct,
      anahtarPct,
      kalanPct,
      teslimeKadarToplamPct,
      gecersiz,
      taksitYokHatasi,
      pesinPctEff,
      ilkTaksitPesinat,
    }
  }, [listeFiyati, vade, customAy, pesinVal, pesinMode, anahtarVal, anahtarMode, teslimeKalanAy])

  // Exchange rates
  const [rates, setRates] = useState({ TRY: 43.5, USD: 1.28, EUR: 1.18 })
  const [ratesLoading, setRatesLoading] = useState(true)
  const [ratesError, setRatesError] = useState(false)
  const [ratesFetchedAt, setRatesFetchedAt] = useState(null)

  useEffect(() => {
    fetch('https://api.exchangerate-api.com/v4/latest/GBP')
      .then((r) => r.json())
      .then((data) => {
        if (data.rates) {
          setRates({
            TRY: data.rates.TRY,
            USD: data.rates.USD,
            EUR: data.rates.EUR,
          })
          setRatesFetchedAt(new Date())
        }
        setRatesLoading(false)
      })
      .catch(() => {
        setRatesLoading(false)
        setRatesError(true)
      })
  }, [])

  const conversions = useMemo(() => {
    const net = hesap.netFiyat
    const tryVal = net * rates.TRY
    return [
      { label: 'Net Fiyat', gbp: net, tryVal: tryVal, usd: tryVal / rates.TRY * rates.USD, eur: tryVal / rates.TRY * rates.EUR },
      { label: 'Peşinat', gbp: hesap.pesinTutari, tryVal: hesap.pesinTutari * rates.TRY, usd: hesap.pesinTutari * rates.USD, eur: hesap.pesinTutari * rates.EUR },
      { label: 'Anahtar Teslim', gbp: hesap.anahtarTutari, tryVal: hesap.anahtarTutari * rates.TRY, usd: hesap.anahtarTutari * rates.USD, eur: hesap.anahtarTutari * rates.EUR },
      { label: 'Aylık Taksit', gbp: hesap.aylikTaksit, tryVal: hesap.aylikTaksit * rates.TRY, usd: hesap.aylikTaksit * rates.USD, eur: hesap.aylikTaksit * rates.EUR },
    ]
  }, [hesap, rates])

  return (
    <div className="app">
      <div className="app-header">
        <img src="/ivory-world.png" alt="Ivory World" className="app-logo" />
        <p className="app-subtitle">Fiyat Listesi ve Ödeme Tablosu Hesaplayıcı</p>
      </div>

      {/* Input Section */}
      <div className="input-section">
        <div className="input-grid">
          <div className="input-group">
            <label>Proje - Konut</label>
            <select value={projeIndex} onChange={(e) => setProjeIndex(Number(e.target.value))}>
              {PROJE_OPTIONS.map((opt, i) => (
                <option key={i} value={i}>
                  {opt.label} / £{formatCurrency(opt.fiyat)}
                </option>
              ))}
            </select>
            <span className="hint">Liste Fiyatı: £{formatCurrency(listeFiyati)}</span>
            <span className="hint">Teslim: {getAyTarih(teslimeKalanAy)} ({teslimeKalanAy} ay sonra)</span>
          </div>

          <div className="input-group">
            <label>Vade Seçeneği</label>
            <select value={vade} onChange={(e) => { setVade(e.target.value); setAnahtarManual(false) }}>
              {VADE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {vade === 'ozel' && (
            <div className="input-group">
              <label>Özel Vade (Ay)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customAy}
                onChange={(e) => { const raw = e.target.value.replace(/[^0-9]/g, ''); setCustomAy(Math.min(24, Math.max(0, Number(raw) || 0))); setAnahtarManual(false) }}
              />
              <span className="hint">Maksimum 24 ay</span>
            </div>
          )}

          {vade !== 'pesin' && (
            <>
              <div className="input-group">
                <label>Peşinat</label>
                <div className="input-with-toggle">
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    value={pesinVal}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '')
                      const v = Math.max(0, Number(raw) || 0)
                      const max = pesinMode === '%' ? 100 : listeFiyati
                      setPesinVal(Math.min(v, max))
                      setAnahtarManual(false) // re-trigger auto-calc
                    }}
                  />
                  <div className="mode-toggle-group">
                    <button
                      type="button"
                      className={pesinMode === '%' ? 'active' : ''}
                      onClick={() => { if (pesinMode !== '%') { setPesinMode('%'); setPesinVal(Math.round(hesap.pesinPct)) } }}
                    >%</button>
                    <button
                      type="button"
                      className={pesinMode === '£' ? 'active' : ''}
                      onClick={() => { if (pesinMode !== '£') { setPesinMode('£'); setPesinVal(Math.round(hesap.pesinTutari)) } }}
                    >£</button>
                  </div>
                </div>
                <span className="hint">
                  {pesinMode === '%'
                    ? `= £${formatCurrency(hesap.pesinTutari)}`
                    : `= %${hesap.pesinPct.toFixed(1)}`}
                </span>
              </div>

              <div className="input-group">
                <label>Anahtar Teslim {!anahtarManual && <span className="auto-badge">otomatik</span>}</label>
                <div className="input-with-toggle">
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    value={hesap.vadeAy === 0 ? (anahtarMode === '%' ? Math.round(hesap.anahtarPct) : Math.round(hesap.anahtarTutari)) : anahtarVal}
                    disabled={hesap.vadeAy === 0}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '')
                      const v = Math.max(0, Number(raw) || 0)
                      const maxPct = 100 - pesinPctClamped
                      const max = anahtarMode === '%' ? maxPct : listeFiyati * maxPct / 100
                      setAnahtarVal(Math.min(v, max))
                      setAnahtarManual(true)
                    }}
                  />
                  <div className="mode-toggle-group">
                    <button
                      type="button"
                      className={anahtarMode === '%' ? 'active' : ''}
                      onClick={() => { if (anahtarMode !== '%') { setAnahtarMode('%'); setAnahtarVal(Math.round(hesap.anahtarPct)) } }}
                    >%</button>
                    <button
                      type="button"
                      className={anahtarMode === '£' ? 'active' : ''}
                      onClick={() => { if (anahtarMode !== '£') { setAnahtarMode('£'); setAnahtarVal(Math.round(hesap.anahtarTutari)) } }}
                    >£</button>
                  </div>
                </div>
                <span className="hint">
                  {anahtarMode === '%'
                    ? `= £${formatCurrency(hesap.anahtarTutari)}`
                    : `= %${hesap.anahtarPct.toFixed(1)}`}
                </span>
              </div>

              <div className="input-group">
                <label>Kalan (Taksit)</label>
                <input
                  type="text"
                  disabled
                  value={`%${hesap.kalanPct.toFixed(1)} — £${formatCurrency(hesap.kalanTutar)}`}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Validation Warning */}
      {hesap.gecersiz && (
        <div className="validation-error">
          {hesap.taksitYokHatasi
            ? `Taksitsiz ödeme planında peşinat en az %40 olmalıdır. Şu an: %${Math.round(hesap.pesinPctEff)} — Lütfen peşinat oranını artırın veya taksitli bir vade seçin.`
            : `Teslime kadar (${getAyTarih(teslimeKalanAy)}) toplam ödemenin en az %40'ı karşılanmalıdır. Şu an: %${hesap.teslimeKadarToplamPct.toFixed(0)} — Lütfen peşinat, anahtar teslim oranını veya vadeyi ayarlayın.`
          }
        </div>
      )}

      {/* Summary Cards */}
      <div className={`summary-cards${hesap.gecersiz ? ' dimmed' : ''}`}>
        <div className="summary-card highlight">
          <div className="card-label">Net Fiyat</div>
          <div className="card-value">£{formatCurrency(hesap.netFiyat)}</div>
        </div>
        <div className="summary-card">
          <div className="card-label">Peşinat</div>
          <div className="card-value">£{formatCurrency(hesap.pesinTutari)}</div>
        </div>
        <div className="summary-card">
          <div className="card-label">Anahtar Teslim</div>
          <div className="card-value">
            £{formatCurrency(hesap.anahtarTutari)}
          </div>
        </div>
        <div className="summary-card">
          <div className="card-label">Aylık Taksit</div>
          <div className="card-value">
            {hesap.taksitSayisi > 0
              ? `£${formatCurrency(hesap.aylikTaksit)}`
              : '—'}
          </div>
          {hesap.taksitSayisi > 0 && (
            <div className="hint">{hesap.taksitSayisi} taksit</div>
          )}
        </div>
      </div>

      {/* Discount Banner */}
      <div className={`discount-banner${hesap.gecersiz ? ' dimmed' : ''}${hesap.indirimOrani > 0 ? ' has-discount' : ' no-discount-banner'}`}>
        <div className="discount-banner-left">
          {hesap.indirimOrani > 0 ? (
            <>
              <span className="discount-banner-rate">%{(hesap.indirimOrani * 100).toFixed(0)} İNDİRİM</span>
              <span className="discount-banner-desc">{hesap.indirimAciklama}</span>
            </>
          ) : (
            <>
              <span className="discount-banner-rate">İNDİRİM YOK</span>
              <span className="discount-banner-desc">{hesap.indirimAciklama}</span>
            </>
          )}
        </div>
        <div className="discount-banner-right">
          {hesap.indirimOrani > 0 ? (
            <span className="discount-banner-amount">£{formatCurrency(listeFiyati - hesap.netFiyat)} tasarruf</span>
          ) : (
            <span className="discount-banner-amount">Teslime kadar: %{hesap.teslimeKadarToplamPct.toFixed(0)}</span>
          )}
        </div>
      </div>

      {/* Payment Table */}
      <div className={`table-section${hesap.gecersiz ? ' dimmed' : ''}`}>
        <h2>Ödeme Planı Tablosu</h2>
        <div className="table-scroll-wrapper">
        <table className="payment-table">
          <thead>
            <tr>
              <th>Ay</th>
              <th>Tarih</th>
              <th>Açıklama</th>
              <th>Tutar (£)</th>
              <th>Kümülatif (£)</th>
            </tr>
          </thead>
          <tbody>
            {hesap.rows.map((row, i) => (
              <tr
                key={i}
                className={
                  row.aciklama.includes('Peşin')
                    ? 'row-pesin'
                    : row.aciklama.includes('Anahtar')
                      ? 'row-anahtar'
                      : ''
                }
              >
                <td>{row.ay}</td>
                <td>{row.tarih}</td>
                <td>{row.aciklama}</td>
                <td className="amount">£{formatCurrency(row.tutar)}</td>
                <td className="cumulative">
                  £{formatCurrency(row.kumulatif)}
                </td>
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan={3}>Toplam</td>
              <td className="amount">£{formatCurrency(hesap.netFiyat)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      {/* Currency Converter */}
      <div className="table-section converter-section">
        <h2>
          Döviz Çevirici
          {ratesLoading && <span className="hint"> (yükleniyor...)</span>}
          {ratesError && <span className="hint error-hint"> (canlı kur alınamadı, tahmini kurlar)</span>}
        </h2>
        <div className="rate-badges">
          <span className="rate-badge">£1 = ₺{rates.TRY.toFixed(2)}</span>
          <span className="rate-badge">£1 = ${rates.USD.toFixed(2)}</span>
          <span className="rate-badge">£1 = €{rates.EUR.toFixed(2)}</span>
        </div>
        <div className="table-scroll-wrapper">
        <table className="payment-table">
          <thead>
            <tr>
              <th>Kalem</th>
              <th>£ (GBP)</th>
              <th>₺ (TRY)</th>
              <th>$ (USD)</th>
              <th>€ (EUR)</th>
            </tr>
          </thead>
          <tbody>
            {conversions.map((row, i) => (
              <tr key={i}>
                <td>{row.label}</td>
                <td className="amount">£{formatCurrency(row.gbp)}</td>
                <td className="amount">₺{formatCurrency(row.tryVal)}</td>
                <td className="amount">${formatCurrency(row.usd)}</td>
                <td className="amount">€{formatCurrency(row.eur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="converter-footer">
          {ratesFetchedAt && (
            <span>
              Son güncelleme: {ratesFetchedAt.toLocaleDateString('tr-TR')} {ratesFetchedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {ratesError && <span>Tahmini kurlar kullanılıyor</span>}
          <span>Kaynak: exchangerate-api.com</span>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="disclaimer">
        <p>Fiyat listesi güncelleme tarihi: 01.04.2026</p>
        <p>Bakırcı Limited, fiyatlar üzerinde herhangi bir bildirimde bulunmaksızın tek taraflı değişiklik yapma hakkını saklı tutar.</p>
        <a href="https://www.ivorycyprus.com" target="_blank" rel="noopener noreferrer">www.ivorycyprus.com</a>
      </div>
    </div>
  )
}

export default App
