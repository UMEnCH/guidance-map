/* 面談思考マップ：共通の定義（出典の一覧・判定エンジン）
 * 収録内容は data/01〜10-*.js、判定ルールは data/rules.js に書く。 */
var GM = (function(){
  'use strict';
  var GM = { cats:[], rules:{} };

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

  GM.judge = function(p){
    var res={cat:{}, mid:{}, stage:{}};
    GM.cats.forEach(function(cat){
      var R=GM.rules[cat.key]||{}, c=new Ctx(p, cat.key);
      var anyMid=false;
      cat.mids.forEach(function(m){
        var why=[];
        try{ why=uniq(flat(R[m.id]?R[m.id](c):[])); }catch(e){ console.warn('ルールの誤り', cat.key, m.id, e); }
        var s=stateOf(why); if(s==='act') anyMid=true;
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
      var st=p.cat&&p.cat[cat.key]&&normStage(p.cat[cat.key].st);
      if(st) res.stage[cat.key]=st;
    });
    return res;
  };

  return GM;
})();
