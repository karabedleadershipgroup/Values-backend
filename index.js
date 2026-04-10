import { useState } from 'react'
import Head from 'next/head'

const VALUES = ['Adaptability', 'Client-Centered', 'Collaboration', 'DEIB', 'Integrity', 'Respect']

const SCRIPT_STEPS = [
  { key: 'opening', label: 'Opening' },
  { key: 'behaviorImpact', label: 'Behavior + impact' },
  { key: 'expectation', label: 'Expectation' },
  { key: 'curiosityQuestion', label: 'Curiosity question' },
  { key: 'alignmentStatement', label: 'Alignment statement' },
]

export default function Home() {
  const [situation, setSituation] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function analyze() {
    if (!situation.trim()) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situation }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong.')
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setResult(null)
    setSituation('')
    setError('')
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') analyze()
  }

  const actionClass = result
    ? result.recommendedAction.action === 'Coach'
      ? 'chip-coach'
      : result.recommendedAction.action === 'Document'
      ? 'chip-document'
      : 'chip-escalate'
    : ''

  return (
    <>
      <Head>
        <title>Values-Based Leadership Response Tool — KLG</title>
        <meta name="description" content="A trauma-informed, values-based leadership coaching tool by Karabed Leadership Group." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="page">
        <header className="hero">
          <div className="logo-mark"><span>KLG</span></div>
          <h1>Values-Based Leadership Response Tool</h1>
          <p>Describe a staff behavior situation and receive a structured, trauma-informed leadership response grounded in your organization's core values.</p>
          <div className="pills">
            {VALUES.map(v => <span key={v} className="pill">{v}</span>)}
          </div>
        </header>

        {!result && !loading && (
          <div className="card">
            <div className="section-label">Describe the situation</div>
            <textarea
              value={situation}
              onChange={e => setSituation(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Example: A staff member raised their voice at a client during intake when the client could not locate their ID, stating 'We go through this every time.' Other staff witnessed the interaction."
            />
            {error && <p className="error-msg">{error}</p>}
            <button className="analyze-btn" onClick={analyze} disabled={!situation.trim()}>
              Analyze situation
            </button>
            <p className="hint">Press ⌘ + Enter to submit</p>
          </div>
        )}

        {loading && (
          <div className="loading">
            <div className="spinner" />
            <span>Analyzing through a values-based lens...</span>
          </div>
        )}

        {result && (
          <div className="results">
            <div className="results-header">
              <div className="section-label" style={{ marginBottom: 0 }}>Leadership analysis</div>
              <button className="reset-btn" onClick={reset}>New situation</button>
            </div>

            <div className="card">

              <div className="result-section">
                <div className="result-label">Behavior observed</div>
                <p className="content">{result.behaviorObserved}</p>
              </div>

              <hr className="divider" />

              <div className="result-section">
                <div className="result-label">Values analysis</div>
                {result.valuesAnalysis.map((v, i) => (
                  <div key={i} className="value-row">
                    <div className="value-row-header">
                      <span className="value-tag">{v.value}</span>
                      <span className={v.status === 'Misaligned' ? 'status-mis' : 'status-up'}>{v.status}</span>
                    </div>
                    <p className="value-explanation">{v.explanation}</p>
                  </div>
                ))}
              </div>

              <hr className="divider" />

              <div className="result-section">
                <div className="result-label">Impact</div>
                <div className="impact-grid">
                  {['client', 'team', 'organizational'].map(k => (
                    <div key={k} className="impact-card">
                      <div className="impact-label">{k.charAt(0).toUpperCase() + k.slice(1)}</div>
                      <p>{result.impact[k]}</p>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="divider" />

              <div className="result-section">
                <div className="result-label">Correct behavior</div>
                <p className="content">{result.correctBehavior}</p>
              </div>

              <hr className="divider" />

              <div className="result-section">
                <div className="result-label">Leader conversation script</div>
                <div className="script-steps">
                  {SCRIPT_STEPS.map(s => (
                    <div key={s.key} className="script-step">
                      <div className="script-step-label">{s.label}</div>
                      <div className="script-block">{result.conversationScript[s.key]}</div>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="divider" />

              <div className="result-section">
                <div className="result-label">Recommended action</div>
                <div className="action-row">
                  <span className={`action-chip ${actionClass}`}>{result.recommendedAction.action}</span>
                  <p className="action-reasoning">{result.recommendedAction.reasoning}</p>
                </div>
              </div>

            </div>

            <footer className="footer">
              <p>Powered by <strong>Karabed Leadership Group</strong> — Values-Based Leadership Framework</p>
            </footer>
          </div>
        )}
      </div>

      <style jsx>{`
        .page { max-width: 760px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }

        .hero { text-align: center; padding: 3rem 1rem 2.5rem; border-bottom: 0.5px solid var(--border); margin-bottom: 2rem; }
        .logo-mark { width: 52px; height: 52px; background: var(--navy); border-radius: var(--radius-md); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; }
        .logo-mark span { color: var(--gold); font-weight: 600; font-size: 15px; letter-spacing: 1px; font-family: sans-serif; }
        .hero h1 { font-size: 26px; font-weight: 400; color: var(--text-primary); margin-bottom: 0.6rem; letter-spacing: -0.01em; }
        .hero p { font-size: 15px; color: var(--text-secondary); line-height: 1.65; max-width: 520px; margin: 0 auto; font-family: sans-serif; }
        .pills { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 1.5rem; }
        .pill { font-size: 12px; padding: 5px 13px; border-radius: 999px; background: var(--navy); color: var(--gold); border: 0.5px solid var(--navy); font-family: sans-serif; }

        .card { background: var(--bg); border: 0.5px solid var(--border); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1.25rem; }
        .section-label { font-size: 11px; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.75rem; font-family: sans-serif; }

        textarea { width: 100%; min-height: 130px; resize: vertical; font-size: 15px; line-height: 1.65; padding: 14px; border: 0.5px solid var(--border-secondary); border-radius: var(--radius-md); font-family: sans-serif; color: var(--text-primary); background: var(--bg); }
        textarea:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px rgba(27,42,74,0.1); }
        textarea::placeholder { color: var(--text-tertiary); }

        .analyze-btn { width: 100%; padding: 13px; background: var(--navy); color: var(--gold); border: none; border-radius: var(--radius-md); font-size: 15px; font-weight: 500; cursor: pointer; font-family: sans-serif; margin-top: 1rem; letter-spacing: 0.02em; transition: opacity 0.15s; }
        .analyze-btn:hover { opacity: 0.88; }
        .analyze-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .hint { font-size: 12px; color: var(--text-tertiary); text-align: center; margin-top: 0.5rem; font-family: sans-serif; }
        .error-msg { font-size: 13px; color: var(--red-text); background: var(--red-bg); border: 0.5px solid var(--red-border); border-radius: var(--radius-md); padding: 10px 14px; margin-top: 0.75rem; font-family: sans-serif; }

        .loading { display: flex; align-items: center; gap: 12px; color: var(--text-secondary); font-size: 14px; padding: 2rem 0; font-family: sans-serif; }
        .spinner { width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: var(--navy); border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .results-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
        .reset-btn { font-size: 13px; color: var(--text-secondary); background: none; border: 0.5px solid var(--border); border-radius: var(--radius-md); padding: 7px 16px; cursor: pointer; font-family: sans-serif; }
        .reset-btn:hover { background: var(--bg-secondary); }

        .result-section { margin-bottom: 1.5rem; }
        .result-label { font-size: 11px; font-weight: 600; color: var(--gold-text); background: var(--gold-light); border: 0.5px solid var(--gold-border); border-radius: var(--radius-md); padding: 5px 13px; display: inline-block; margin-bottom: 0.9rem; text-transform: uppercase; letter-spacing: 0.08em; font-family: sans-serif; }
        .content { font-size: 15px; color: var(--text-primary); line-height: 1.75; font-family: sans-serif; }
        .divider { border: none; border-top: 0.5px solid var(--border); margin: 1.5rem 0; }

        .value-row { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 0.5px solid var(--border); }
        .value-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .value-row-header { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
        .value-tag { display: inline-block; font-size: 11px; padding: 3px 11px; border-radius: 999px; background: var(--navy); color: var(--gold); font-family: sans-serif; }
        .status-mis { font-size: 12px; color: #A32D2D; font-weight: 600; font-family: sans-serif; }
        .status-up { font-size: 12px; color: #0F6E56; font-weight: 600; font-family: sans-serif; }
        .value-explanation { font-size: 13px; color: var(--text-secondary); line-height: 1.6; font-family: sans-serif; }

        .impact-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
        .impact-card { background: var(--bg-secondary); border: 0.5px solid var(--border); border-radius: var(--radius-md); padding: 14px; }
        .impact-label { font-size: 11px; color: var(--text-tertiary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.07em; font-family: sans-serif; }
        .impact-card p { font-size: 13px; line-height: 1.65; font-family: sans-serif; }

        .script-steps { display: flex; flex-direction: column; gap: 14px; }
        .script-step-label { font-size: 11px; color: var(--text-tertiary); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.07em; font-family: sans-serif; }
        .script-block { background: var(--bg-secondary); border-left: 3px solid var(--gold); border-radius: 0 var(--radius-md) var(--radius-md) 0; padding: 14px 18px; font-size: 14px; line-height: 1.75; color: var(--text-primary); white-space: pre-wrap; font-family: sans-serif; }

        .action-row { display: flex; align-items: flex-start; gap: 14px; flex-wrap: wrap; }
        .action-chip { display: inline-flex; align-items: center; font-size: 12px; padding: 5px 14px; border-radius: var(--radius-md); font-weight: 600; font-family: sans-serif; }
        .chip-coach { background: var(--green-bg); color: var(--green-text); border: 0.5px solid var(--green-border); }
        .chip-document { background: var(--gold-light); color: var(--gold-text); border: 0.5px solid var(--gold-border); }
        .chip-escalate { background: var(--red-bg); color: var(--red-text); border: 0.5px solid var(--red-border); }
        .action-reasoning { font-size: 14px; color: var(--text-secondary); line-height: 1.65; flex: 1; min-width: 180px; font-family: sans-serif; }

        .footer { text-align: center; margin-top: 3rem; padding-top: 2rem; border-top: 0.5px solid var(--border); }
        .footer p { font-size: 12px; color: var(--text-tertiary); font-family: sans-serif; }
        .footer strong { color: var(--gold); font-weight: 500; }
      `}</style>
    </>
  )
}
