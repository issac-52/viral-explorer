import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { copy, type Language } from './copy';
import * as Tabs from '@radix-ui/react-tabs';
import { ScanText, ArrowUpRight, ArrowRight, Globe2, Quote, TextSearch, LoaderCircle } from 'lucide-react';
import { readRecent, recentKey, remember } from './recent';
import './style.css';

import type { Excerpt } from '../worker/rules';

type Analysis = { id: string; evidence: string[]; excerpts?: Excerpt[] };
function App() {
  const initialLanguage = localStorage.getItem('language') || navigator.language.split('-')[0];
  const [lang, setLang] = useState<Language>(initialLanguage === 'en' || initialLanguage === 'ja' ? initialLanguage : 'ko');
  const [recent, setRecent] = useState(readRecent);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (!event.key || event.key === recentKey) setRecent(readRecent());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'error' | 'limited' | 'manual' | null>(null);
  const [example, setExample] = useState('direct');
  const t = copy[lang];
  const prefix = example === 'direct' ? t.prefix : t.quotePrefix;
  const suffix = example === 'direct' ? t.suffix : t.quoteSuffix;
  const excerpts: Excerpt[] = analysis?.excerpts ?? analysis?.evidence.map(match => ({ before: '', match, after: '' })) ?? [];
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
      setRecent(remember(data.id, input, recent));
      history.replaceState(null, '', '?result=' + data.id);
    } catch { setError('error'); }
    finally { setBusy(false); }
  }
  return <>
    <header><div className="bar">
      <a className="brand" href="./"><ScanText aria-hidden="true"/><b>ExitViral</b></a>
      <nav><a href="#checker">{t.nav}</a><a href="#example">{t.example}</a></nav>
      <div className="language"><Globe2 size={17} aria-hidden="true"/><select aria-label={t.language} value={lang} onChange={e => setLang(e.target.value as Language)}>
        <option value="ko">한국어</option><option value="ja">日本語</option><option value="en">English</option>
      </select></div></div></header>
    <main>
      <div className="hero">
        <div className="heading"><h1>{t.lead}<br/><em>{t.accent}</em></h1><p>{t.summary}</p></div>
        <aside id="example"><Tabs.Root value={example} onValueChange={setExample}>
          <div className="paperTop"><Quote aria-hidden="true"/><h2>{t.example}</h2></div>
          <Tabs.List aria-label={t.example}>
            <Tabs.Trigger value="direct">{t.direct}</Tabs.Trigger>
            <Tabs.Trigger value="quotation">{t.quotation}</Tabs.Trigger>
          </Tabs.List>
          {['direct', 'quotation'].map(kind => <Tabs.Content key={kind} value={kind}>
            <blockquote>{prefix}<mark>{t.match}</mark>{suffix}</blockquote>
            <button type="button" className="sampleButton" disabled={busy} onClick={() => {
              const sample = prefix + t.match + suffix;
              setText(sample);
              void analyze(sample);
            }}>{t.trySample}<ArrowUpRight size={17}/></button>
          </Tabs.Content>)}
        </Tabs.Root></aside>
      </div>
        <form id="checker" onSubmit={e => { e.preventDefault(); void analyze(text); }}>
          <h2><TextSearch aria-hidden="true"/>{t.formTitle}</h2><label htmlFor="review">{t.label}</label>
          <textarea id="review" value={text} maxLength={20000} disabled={busy} placeholder={t.placeholder} onChange={e => setText(e.target.value)} />
          <div className="actions"><small>{text.length.toLocaleString(lang)} / 20,000</small>
            <button disabled={busy || !text.trim()}>{busy ? t.busy : t.run}{busy ? <LoaderCircle className="spinner" size={18}/> : <ArrowRight size={18}/>}</button></div>
        </form>
      <div aria-live="polite">{error && <p role="alert">{t[error]}</p>}
        {analysis && <section id="analysis-result" tabIndex={-1} aria-labelledby="result-title"><h2 id="result-title">{analysis.evidence.length ? t.found : t.empty}</h2>
          {excerpts.map(({ before, match, after, context }, index) => <blockquote key={index}>
            <small>{context ? t[context] : t.wording}</small>
            {before}<mark>{match}</mark>{after}</blockquote>)}<p>{t.note}</p></section>}
      </div>

      <section className="recent" aria-labelledby="recent-title">
        <h2 id="recent-title">{t.recent}</h2>
        {recent.length === 0 ? <p>{t.noRecent}</p> :
          <ol>{recent.map(item => <li key={item.source ?? item.id}>
            <a className="recentResult" href={'?result=' + encodeURIComponent(item.id)}>{item.label}</a>
            {item.source && <a className="recentSource" href={item.source} target="_blank" rel="noreferrer">{t.source}<ArrowUpRight size={15}/></a>}
          </li>)}</ol>}
      </section>
    </main></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
