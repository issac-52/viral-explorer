import React, { useState } from 'react';
import { Check, Copy, Sparkles } from 'lucide-react';
import type { Excerpt } from '../worker/rules';
import type { AiResult } from '../worker/ai';
import type { copy } from './copy';

export type Analysis = { id: string; evidence: string[]; excerpts?: Excerpt[]; ai?: AiResult | null };
type Copy = (typeof copy)[keyof typeof copy];
type Status = 'disclosed' | 'check' | 'none';

// The summary never says "not an ad": a missing disclosure is not evidence of
// an honest review, only of a missing disclosure.
export function statusOf(excerpts: Excerpt[], ai?: AiResult | null): Status {
  if (excerpts.some(item => !item.link && !item.context) || ai?.verdict === 'disclosed') return 'disclosed';
  if (ai?.verdict === 'unclear' || excerpts.length) return 'check';
  return 'none';
}

function Quote({ excerpt, label, variant }: { excerpt: Excerpt; label: string; variant: string }) {
  return <blockquote className={variant}>
    <small>{label}</small>
    {excerpt.before}<mark>{excerpt.match}</mark>{excerpt.after}
  </blockquote>;
}

export function Result({ analysis, t }: { analysis: Analysis; t: Copy }) {
  const [copied, setCopied] = useState(false);
  const excerpts: Excerpt[] = analysis.excerpts ?? analysis.evidence.map(match => ({ before: '', match, after: '' }));
  const ai = analysis.ai;
  const status = statusOf(excerpts, ai);
  const direct = excerpts.filter(item => !item.link && !item.context);
  const hinted = excerpts.filter(item => !item.link && item.context);
  const links = excerpts.filter(item => item.link);
  // Hide the AI quote when a rule already shows the same wording.
  const aiExcerpt = ai?.excerpt && !excerpts.some(item => item.match.includes(ai.excerpt!.match) || ai.excerpt!.match.includes(item.match))
    ? ai.excerpt : undefined;

  async function copyLink() {
    const url = location.origin + location.pathname + '?result=' + analysis.id;
    try { await navigator.clipboard.writeText(url); }
    catch { window.prompt(t.copyLink, url); return; }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return <section id="analysis-result" tabIndex={-1} aria-labelledby="result-title">
    <div className={'summary ' + status}>
      <div>
        <h2 id="result-title">{t.status[status].title}</h2>
        <p>{t.status[status].detail}</p>
      </div>
      <button type="button" className="copy" onClick={copyLink}>
        {copied ? <Check size={16} aria-hidden="true"/> : <Copy size={16} aria-hidden="true"/>}{copied ? t.copied : t.copyLink}
      </button>
    </div>

    {direct.map((item, i) => <Quote key={'d' + i} excerpt={item} label={t.wording} variant="direct" />)}
    {aiExcerpt && <Quote excerpt={aiExcerpt} label={t.aiFound + (ai?.kind ? ' · ' + t.kinds[ai.kind] : '')} variant="ai" />}
    {hinted.map((item, i) => <Quote key={'h' + i} excerpt={item} label={t[item.context!]} variant="hinted" />)}
    {links.map((item, i) => <Quote key={'l' + i} excerpt={item} label={t[item.link!]} variant="link" />)}

    {ai && <p className="aiNote"><Sparkles size={15} aria-hidden="true"/>{
      ai.verdict === 'disclosed' ? (aiExcerpt ? t.aiDisclosed : t.aiConfirms)
      : ai.verdict === 'unclear' ? t.aiUnclear : t.aiNone}</p>}
    <p className="note">{links.length ? t.linkNote + ' ' : ''}{t.note}</p>
  </section>;
}
