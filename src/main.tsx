import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { copy, type Language } from './copy';
import './style.css';

import type { Excerpt } from '../worker/rules';

type Analysis = { id: string; evidence: string[]; excerpts?: Excerpt[] };
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
  useEffect(() => {
    if (analysis) document.getElementById('analysis-result')?.focus();
  }, [analysis]);
  async function analyze(input: string) {
    setBusy(true);
    setError(null);
    setAnalysis(null);
    history.replaceState(null, '', location.pathname);
    try {
      const response = await fetch('/api/analyses', {
        method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(/^https?:\/\/\S+$/i.test(input.trim()) ? { url: input.trim() } : { text: input })
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
    <header><div className="bar">
      <a className="brand" href="./"><i aria-hidden="true">↗</i>{t.brand}</a>
      <nav><a href="#checker">{t.nav}</a><a href="#example">{t.example}</a></nav>
      <select aria-label={t.language} value={lang} onChange={e => setLang(e.target.value as Language)}>
        <option value="ko">한국어</option><option value="ja">日本語</option><option value="en">English</option>
      </select></div></header>
    <main>
      <div className="hero">
        <div className="heading"><h1>{t.lead}<br/><em>{t.accent}</em></h1><p>{t.summary}</p></div>
        <form id="checker" onSubmit={e => { e.preventDefault(); void analyze(text); }}>
          <h2>{t.formTitle}</h2><label htmlFor="review">{t.label}</label>
          <textarea id="review" value={text} maxLength={20000} disabled={busy} placeholder={t.placeholder} onChange={e => setText(e.target.value)} />
          <div className="actions"><small>{text.length.toLocaleString(lang)} / 20,000</small>
            <button disabled={busy || !text.trim()}>{busy ? t.busy : t.run}<span aria-hidden="true"> →</span></button></div>
        </form>
      </div>
      <div aria-live="polite">{error && <p role="alert">{t[error]}</p>}
        {analysis && <section id="analysis-result" tabIndex={-1} aria-labelledby="result-title"><h2 id="result-title">{analysis.evidence.length ? t.found : t.empty}</h2>
          {(analysis.excerpts ?? analysis.evidence.map(match => ({ before: '', match, after: '' })))
            .map(({ before, match, after }) => <blockquote key={match}>{before}<mark>{match}</mark>{after}</blockquote>)}<p>{t.note}</p></section>}
      </div>
      <aside id="example">
        <div><h2>{t.example}</h2><p>{t.sampleType}</p></div>
        <div className="sample"><blockquote>{t.prefix}<mark>{t.match}</mark>{t.suffix}</blockquote>
          <button type="button" className="sampleButton" disabled={busy} onClick={() => {
            const sample = t.prefix + t.match + t.suffix;
            setText(sample);
            document.getElementById('checker')?.scrollIntoView({ block: 'start' });
            void analyze(sample);
          }}>{t.trySample} <span aria-hidden="true">↗</span></button>
        </div>
      </aside>
    </main></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
