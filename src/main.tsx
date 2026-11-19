import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { copy, type Language } from './copy';
import './style.css';

type Analysis = { id: string; evidence: string[] };
function App() {
  const initialLanguage = localStorage.getItem('language') || navigator.language.split('-')[0];
  const [lang, setLang] = useState<Language>(initialLanguage === 'en' || initialLanguage === 'ja' ? initialLanguage : 'ko');
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'error' | 'limited' | 'manual' | null>(null);
  const t = copy[lang];
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.brand;
    localStorage.setItem('language', lang);
  }, [lang, t]);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('result');
    if (!id) return;
    setBusy(true);
    fetch('/api/analyses/' + encodeURIComponent(id)).then(async response => {
      if (!response.ok) throw Error();
      setAnalysis(await response.json());
    }).catch(() => setError('error')).finally(() => setBusy(false));
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setAnalysis(null);
    history.replaceState(null, '', location.pathname);
    try {
      const response = await fetch('/api/analyses', {
        method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(/^https?:\/\/\S+$/i.test(text.trim()) ? { url: text.trim() } : { text })
      });
      if (response.status === 422) {
        setError('manual');
        return;
      }
      if (response.status === 429) {
        setError('limited');
        return;
      }
      if (!response.ok) throw Error();
      const data: Analysis = await response.json();
      setAnalysis(data);
      history.replaceState(null, '', '?result=' + data.id);
    } catch { setError('error'); }
    finally { setBusy(false); }
  }
  return <>
    <header><div className="brand"><span aria-hidden="true">↗</span>{t.brand}</div>
      <select aria-label={t.language} value={lang} onChange={e => setLang(e.target.value as Language)}>
        <option value="ko">한국어</option><option value="ja">日本語</option><option value="en">English</option>
      </select></header>
    <main><h1>{t.title}</h1><p>{t.intro}</p>
      <form onSubmit={submit}><label htmlFor="review">{t.label}</label>
        <textarea id="review" value={text} maxLength={20000} disabled={busy} placeholder={t.placeholder} onChange={e => setText(e.target.value)} />
        <div className="actions"><small>{text.length.toLocaleString(lang)} / 20,000</small>
          <button disabled={busy || !text.trim()}>{busy ? t.busy : t.run}</button></div>
      </form>
      <div aria-live="polite">{error && <p role="alert">{t[error]}</p>}
        {analysis && <section><h2>{analysis.evidence.length ? t.found : t.empty}</h2>
          {analysis.evidence.map(quote => <blockquote key={quote}>{quote}</blockquote>)}<p>{t.note}</p></section>}
      </div>
    </main></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
