/* 面談思考マップ：共通の定義（出典の一覧・判定エンジン）
 * 収録内容は data/01〜10-*.js、判定ルールは data/rules.js に書く。 */
var GM = (function(){
  'use strict';
  var GM = { cats:[], rules:{}, goalKw:{} };

  GM.STAGES = ['無関心期','関心期','準備期','実行期','維持期'];

  /* 大項目の追加（並びは読み込み順＝画面の並び） */
  GM.add = function(cat){
    cat.mids.forEach(function(m){
      m.smalls.forEach(function(s){
        // sources はキー（GM.SRC）か {title,url,pub} のどちらでも書ける
        s.sources = (s.sources||[]).map(function(x){
          if(typeof x!=='string') return x;
          if(!GM.SRC[x]) throw new Error('出典キーが未登録: '+x);
          return GM.SRC[x];
        });
      });
    });
    GM.cats.push(cat);
  };

  /* ---------- 出典（公的機関・学会の資料。URL は 2026-10-24 に開けることを確認） ---------- */
  var M='https://www.mhlw.go.jp';
  GM.SRC = {
    program:   {title:'標準的な健診・保健指導プログラム（令和6年度版）', pub:'厚生労働省', url:M+'/content/10900000/001231390.pdf'},
    nippon21:  {title:'健康日本21（第三次）', pub:'厚生労働省', url:M+'/stf/seisakunitsuite/bunya/kenkou_iryou/kenkou/kenkounippon21_00006.html'},
    pa2023:    {title:'健康づくりのための身体活動・運動ガイド2023', pub:'厚生労働省', url:M+'/content/001194020.pdf'},
    pa_adult:  {title:'身体活動・運動ガイド2023 成人版', pub:'厚生労働省', url:M+'/content/001195866.pdf'},
    pa_muscle: {title:'身体活動・運動ガイド2023 筋力トレーニングについて', pub:'厚生労働省', url:M+'/content/001195869.pdf'},
    pa_work:   {title:'働く人が職場で活動的に過ごすためのポイント', pub:'厚生労働省', url:M+'/content/001195870.pdf'},
    sleep2023: {title:'健康づくりのための睡眠ガイド2023', pub:'厚生労働省', url:M+'/content/001305530.pdf'},
    sleep_leaf:{title:'Good Sleepガイド（ぐっすりガイド）成人版', pub:'厚生労働省', url:M+'/content/001288005.pdf'},
    alc_gl:    {title:'健康に配慮した飲酒に関するガイドライン', pub:'厚生労働省', url:M+'/content/12200000/001223643.pdf'},
    alc_pr:    {title:'みんなに知ってほしい飲酒のこと（広報資料）', pub:'厚生労働省', url:M+'/content/12200000/001368730.pdf'},
    dri2025:   {title:'日本人の食事摂取基準（2025年版）', pub:'厚生労働省', url:M+'/stf/newpage_44138.html'},
    balance:   {title:'食事バランスガイド', pub:'農林水産省', url:'https://www.maff.go.jp/j/balance_guide/'},
    jsh2019:   {title:'高血圧治療ガイドライン2019', pub:'日本高血圧学会', url:'https://www.jpnsh.jp/data/jsh2019/JSH2019_hp.pdf'},
    jsh_salt:  {title:'さあ、減塩！（一般のみなさまへ）', pub:'日本高血圧学会', url:'https://www.jpnsh.jp/general_salt.html'},
    jas2022:   {title:'動脈硬化性疾患予防ガイドライン2022年版', pub:'日本動脈硬化学会', url:'https://www.j-athero.org/jp/jas_gl2022/'},
    jds2024:   {title:'糖尿病診療ガイドライン2024', pub:'日本糖尿病学会', url:'https://www.jds.or.jp/modules/publication/index.php?content_id=4'},
    tob_page:  {title:'たばこと健康に関する情報ページ', pub:'厚生労働省', url:M+'/stf/seisakunitsuite/bunya/kenkou_iryou/kenkou/tobacco/index.html'},
    tob_report:{title:'喫煙と健康 喫煙の健康影響に関する検討会報告書（概要）', pub:'厚生労働省', url:M+'/content/0000172686.pdf'},
    kinen:     {title:'禁煙支援マニュアル（第二版）増補改訂版', pub:'厚生労働省', url:M+'/topics/tobacco/kin-en-sien/manual2/'},
    kokoro:    {title:'こころの耳（働く人のメンタルヘルス・ポータルサイト）', pub:'厚生労働省', url:'https://kokoro.mhlw.go.jp/'}
  };

  /* ---------- 検査値 ---------- */
  GM.LAB_NAMES = {bmi:'BMI', waist:'腹囲', sbp:'収縮期血圧', dbp:'拡張期血圧', ldl:'LDL', hdl:'HDL', tg:'中性脂肪',
    non_hdl:'non-HDL', hba1c:'HbA1c', fbs:'空腹時血糖', rbs:'随時血糖', ast:'AST', alt:'ALT', ggtp:'γ-GTP',
    ua:'尿酸', egfr:'eGFR', cre:'クレアチニン', weight:'体重'};

  /* ---------- 判定エンジン ----------
   * 対象者 p（専用コードを展開したもの）
   *   {v:1, id, sex, dis:[病歴], med:[薬の分類], lab:{key:[値, flag]}, cat:{key:{o:全体評価, st:ステージ, it:[[label,value],…]}}}
   * rules.js の各関数は c（下の Ctx）を受け取り、理由の配列（null・false は無視）を返す。
   * 理由 {k:'it'|'lab'|'dis'|'med'|'ov'|'pend', t:表示文} */
  var PEND = /2回目以降の聴取予定|今後、?聴取|要聴取/;
  var BAD = /大きく問題あり|問題あり|注意/;

  function normLabel(s){ return String(s||'').replace(/^\s*\d+\s*[.．]\s*/,'').replace(/["“”]/g,'').replace(/\s+/g,' ').trim(); }
  function shortLabel(s){ return normLabel(s).replace(/[（(][①②]?[)）]$/,'').replace(/^[（(](.*)[)）]$/,'$1'); }
  function num(v){ var n=parseFloat(String(v==null?'':v).replace(/[^\d.\-]/g,'')); return isNaN(n)?null:n; }

  function Ctx(p, key){ this.p=p; this.key=key; }
  Ctx.prototype = {
    items: function(key){ var c=this.p.cat&&this.p.cat[key||this.key]; return (c&&c.it)||[]; },
    /* 聞き取り項目の一致。value が「聴取予定」なら要聴取として返す */
    it: function(labelRe, valueRe, text, key){
      var out=[];
      this.items(key).forEach(function(x){
        var l=normLabel(x[0]), v=String(x[1]||'').trim();
        if(!labelRe.test(l)) return;
        if(PEND.test(v)) out.push({k:'pend', t:'要聴取：'+shortLabel(l)});
        else if(v && v!=='-' && valueRe.test(v)) out.push({k:'it', t:text||(shortLabel(l)+'：'+v)});
      });
      return out;
    },
    /* 同じ名前の項目が複数あるとき（体重計→測定習慣、血圧計→測定習慣）、anchor の次に出てくるものを見る */
    itAfter: function(anchorRe, labelRe, valueRe, text, key){
      var its=this.items(key), seen=false;
      for(var i=0;i<its.length;i++){
        var l=normLabel(its[i][0]), v=String(its[i][1]||'').trim();
        if(anchorRe.test(l)){ seen=true; continue; }
        if(seen && labelRe.test(l)){
          if(PEND.test(v)) return [{k:'pend', t:'要聴取：'+text}];
          return (v && v!=='-' && valueRe.test(v)) ? [{k:'it', t:text+'：'+v}] : [];
        }
      }
      return [];
    },
    /* 数値の聞き取り項目（例: 純アルコール 43.2 g/日）が閾値以上 */
    itNum: function(labelRe, min, text, key){
      var best=null;
      this.items(key).forEach(function(x){
        var l=normLabel(x[0]); if(!labelRe.test(l)) return;
        var n=num(x[1]); if(n!=null && n>=min && (best==null||n>best)) best=n;
      });
      return best==null?[]:[{k:'it', t:(text||'')+best+'g/日'}];
    },
    lab: function(key, op, th){
      var v=this.p.lab&&this.p.lab[key]; if(!v) return [];
      var n=num(v[0]); if(n==null) return [];
      var hit = op==='>='?n>=th : op==='>'?n>th : op==='<'?n<th : n<=th;
      return hit?[{k:'lab', t:(GM.LAB_NAMES[key]||key)+' '+v[0]}]:[];
    },
    dis: function(re){ return (this.p.dis||[]).filter(function(d){return re.test(d);}).map(function(d){return {k:'dis', t:d};}); },
    med: function(re){ return (this.p.med||[]).filter(function(d){return re.test(d);}).map(function(d){return {k:'med', t:'服薬 '+d};}); },
    hasMed: function(){ return (this.p.med||[]).length>0; },
    male: function(){ return /男/.test(this.p.sex||''); },
    ov: function(key){ var c=this.p.cat&&this.p.cat[key||this.key]; return (c&&c.o)||''; },
    /* 腹囲の基準（男85・女90） */
    waist: function(){ return this.lab('waist','>=', this.male()?85:90); }
  };

  function flat(a){ var o=[]; (a||[]).forEach(function(x){ if(!x) return; if(Array.isArray(x)) o=o.concat(flat(x)); else o.push(x); }); return o; }
  function uniq(a){ var s={}; return a.filter(function(r){ var k=r.k+'|'+r.t; if(s[k]) return false; s[k]=1; return true; }); }
  function stateOf(why){
    if(why.some(function(r){return r.k!=='pend';})) return 'act';
    if(why.length) return 'pend';
    return 'off';
  }
  function normStage(s){ s=String(s||''); for(var i=0;i<GM.STAGES.length;i++) if(s.indexOf(GM.STAGES[i])>=0) return GM.STAGES[i]; return null; }

  /* 二次情報の優先順位（全角数字・「1位」なども数値に。無ければ null） */
  function normPri(s){
    s=String(s==null?'':s).replace(/[０-９]/g,function(d){ return String.fromCharCode(d.charCodeAt(0)-0xFEE0); });
    var m=s.match(/\d+/); return m?parseInt(m[0],10):null;
  }

  /* 大項目の並び: 優先順位のある項目を順位順に、残りを元の並びで（対象者を反映していないときは使わない） */
  GM.order = function(j){
    var ranked=[], rest=[], idx={};
    GM.cats.forEach(function(c,i){ idx[c.key]=i; (j.pri[c.key]!=null?ranked:rest).push(c.key); });
    ranked.sort(function(a,b){ return j.pri[a]-j.pri[b] || idx[a]-idx[b]; });
    return {ranked:ranked, rest:rest};
  };

  GM.judge = function(p){
    var res={cat:{}, mid:{}, stage:{}, pri:{}, prob:{}};
    GM.cats.forEach(function(cat){
      var R=GM.rules[cat.key]||{}, c=new Ctx(p, cat.key);
      var anyMid=false, prob=[];
      cat.mids.forEach(function(m){
        var why=[];
        try{ why=uniq(flat(R[m.id]?R[m.id](c):[])); }catch(e){ console.warn('ルールの誤り', cat.key, m.id, e); }
        var s=stateOf(why); if(s==='act') anyMid=true;
        prob=prob.concat(why);
        res.mid[cat.key+'/'+m.id]={s:s, why:why};
      });
      var o=c.ov(), why=[];
      if(BAD.test(o)) why.push({k:'ov', t:'評価 '+o.replace('が必要','')});
      else if(PEND.test(o)) why.push({k:'pend', t:'評価 要聴取'});
      try{ why=why.concat(flat(R._cat?R._cat(c):[])); }catch(e){ console.warn('ルールの誤り', cat.key, e); }
      why=uniq(why);
      var s=stateOf(why);
      if(s!=='act' && anyMid) s='act';
      // 大項目が関係ありで中項目の手がかりが何も無いときは、中項目を「要聴取」にして掘り下げを促す
      if(s==='act' && !anyMid){
        cat.mids.forEach(function(m){ var r=res.mid[cat.key+'/'+m.id]; if(r.s==='off'){ r.s='pend'; } });
      }
      res.cat[cat.key]={s:s, why:why};
      var pc=p.cat&&p.cat[cat.key];
      var st=pc&&normStage(pc.st);
      if(st) res.stage[cat.key]=st;
      res.pri[cat.key]=pc?normPri(pc.pr):null;
      // アセスメント概略に出す問題点（大項目と中項目の理由をまとめる。全体評価そのものは別に出すので除く）
      res.prob[cat.key]=uniq(why.concat(prob)).filter(function(r){ return r.k!=='ov'; });
    });
    GM.judgeGoals(p, res);
    GM.judgeReassess(p, res);
    GM.judgeTodo(p, res);
    GM.judgeSimilar(res);
    return res;
  };

  /* 生活習慣の再評価（p.ra = [[回, {大項目キー:[全体評価, ステージ]}], …]・確定済みの回だけ）
   *   res.ra[大項目]  … 回の順の [{at, o, st}]
   *   res.cur[大項目] … いまの評価 {o, st, at}（最新の再評価。無ければ初回の二次情報で at=0）
   * いまのステージがあれば res.stage を置き換える（詳細パネルの初期表示・「対象者」の印に使う）。 */
  GM.judgeReassess = function(p, res){
    res.ra={}; res.cur={};
    var rs=(p.ra||[]).filter(Array.isArray).slice().sort(function(a,b){ return (a[0]||0)-(b[0]||0); });
    GM.cats.forEach(function(cat){
      var k=cat.key, pc=(p.cat&&p.cat[k])||{}, list=[];
      rs.forEach(function(r){ var v=r[1]&&r[1][k]; if(v) list.push({at:Number(r[0])||0, o:String(v[0]||''), st:String(v[1]||'')}); });
      res.ra[k]=list;
      var cur={o:pc.o||'', st:pc.st||'', at:0};
      list.forEach(function(x){ if(x.o) cur.o=x.o; if(x.st) cur.st=x.st; cur.at=x.at; });
      res.cur[k]=cur;
      var st=normStage(cur.st); if(st) res.stage[k]=st;
    });
    return res;
  };

  /* 次の目標の候補＝要介入なのに、まだ目標に取り上げていない大項目（res.todo・優先順位→評価の重さの順）
   * 要介入: 優先順位がある、または いまの評価が「注意」以上。次回に向けた新規目標（st='次回'）は取り上げ済みとみなす。 */
  GM.judgeTodo = function(p, res){
    var idx={}; GM.cats.forEach(function(c,i){ idx[c.key]=i; });
    function sev(o){ o=String(o||''); return /大きく問題あり/.test(o)?3:/問題あり/.test(o)?2:/注意/.test(o)?1:0; }
    res.todo=GM.cats.map(function(c){ return c.key; }).filter(function(k){
      if((res.done[k]||[]).length) return false;
      return res.pri[k]!=null || sev(res.cur[k]&&res.cur[k].o)>0;
    }).sort(function(a,b){
      var pa=res.pri[a], pb=res.pri[b];
      if((pa==null)!==(pb==null)) return pa==null?1:-1;
      if(pa!=null&&pa!==pb) return pa-pb;
      return sev(res.cur[b].o)-sev(res.cur[a].o) || idx[a]-idx[b];
    });
    return res;
  };

  /* 目標例と過去の目標の近さ（2文字ずつの一致率・Dice係数）。言い換えをそろえ、
   * 「週◯日以上」など目標例に共通の言い回しは数えない。同じ大項目の中だけで比べる。 */
  var SYN=[[/スマートフォン/g,'スマホ'],[/休肝日/g,'飲まない日'],[/ウォーキング|散歩/g,'歩く'],
    [/ごはん|ご飯|白米/g,'主食'],[/測って|計って|はかって|測る|計る|はかる/g,'測'],
    [/エアロバイク|自転車|ジョギング|水泳/g,'運動'],[/落とす|減らす|控える|控えめにする/g,'減らす'],
    [/摂取頻度|頻度|回数/g,'回数']];
  var STOP={}; ('する ます して った てい いる こと もの ない うに よう から まで には では にす を0 0分 0回 0日 '
    +'週0 日以 以上 上に る日 日を 毎日 今週 今夜 始め める 続け ける か月 1か を週 とる').split(' ').forEach(function(b){ STOP[b]=1; });
  function bigrams(t){
    t=SYN.reduce(function(x,r){ return x.replace(r[0],r[1]); }, String(t||'').normalize('NFKC'))
      .replace(/[\s、。・,.!！?？()（）「」『』〜~\-ー]/g,'').replace(/\d+/g,'0');
    var o={}, n=0;
    for(var i=0;i<t.length-1;i++){ var b=t.slice(i,i+2); if(!STOP[b]&&!o[b]){ o[b]=1; n++; } }
    return {set:o, n:n};
  }
  GM.goalSim = function(a, b){
    var A=bigrams(a), B=bigrams(b), m=0;
    if(!A.n||!B.n) return 0;
    Object.keys(A.set).forEach(function(x){ if(B.set[x]) m++; });
    return 2*m/(A.n+B.n);
  };
  GM.SIM_TH = 0.35;
  /* 面談の目標は1文に複数の取り組みを書くことが多いので、文（。や長い読点の区切り）ごとにも比べて高い方を取る */
  GM.goalScore = function(goal, ex){
    var parts=String(goal||'').split(/[。．\n]|、(?=[^、]{8,})/).map(function(x){ return x.trim(); })
      .filter(function(x){ return x.length>=4; });
    return [goal].concat(parts).reduce(function(m, x){ return Math.max(m, GM.goalSim(x, ex)); }, 0);
  };
  /* 小項目の目標例ごとに、近い過去の目標を探す（res.sim['大項目/中項目/小項目'][ステージ][i] = [目標]）。
   * res.simSmall['大項目/中項目/小項目'] … どれかの目標例に近い過去の目標があれば その目標の配列 */
  GM.judgeSimilar = function(res){
    res.sim={}; res.simSmall={};
    GM.cats.forEach(function(cat){
      var gs=res.done[cat.key]||[]; if(!gs.length) return;
      cat.mids.forEach(function(m){ m.smalls.forEach(function(sm){
        var key=cat.key+'/'+m.id+'/'+sm.id, hit=[];
        Object.keys(sm.goals||{}).forEach(function(stg){
          (sm.goals[stg]||[]).forEach(function(ex, i){
            var near=gs.filter(function(g){ return GM.goalScore(g.t, ex)>=GM.SIM_TH; });
            if(!near.length) return;
            ((res.sim[key]=res.sim[key]||{})[stg]=res.sim[key][stg]||{})[i]=near;
            near.forEach(function(g){ if(hit.indexOf(g)<0) hit.push(g); });
          });
        });
        if(hit.length) res.simSmall[key]=hit;
      }); });
    });
    return res;
  };

  /* 取り組み内容（p.gl = [[回, 種別キー, 達成状況, 目標の文言], …]）を大項目・中項目に割り当てる。
   *   res.goals        … 全件（{no, k, st, t, mids:[中項目id]}・回の順）
   *   res.done[大項目] … その大項目の目標（種別キーで割り当て）
   *   res.doneMid['大項目/中項目'] … 文言が GM.goalKw（rules.js）のキーワードに当たった目標
   * 種別が未設定の目標は、キーワードが当たった大項目に割り当てる。「その他」とどこにも当たらないものは res.other。 */
  GM.judgeGoals = function(p, res){
    res.goals=[]; res.done={}; res.doneMid={}; res.other=[];
    var keys={}; GM.cats.forEach(function(c){ keys[c.key]=c; });
    (p.gl||[]).forEach(function(a){
      if(!Array.isArray(a)) return;
      var g={no:Number(a[0])||0, k:String(a[1]||''), st:String(a[2]||''), t:String(a[3]||''), mids:[]};
      // 種別「その他」（10項目外）は割り当てない。未設定のときだけ全大項目からキーワードで探す
      var cats=keys[g.k]?[keys[g.k]]:(g.k==='other'?[]:GM.cats);
      cats.forEach(function(c){
        var kw=GM.goalKw[c.key]||{};
        c.mids.forEach(function(m){
          if(kw[m.id] && kw[m.id].test(g.t)){
            if(!keys[g.k]) g.k=c.key;   // 種別未設定 → 最初に当たった大項目
            if(g.k!==c.key) return;
            g.mids.push(m.id);
            (res.doneMid[c.key+'/'+m.id]=res.doneMid[c.key+'/'+m.id]||[]).push(g);
          }
        });
      });
      if(keys[g.k]) (res.done[g.k]=res.done[g.k]||[]).push(g); else res.other.push(g);
      res.goals.push(g);
    });
    res.goals.sort(function(x,y){ return x.no-y.no; });
    return res;
  };

  return GM;
})();
