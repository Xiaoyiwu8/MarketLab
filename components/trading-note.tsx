'use client';
import type {Series} from '@/lib/engine';
import {volumeNarrative} from '@/lib/volume';
import {channelReading} from '@/lib/channel';
import {weeks} from '@/lib/review';
function Channel({reading,label,period}:{reading:ReturnType<typeof channelReading>;label:string;period:string}){
  if(!reading)return <div><h3>{label}</h3><p>需要至少21根有效完整{period}线，当前样本不足。</p></div>;
  const c=reading,lo=Math.min(...c.closes,c.intercept-c.halfWidth,c.lower),hi=Math.max(...c.closes,c.intercept+c.halfWidth,c.upper);
  const y=(v:number)=>110-(v-lo)/(hi-lo||1)*100;
  const points=c.closes.map((v,i)=>`${10+i*18},${y(v)}`).join(' ');
  return <div><h3>{label} · {c.direction}</h3><p>{c.position}</p>
    <svg viewBox="0 0 380 120" style={{width:'100%',maxWidth:600,height:150}} role="img" aria-label={`${label}：收盘价与统计趋势线及上下沿`}>
      <path d={`M10 ${y(c.intercept+c.halfWidth)} L370 ${y(c.upper)} L370 ${y(c.lower)} L10 ${y(c.intercept-c.halfWidth)} Z`} fill="currentColor" opacity="0.08"/>
      {[-1,0,1].map(k=><line key={k} x1="10" x2="370" y1={y(c.intercept+k*c.halfWidth)} y2={y(c.intercept+c.slope*20+k*c.halfWidth)} stroke="currentColor" opacity="0.5" strokeDasharray={k===0?'5 4':'2 3'}/>)}
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2"/>
    </svg>
    <p>实线为收盘价，虚线为统计趋势线及上下沿。参考下沿 ${c.lower.toFixed(2)} / 上沿 ${c.upper.toFixed(2)} · 每{period}斜率 {c.slopePct.toFixed(2)}%。</p>
    <small>最新观察K线截至 {c.date}；拟合窗口 {c.start}—{c.end}，不含最新观察K线。</small>
  </div>;
}
export default function TradingNote({series}:{series:Series}){
  const now=new Date(),s=volumeNarrative(series.bars,now,series.assetClass==='crypto'?'UTC':'America/New_York');
  if(!s.last)return <section className="panel">暂无完整日线，无法生成交易量说明。</section>;
  const channel=channelReading(s.completed),weekly=channelReading(weeks(s.completed,now,series.assetClass==='crypto'?'UTC':'America/New_York'));
  const n=(v:number)=>v.toLocaleString('zh-CN',{maximumFractionDigits:0}),unit=series.assetClass==='crypto'?'基础币单位':'股';
  const historical=now.getTime()-Date.parse(s.last.date)>7*864e5||/演示|合成/.test(series.source);
  return <section className="panel" aria-label="个股交易说明"><h2>{series.symbol} · 交易说明</h2>
    <Channel reading={channel} label="日线 · 20个交易日趋势通道" period="日"/>
    <Channel reading={weekly} label="周线 · 20个完整交易周趋势通道" period="周"/>
    <details><summary>日线 / 周线判定口径</summary><p>各自以前20根完整K线收盘做线性回归，边界取两倍残差标准差，最小半宽为平均K线振幅的一半。拟合R²≥0.35且每根K线斜率绝对值≥均价的0.1%才区分升降，否则方向不明确。周线按周一分组，保守排除本周，股票使用美东日期，数字货币使用UTC日期。日线与周线独立判断，方向可能不同。边界被突破时需重新观察；这些统计阈值未验证盈利表现，不是手工确认的趋势线或买卖信号。</p></details>
    <p><strong>{historical?'历史样本 · ':''}{s.last.date}成交量 {n(s.last.volume)} {unit}，{s.ratioPct===null?'历史不足20个基准交易日或均量为零，暂不计算比例。':<>为此前20个交易日均量的 {s.ratioPct.toFixed(1)}%（{s.ratio!.toFixed(2)}倍），属于{s.volumeState}。</>}</strong></p>
    <p>{s.priceChange===null?'缺少前收盘，无法比较涨跌。':`当日收盘较前收盘${s.priceState} ${(Math.abs(s.priceChange)*100).toFixed(2)}%，量价状态：${s.priceState}、${s.volumeState}。`}成交量仅反映活跃度，不单独构成买卖点，也不能证明主力吸筹或出货。</p>
    <small>“月均量”采用此前20个交易日的日均量，排除被比较当天，不是自然月总量。基准 {s.completed.slice(-21,-1)[0]?.date??'—'} 至 {s.previous?.date??'—'}，均量 {s.average20===null?'不可用':n(s.average20)} {unit}。≥120%为放量、≤80%为缩量，属于描述阈值。</small>
    <p className="fineprint">{series.source} · {series.adjustment}。这里使用最新完整日线；未接入可靠盘中累计成交量，不能把这条数值称为今天实时量比。仅刷新报价不会更新历史成交量。</p>
  </section>;
}
