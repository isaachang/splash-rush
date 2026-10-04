/* ============================================================ DIRECTOR PANEL  (press ` in a match)
   First press: the essentials at a glance - where the player's level sits on the 0-2.5 ruler (tier zones,
   the chosen tier's range outlined, the opponents' and teammates' levels beside it), the rhythm of the
   match, the score and what is being done about it, how many may shoot at the player, and what the other
   side has read and is doing.  Second press: the details - every signal, the last duels, all seven bots.
   Third press: off.  Everything reads from the modules; nothing here decides anything.                    */
const DirPanel = {
  view: 0, t: 0,
  toggle() { this.view = (this.view + 1) % 3; const p = $('dirPanel'); p.classList.toggle('show', this.view > 0); p.classList.toggle('full', this.view === 2); this.t = 0; },
  esc(s) { return String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'); },
  pct(v) { return Math.round(v * 100) + '%'; },
  x(v) { return (clamp(v, 0, LV_MAX) / LV_MAX * 100).toFixed(1) + '%'; },        // a level as a position on the ruler
  tierCls(v) { return v < 0.65 ? 'e' : v < 1.65 ? 'n' : 'h'; },
  update(dt) {
    if (!this.view || (this.t -= dt) > 0 || !PLAYER || !Director.st) return; this.t = 0.25;
    $('dirPanel').innerHTML = this.render();
  },
  render() {
    const D = Director, md = D.mode(), [lo, hi] = D.band(), f2 = v => v.toFixed(2), sgn = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);
    const modeTxt = md === 'smart' ? '智能' : md === 'fixed' ? '测试固定档' : ['轻松', '普通', '地狱'][md];
    const mates = D.bots().filter(b => b.c.team === PLAYER.team), foes = D.enemies(), avg = a => a.length ? a.reduce((s, b) => s + (b.lv ?? D.skill), 0) / a.length : D.skill;
    const left = Math.max(0, D.calibT - G.time), state = D.cheat ? ['bad', '后门 · 不计入存档'] : D.idle() ? ['bad', '挂机不计'] : left > 0 ? ['warm', '校准中 ' + Math.ceil(left) + 's'] : D.conf < 0.3 ? ['warm', '数据不足'] : ['ok', '已校准'];
    const save = D.saved ? '已存 ' + f2(D.saved.s) : D.mem ? '存档 ' + f2(D.mem.s) + ' · ' + (D.mem.m || 1) + ' 局' : D.seed != null ? '首次 · 参考 ' + f2(D.seed) : '无存档';
    let h = `<div class="dp-head"><b>导演台</b><span class="dp-chip">${modeTxt} ${md === 'fixed' ? '' : lo + '~' + hi}${md === 2 ? ' · 只升不降' : ''}</span><span class="dp-chip dim">${this.esc(D.loadoutName(D.key))} · ${save}</span></div>`;
    // ---- the level ruler
    const zones = D.BANDS.map((b, i) => `<i class="z ${'enh'[i]}${md === i ? ' sel' : ''}" style="left:${this.x(b[0])};width:calc(${this.x(b[1])} - ${this.x(b[0])})"></i>`).join('');
    const mk = (v, cls, lab) => `<em class="mk ${cls}" style="left:${this.x(v)}"><u>${lab}</u></em>`;
    h += `<div class="dp-lv"><div class="dp-big"><span class="${this.tierCls(D.skill)}">${f2(D.skill)}</span><small>${D.tier(D.skill)}</small><i class="dp-state ${state[0]}">${state[1]}</i></div>
      <div class="dp-ruler">${zones}${mk(avg(foes), 'foe', '敌')}${mk(avg(mates), 'mate', '友')}${mk(D.skill, 'me', '你')}<b class="conf" style="width:${this.pct(D.conf)}"></b></div>
      <div class="dp-scale"><span>0 轻松</span><span>1 普通</span><span>2 地狱</span><span>2.5</span></div></div>`;
    // ---- rhythm
    const P = Pacing, ph = P.phase, spark = P.hist.length > 1 ? P.hist.map((v, i) => `${(i / (P.hist.length - 1) * 100).toFixed(1)},${(22 - v * 20).toFixed(1)}`).join(' ') : '';
    h += `<div class="dp-row"><label>节奏</label><div class="dp-phases">${['build', 'peak', 'relax'].map(k => `<span class="${k}${ph === k ? ' on' : ''}">${PHASE_NAME[k]}</span>`).join('<i>›</i>')}${ph === 'final' ? '<span class="final on">终局</span>' : ''}</div><small>${P.on ? (ph === 'final' ? '' : '还剩 ' + Math.ceil(P.remaining()) + 's') + ' · 第 ' + Math.max(1, P.waves) + ' 波' : '未启用'}</small></div>`;
    h += `<div class="dp-row"><label>紧张度</label><div class="dp-meter"><b style="width:${this.pct(P.tension)}"></b><svg viewBox="0 0 100 24" preserveAspectRatio="none"><polyline points="${spark}"/></svg></div><small>${f2(P.tension)}</small></div>`;
    // ---- the score and what is done about it
    const lead = D.lead, w = clamp(50 + lead * 150, 4, 96), pf = D.pf || [0, 0], pfs = f => Math.abs(f) < 0.05 ? '' : f > 0 ? '专心涂地' : '收着打';
    h += `<div class="dp-row"><label>比分</label><div class="dp-tug"><b style="width:${w}%"></b><span>${lead >= 0 ? '领先' : '落后'} ${this.pct(Math.abs(lead))}</span></div><small>敌 ${sgn(D.corrE)} 友 ${sgn(D.corrM)}</small></div>`;
    const tags = [pfs(pf[1 - PLAYER.team]) && '敌：' + pfs(pf[1 - PLAYER.team]), pfs(pf[PLAYER.team]) && '友：' + pfs(pf[PLAYER.team]), D.boost > 1.01 && '视野外加速 ×' + D.boost.toFixed(1)].filter(Boolean);
    if (tags.length) h += `<div class="dp-tags">${tags.map(t => `<span>${t}</span>`).join('')}</div>`;
    // ---- combat
    const C = Combat.view();
    if (C) h += `<div class="dp-row"><label>打你</label><div class="dp-dots">${Array.from({ length: C.cap }, (_, i) => `<i class="${i < C.used ? 'on' : ''}"></i>`).join('')}${C.waiting ? `<small>+${C.waiting} 在等</small>` : ''}</div><div class="dp-tags tight">${[C.warn && `警告射击 ×${C.warn}`, C.grace && '残血喘息', C.support && `队友支援 ×${C.support}`].filter(Boolean).map(t => `<span>${t}</span>`).join('')}</div></div>`;
    // ---- what the other side has read, and its plan
    const S = Strategist.view();
    if (S) h += `<div class="dp-row top"><label>对面</label><div class="dp-read">${S.tags.length ? S.tags.map(([n, v]) => `<span class="dp-bar"><i style="width:${this.pct(v)}"></i>${n}</span>`).join('') : `<small>${S.wait}</small>`}<div class="dp-plan">${S.plan ? `<b>${S.plan}</b>` : '<b class="dim">无对策</b>'}<small>${S.note}</small></div></div></div>`;
    if (this.view < 2) return h + '<div class="dp-foot">再按 ` 看详细 · 再按一次关闭</div>';
    // ================= details, in a second column beside the essentials
    const ess = h; h = '';
    const SN = { paint: '涂地', dmg: '伤害比', surv: '存活', hit: '命中', know: '熟练' };
    const sig = [['交火积分', D.elo, 0.6 + D.n * 0.5]].concat(Object.keys(SN).filter(k => D.sig[k]).map(k => [SN[k], D.sig[k].v, D.sig[k].w]));
    h += `<div class="dp-sec">评分依据</div><div class="dp-sig">${sig.map(([n, v, wt]) => `<div><label>${n}</label><span class="tr"><i class="${this.tierCls(v)}" style="width:${this.x(v)}"></i></span><b>${f2(v)}</b><small>×${wt.toFixed(1)}</small></div>`).join('')}</div>`;
    h += `<div class="dp-sec">最近交火 <small>本局 ${D.nm.toFixed(1)} 次 · 数字是事先估计你赢的概率</small></div><div class="dp-duels">${D.log.length ? D.log.slice().reverse().map(l => `<span class="${l.o > 0.5 ? 'w' : l.o < 0.5 ? 'l' : 'd'}${l.w < 1 ? ' lite' : ''}"><b>${l.o > 0.5 ? '赢' : l.o < 0.5 ? '输' : '平'}</b>${this.pct(l.p)}</span>`).join('') : '<small>还没有</small>'}</div>`;
    const STN = { fight: '交火', seen: '视野内', away: '视野外', respawn: '复活' }, JOB = { paint: '抢地', hunt: '围猎', flank: '绕后', block: '封路', retake: '反推' };
    const bot = (b, goal) => `<div class="dp-bot"><i class="st ${b.dState || 'away'}" title="${STN[b.dState] || ''}"></i><span class="nm">${this.esc(b.c.name)}</span><span class="lvp ${this.tierCls(b.lv ?? goal)}">${f2(b.lv ?? goal)}</span>${b.support ? '<em>支援</em>' : b.task ? `<em>${JOB[b.task.id] || ''}</em>` : ''}${Combat.holders && Combat.holders.has(b) ? '<em class="tok">开火中</em>' : ''}</div>`;
    h += `<div class="dp-sec">机器人 <small>队友 → ${f2(D.mateGoal)} · 对手 → ${f2(D.target)}</small></div><div class="dp-bots"><div>${mates.map(b => bot(b, D.mateGoal)).join('')}</div><div>${foes.map(b => bot(b, D.target)).join('')}</div></div>`;
    h += `<div class="dp-legend"><i class="st fight"></i>交火 <i class="st seen"></i>视野内 <i class="st away"></i>视野外 <i class="st respawn"></i>复活</div>`;
    return `<div class="dp-cols"><div class="dp-col">${ess}</div><div class="dp-col">${h}</div></div><div class="dp-foot">再按 ` + '`' + ` 关闭</div>`;
  }
};
