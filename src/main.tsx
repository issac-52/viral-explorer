import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { copy, type Language } from './copy';
import * as Tabs from '@radix-ui/react-tabs';
import { ScanText, ArrowUpRight, ArrowRight, Globe2, Quote, History, LoaderCircle, Link2, Sparkles, FileText } from 'lucide-react';
import { forgetRecent, readRecent, recentKey, remember } from './recent';
import { Result, type Analysis } from './Result';
import './style.css';

const isUrl = (value: string) => /^https?:\/\/\S+$/i.test(value.trim());

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
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<'error' | 'limited' | 'manual' | null>(null);
  const [example, setExample] = useState('direct');
  const input = useRef<HTMLTextAreaElement>(null);
  const t = copy[lang];
  const prefix = example === 'direct' ? t.prefix : t.quotePrefix;
  const suffix = example === 'direct' ? t.suffix : t.quoteSuffix;
  const urlMode = isUrl(text);
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
  // Fetching a post and reading it with AI can take several seconds.
  useEffect(() => {
    if (!busy) { setSlow(false); return; }
    const timer = setTimeout(() => setSlow(true), 2500);
    return () => clearTimeout(timer);
  }, [busy]);

  async function analyze(value: string) {
    if (!value.trim() || busy) return;
    setBusy(true);
    setError(null);
    setAnalysis(null);
    history.replaceState(null, '', location.pathname);
    try {
      const response = await fetch('/api/analyses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isUrl(value) ? { url: value.trim() } : { text: value })
      });
      if (response.status === 422) { setError('manual'); return; }
      if (response.status === 429) { setError('limited'); return; }
      if (!response.ok) throw Error();
      const data: Analysis = await response.json();
      setAnalysis(data);
      setRecent(remember(data.id, value, recent));
      history.replaceState(null, '', '?result=' + data.id);
    } catch { setError('error'); }
    finally { setBusy(false); }
  }

  function switchToText() {
    setText('');
    setError(null);
    input.current?.focus();
  }

  return <>
    <header><div className="bar">
      <a className="brand" href="./"><ScanText aria-hidden="true"/><b>ExitViral</b></a>
      <nav><a href="#checker">{t.nav}</a><a href="#recent">{t.recent}</a></nav>
      <div className="language"><Globe2 size={17} aria-hidden="true"/><select aria-label={t.language} value={lang} onChange={e => setLang(e.target.value as Language)}>
        <option value="ko">한국어</option><option value="ja">日本語</option><option value="en">English</option>
      </select></div></div></header>
    <main>
      <div className="heading"><h1>{t.title}</h1><p>{t.summary}</p></div>
      <form id="checker" onSubmit={e => { e.preventDefault(); void analyze(text); }}>
        <label htmlFor="review">{t.label}</label>
        <textarea id="review" ref={input} value={text} maxLength={20000} disabled={busy} placeholder={t.placeholder}
          aria-describedby="input-mode" onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void analyze(text); } }} />
        <div className="actions">
          <small id="input-mode" className="mode">
            {text.trim()
              ? <>{urlMode ? <Link2 size={15} aria-hidden="true"/> : <FileText size={15} aria-hidden="true"/>}{urlMode ? t.modeUrl : t.modeText}</>
              : t.sites}
          </small>
          <div className="submit">
            {!urlMode && text && <small className="count">{text.length.toLocaleString(lang)} / 20,000</small>}
            <button disabled={busy || !text.trim()}>{busy ? t.busy : t.run}{busy ? <LoaderCircle className="spinner" size={18} aria-hidden="true"/> : <ArrowRight size={18} aria-hidden="true"/>}</button>
          </div>
        </div>
      </form>
      <p className="hint">{t.shortcut}</p>
      <div aria-live="polite">
        {busy && slow && <p className="progress"><Sparkles size={16} aria-hidden="true"/>{urlMode ? t.slowUrl : t.slowText}</p>}
        {error && <div role="alert"><p>{t[error]}</p>
          {error === 'manual' && <button type="button" className="textButton" onClick={switchToText}>{t.switchManual}<ArrowRight size={16} aria-hidden="true"/></button>}
        </div>}
        {analysis && <Result analysis={analysis} t={t} />}
      </div>

      <div className="details">
        <aside id="example"><Tabs.Root value={example} onValueChange={setExample}>
          <div className="panelTitle"><Quote aria-hidden="true"/><h2>{t.example}</h2></div>
          <Tabs.List aria-label={t.example}>
            <Tabs.Trigger value="direct">{t.direct}</Tabs.Trigger>
            <Tabs.Trigger value="quotation">{t.quotation}</Tabs.Trigger>
          </Tabs.List>
          {['direct', 'quotation'].map(kind => <Tabs.Content key={kind} value={kind}>
            <blockquote>{prefix}<mark>{t.match}</mark>{suffix}</blockquote>
            <button type="button" className="textButton" disabled={busy} onClick={() => {
              const sample = prefix + t.match + suffix;
              setText(sample);
              void analyze(sample);
            }}>{t.trySample}<ArrowUpRight size={17} aria-hidden="true"/></button>
          </Tabs.Content>)}
        </Tabs.Root></aside>
        <section id="recent" className="recent" aria-labelledby="recent-title">
          <div className="panelTitle"><History aria-hidden="true"/><h2 id="recent-title">{t.recent}</h2>
            {recent.length > 0 && <button type="button" className="textButton clear" onClick={() => setRecent(forgetRecent())}>{t.clearRecent}</button>}
          </div>
          {recent.length === 0 ? <p>{t.noRecent}</p> :
            <ol>{recent.map(item => <li key={item.source ?? item.id}>
              <a className="recentResult" href={'?result=' + encodeURIComponent(item.id)}>{item.label}</a>
              {item.source && <a className="recentSource" href={item.source} target="_blank" rel="noreferrer">{t.source}<ArrowUpRight size={15} aria-hidden="true"/></a>}
            </li>)}</ol>}
        </section>
      </div>
    </main></>;
}

createRoot(document.getElementById('root')!).render(<App/>);
