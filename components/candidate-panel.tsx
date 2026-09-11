'use client';
import type { Series } from '@/lib/engine';
import { representatives } from '@/lib/representatives';

export default function CandidatePanel({ data, onSelect, onScan, busy }: { data: Series[]; onSelect: (symbol: string) => void; onScan?: () => void; busy: boolean }) {
  const candidates=representatives(data);
  const money=(n:number|null|undefined)=>n!=null&&Number.isFinite(n)?`$${n.toFixed(2)}`:'未确定';
  return <section className="panel" style={{border:'2px solid #4f9b86',marginBottom:24}} aria-label="股票代表机会">
    <div className="row" style={{justifyContent:'space-between'}}><div><p className="eyebrow">STOCK WATCHLIST · PAPER ONLY</p><h2>左侧 / 右侧代表股票 · 各2多2空，合计最多8只</h2></div>{onScan&&<button onClick={onScan} disabled={busy}>重新扫描 →</button>}</div>
    <p>先展示条件已满足的股票，再补充观察对象。条件完成度＝已满足项 / 总项，不是上涨概率、下跌概率或胜率；100%也只代表日线技术条件满足。缺少关键确认时仍为“条件不足”。行情、复权、历史或流动性不合格不补位。同一方向去重，不同方向代表独立情景，不是同时开仓建议。</p>
    <p>左侧观察支撑/压力反转；右侧观察突破回踩确认。各组内优先按状态、完成比例、参考收益风险比排序，再按成交额及代码稳定排序。每组条件不同，百分比不用于比较策略优劣。策略尚未完整回测，不是严格缠论三买/三卖。</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))',gap:20}}>
      {(['left','right'] as const).flatMap(group=>(['long','short'] as const).map(side=><div key={group+side} style={{padding:20,border:'1px solid #64748b',borderRadius:12}}>
        <h2>{group==='left'?'左侧':'右侧'} · {side==='long'?'↗ 做多观察':'↘ 做空观察'} · {candidates[group][side].length}/2</h2>
        {!candidates[group][side].length&&<p>有效数据或可分配的独立股票不足，本组暂留空。</p>}
        {candidates[group][side].map(item=><article key={item.series.symbol} style={{borderTop:'1px solid #64748b',paddingTop:12,marginTop:16}}>
          <h3>{item.series.symbol} · {item.strategy}</h3>
          <p><strong>{item.status} · 条件完成度 {item.completion}%（{item.passed}/{item.total}项）</strong></p>
          <p>{item.ready?'日线技术条件已满足，入场前仍须核验当前价格、大盘与事件。':'观察候选，不宜据此入场。等待下列缺失条件，不自动下单。'}</p>
          <p>尚缺：{item.checks.filter(c=>!c.pass).map(c=>c.label).join('；')||'无缺失技术条件；事件及实际成交条件尚未核验'}</p>
          <details><summary>查看 {item.series.symbol} 的本策略详细条件</summary>
            <p>形态日 {item.date??'未形成'} · 确认日 {item.confirmationDate??'未确认'} · 原结构边界 {money(item.boundary)}</p>
            <ul>{item.checks.map(c=><li key={c.label}>{c.pass?'✓':'○'} {c.label}</li>)}</ul>
            {item.ready?<p>本策略参考止损 {money(item.stop)} · 原结构目标 {money(item.target)} · 收益风险比 {item.rr?.toFixed(2)}。需核查目标前是否出现新的支撑或压力；触及止损或目标后重新评估。</p>:<p>尚无已确认的入场计划。结构边界仅供观察，不能直接当作触发价、止损或目标。</p>}
            <p>左侧退出依据本次反转结构；右侧退出依据突破回踩结构。下方通用趋势指标使用另一套规则，其“回补/持有”不作为本策略退出指令。</p>
          </details>
          <p>最新完整日线 {item.series.bars.at(-1)?.date} · 收盘 {money(item.series.bars.at(-1)?.close)}</p>
          <small>{item.series.source} · 最新参考价时间 {item.series.quote?.time??'不可用'} · {item.series.adjustment}</small>
          {side==='short'&&<p>借券及费用尚未核验；股票模拟账户不支持开空。</p>}
          <button className="secondary" onClick={()=>onSelect(item.series.symbol)}>加载 {item.series.symbol} 图表与通用趋势指标</button>
        </article>)}
      </div>))}
    </div>
  </section>;
}
