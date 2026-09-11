'use client';
import type { Series } from '@/lib/engine';
import { stockCandidates } from '@/lib/candidates';

export default function CandidatePanel({ data, onSelect, onScan, busy }: { data: Series[]; onSelect: (symbol: string) => void; onScan?: () => void; busy: boolean }) {
  const candidates = stockCandidates(data);
  return <section className="panel" style={{border:'2px solid #4f9b86', marginBottom:24}} aria-label="股票买卖点推荐">
    <div className="row" style={{justifyContent:'space-between'}}><div><p className="eyebrow">STOCK SIGNALS · PAPER ONLY</p><h2>左侧 / 右侧机会 · 各2多2空，合计最多8只</h2></div>{onScan&&<button onClick={onScan} disabled={busy}>重新扫描 →</button>}</div>
    <p>左侧：低位支撑企稳/假跌破收回，或高位遇阻/假突破回落；检查近5日的形态。右侧：突破回踩后独立确认。确认后最多3个交易日仍须保持原结构、未触及目标且收益风险合格。四组各最多2只，同一方向去重，不凑数、不跨组补位；按各自第一目标的参考收益风险比排序，不能视为胜率。日线形态不能证明主力吸筹或散户割肉，也不是严格缠论三买/三卖。尚未验证盈利表现。完整覆盖数量、排除和失败统计见上方。</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))',gap:20}}>
      {(['left','right'] as const).flatMap(group=>(['long','short'] as const).map(side => <div key={group+side} style={{padding:20,border:'1px solid #64748b',borderRadius:12}}>
        <h2>{group==='left'?'左侧':'右侧'} · {side === 'long' ? '↗ 买入（做多）' : '↘ 卖出开仓（做空）'} · {candidates[group][side].length}/2</h2>
        {!candidates[group][side].length && <p>本组没有符合全部条件的股票，不凑数，不由其他组补足。</p>}
        {candidates[group][side].map(item => {
          const g = item.long!, plan = side === 'long' ? {stop:g.stop,target:g.target,rr:g.rewardRisk,checks:g.checks} : item.short!;
          return <article key={item.series.symbol} style={{borderTop:'1px solid #64748b',paddingTop:12,marginTop:16}}>
            <h3>{item.series.symbol} · {side==='long'?item.longStrategy:item.shortStrategy}</h3><p>形态起始日 {(side==='long'?item.longEvidence:item.shortEvidence).date} · 原区间边界 ${(side==='long'?item.longEvidence:item.shortEvidence).boundary?.toFixed(2)}</p><p>确认日 {(side==='long'?item.longEvidence:item.shortEvidence).confirmationDate} · 最新完整日线收盘价 ${g.last.close.toFixed(2)} · {g.last.date}</p>
            <p>参考止损 ${plan.stop.toFixed(2)} · 目标 ${plan.target.toFixed(2)} · 收益风险比 {plan.rr?.toFixed(2)}</p>
            <p>{plan.checks.filter(c=>c.pass).map(c=>c.label).join('；')}</p>
            <small>{item.series.source} · 最新参考价时间 {item.series.quote?.time ?? '不可用'}</small>
            <p>待核验大盘、事件与当前价格；日线信号不代表此刻仍在入场价位。{side === 'short' && '做空观察与持仓卖出不同；当前模拟账户不支持开空。'}</p>
            <button className="secondary" onClick={()=>onSelect(item.series.symbol)}>查看 {item.series.symbol} 的详细条件</button>
          </article>;
        })}
      </div>))}
    </div>
  </section>;
}
