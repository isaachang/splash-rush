/* ============================================================ DIRECTOR PANEL  (press ` in a match)
   First press: the essentials - the tier and where everyone sits on the 0-2.5 ruler (the bots' levels, and
   an estimate of how the player is playing - shown only, nothing is steered by it), the player's tension
   (the music follows it), the score and how each side is playing it, and what the other side has read and
   is doing.  Second press: the details - every signal, the last duels, all seven bots and what each is up
   to.  Third press: off.  Everything reads from the modules; nothing here decides anything.             */
const DirPanel = {
  view: 0, t: 0,
  toggle() { this.view = (this.view + 1) % 3; const p = $('dirPanel'); p.classList.toggle('show', this.view > 0); p.classList.toggle('full', this.view === 2); this.t = 0; },
  esc(s) { return String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'); },
  pct(v) { return Math.round(v * 100) + '%'; },
  x(v) { return (clamp(v, 0, LV_MAX) / LV_MAX * 100).toFixed(1) + '%'; },        // a level as a position on the ruler
  tierCls(v) { return v < 0.65 ? 'e' : v < 1.25 ? 'n' : v < 1.75 ? 'k' : 'h'; },
  update(dt) {
    if (!this.view || (this.t -= dt) > 0 || !PLAYER || !Director.st) return; this.t = 0.25;
    $('dirPanel').innerHTML = this.render();
  },
  render() {
    const D = Director, md = D.mode(), f2 = v => v.toFixed(2), tier = D.tierOf();
    const mates = D.bots().filter(b => b.c.team === PLAYER.team), foes = D.enemies(), avg = a => a.length ? a.reduce((s, b) => s + D.lvOf(b.c), 0) / a.length : 1;
    const left = Math.max(0, D.calibT - G.time), state = D.cheat ? ['bad', '后门 · 不计入存档'] : D.idle() ? ['bad', '挂机不计'] : left > 0 ? ['warm', '校准中 ' + Math.ceil(left) + 's'] : D.conf < 0.3 ? ['warm', '数据不足'] : ['ok', '已校准'];
    const save = D.saved ? '已存 ' + f2(D.saved.s) : D.mem ? '存档 ' + f2(D.mem.s) + ' · ' + (D.mem.m || 1) + ' 局' : D.seed != null ? '首次 · 参考 ' + f2(D.seed) : '无存档';
    let h = `<div class="dp-head"><b>导演台</b><span class="dp-chip">${md === 'fixed' ? '测试固定档' : tier.name + ' ' + f2(tier.lv)}</span><span class="dp-chip dim">${this.esc(D.loadoutName(D.key))} · ${save}</span></div>`;
    // ---- the ruler: each tier's spread of bot levels, the bots, and the estimate of the player
    const zones = TIERS.map((t, i) => `<i class="z ${this.tierCls(t.lv)}${md === i ? ' sel' : ''}" style="left:${this.x(t.lv - D.SPREAD)};width:calc(${this.x(t.lv + D.SPREAD)} - ${this.x(t.lv - D.SPREAD)})"></i>`).join('');
    const mk = (v, cls, lab) => `<em class="mk ${cls}" style="left:${this.x(v)}"><u>${lab}</u></em>`;
    h += `<div class="dp-lv"><div class="dp-big"><span class="${this.tierCls(D.skill)}">${f2(D.skill)}</span><small>你的发挥 · 约等于${D.tier(D.skill)}</small><i class="dp-state ${state[0]}">${state[1]}</i></div>
      <div class="dp-ruler">${zones}${mk(avg(foes), 'foe', '敌')}${mk(avg(mates), 'mate', '友')}${mk(D.skill, 'me', '你')}<b class="conf" style="width:${this.pct(D.conf)}"></b></div>
      <div class="dp-scale">${TIERS.map(t => `<span style="left:${this.x(t.lv)}">${t.name}</span>`).join('')}</div></div>`;
    // ---- tension (the music follows it)
    const P = Pacing, spark = P.hist.length > 1 ? P.hist.map((v, i) => `${(i / (P.hist.length - 1) * 100).toFixed(1)},${(22 - v * 20).toFixed(1)}`).join(' ') : '';
    h += `<div class="dp-row"><label>紧张度</label><div class="dp-meter"><b style="width:${this.pct(P.tension)}"></b><svg viewBox="0 0 100 24" preserveAspectRatio="none"><polyline points="${spark}"/></svg></div><small>${f2(P.tension)} · 音乐跟着走</small></div>`;
    // ---- the score, and how each side plays it
    const lead = D.lead, w = clamp(50 + lead * 150, 4, 96), pf = D.pf || [0, 0], pfs = f => Math.abs(f) < 0.05 ? '' : f > 0 ? '抢地' : '守地';
    h += `<div class="dp-row"><label>比分</label><div class="dp-tug"><b style="width:${w}%"></b><span>${lead >= 0 ? '领先' : '落后'} ${this.pct(Math.abs(lead))}</span></div><small>敌 ${f2(avg(foes))} · 友 ${f2(avg(mates))}</small></div>`;
    const tags = [pfs(pf[1 - PLAYER.team]) && '敌在' + pfs(pf[1 - PLAYER.team]), pfs(pf[PLAYER.team]) && '友在' + pfs(pf[PLAYER.team])].filter(Boolean);
    if (tags.length) h += `<div class="dp-tags">${tags.map(t => `<span>${t}</span>`).join('')}</div>`;
    // ---- who has the player in their sights, and who is looking for them
    const on = foes.filter(b => b.enemy === PLAYER).length, look = foes.filter(b => b.dState === 'alert' && b.alert && b.alert.e === PLAYER).length;
    h += `<div class="dp-row"><label>盯你</label><div class="dp-tags tight"><span>交火 ${on}</span><span>在找你 ${look}</span></div></div>`;
    // ---- what the other side has read, and its plan
    const S = Strategist.view();
    if (S) h += `<div class="dp-row top"><label>对面</label><div class="dp-read">${S.tags.length ? S.tags.map(([n, v]) => `<span class="dp-bar"><i style="width:${this.pct(v)}"></i>${n}</span>`).join('') : `<small>${S.wait}</small>`}<div class="dp-plan">${S.plan ? `<b>${S.plan}</b>` : '<b class="dim">无对策</b>'}<small>${S.note}</small></div></div></div>`;
    else if (md === 0) h += `<div class="dp-row"><label>对面</label><small style="margin-left:0">轻松档不针对你的打法</small></div>`;
    if (this.view < 2) return h + '<div class="dp-foot">再按 ` 看详细 · 再按一次关闭</div>';
    // ================= details, in a second column beside the essentials
    const ess = h; h = '';
    const SN = { paint: '涂地', dmg: '伤害比', surv: '存活', hit: '命中', know: '熟练' };
    const sig = [['交火积分', D.elo, 0.6 + D.n * 0.5]].concat(Object.keys(SN).filter(k => D.sig[k]).map(k => [SN[k], D.sig[k].v, D.sig[k].w]));
    h += `<div class="dp-sec">发挥估计 <small>只显示，不影响对局</small></div><div class="dp-sig">${sig.map(([n, v, wt]) => `<div><label>${n}</label><span class="tr"><i class="${this.tierCls(v)}" style="width:${this.x(v)}"></i></span><b>${f2(v)}</b><small>×${wt.toFixed(1)}</small></div>`).join('')}</div>`;
    h += `<div class="dp-sec">最近交火 <small>本局 ${D.nm.toFixed(1)} 次 · 数字是事先估计你赢的概率</small></div><div class="dp-duels">${D.log.length ? D.log.slice().reverse().map(l => `<span class="${l.o > 0.5 ? 'w' : l.o < 0.5 ? 'l' : 'd'}${l.w < 1 ? ' lite' : ''}"><b>${l.o > 0.5 ? '赢' : l.o < 0.5 ? '输' : '平'}</b>${this.pct(l.p)}</span>`).join('') : '<small>还没有</small>'}</div>`;
    const STN = { fight: '交火', alert: '警觉', away: '巡逻', respawn: '复活' }, JOB = { paint: '抢地', hunt: '围猎', flank: '绕后', block: '封路', retake: '反推' };
    const temper = b => { const t = b.trait; return !t ? '' : t.aggr > 0.4 ? '冲' : t.aggr < -0.4 ? '稳' : t.care > 0.5 ? '惜命' : ''; };
    const bot = b => { const lv = D.lvOf(b.c), tp = temper(b); return `<div class="dp-bot"><i class="st ${b.dState || 'away'}" title="${STN[b.dState] || ''}"></i><span class="nm">${this.esc(b.c.name)}</span><span class="lvp ${this.tierCls(lv)}">${f2(lv)}</span>${tp ? `<em>${tp}</em>` : ''}${b.task ? `<em>${JOB[b.task.id] || ''}</em>` : ''}${b.enemy === PLAYER ? '<em class="tok">打你</em>' : ''}</div>`; };
    h += `<div class="dp-sec">机器人 <small>本局固定 · 各有手感和脾气</small></div><div class="dp-bots"><div>${mates.map(bot).join('')}</div><div>${foes.map(bot).join('')}</div></div>`;
    h += `<div class="dp-legend"><i class="st fight"></i>交火 <i class="st alert"></i>警觉（听到/刚跟丢）<i class="st away"></i>巡逻 <i class="st respawn"></i>复活</div>`;
    return `<div class="dp-cols"><div class="dp-col">${ess}</div><div class="dp-col">${h}</div></div><div class="dp-foot">再按 ` + '`' + ` 关闭</div>`;
  }
};
