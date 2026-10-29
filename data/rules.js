/* 面談思考マップ：対象者に関係する項目の判定ルール
 * GM.rules[大項目キー] = { _cat: 大項目そのものの条件, 中項目id: 中項目の条件 }
 * 各関数は c（core.js の Ctx）を受け取り、理由の配列を返す。何も当たらなければ空配列。
 *   c.it(項目名の正規表現, 値の正規表現, 表示文?, 大項目キー?) … 二次情報の聞き取り項目
 *   c.itAfter(直前の項目, 項目名, 値, 表示文)                … 同名項目（測定習慣など）の区別
 *   c.itNum(項目名, 下限, 表示文の頭)                         … 純アルコール量などの数値
 *   c.lab(キー, '>=' '>' '<' '<=', 閾値)                      … 健診の検査値（最新値）
 *   c.dis(正規表現) / c.med(正規表現) / c.waist()             … 病歴・服薬の分類・腹囲
 * 二次情報の全体評価（大きく問題あり／問題あり／注意が必要）は、ルールを書かなくても大項目に反映される。
 * 閾値は特定保健指導の保健指導判定値・受診勧奨判定値（標準的な健診・保健指導プログラム 令和6年度版）に合わせる。 */
(function(){
  var R = GM.rules;
  var DIET = 'diet_balance', ALC = 'alcohol', EX = 'exercise';

  R.medication = {
    _cat: function(c){ return [c.med(/./)]; },
    adherence: function(c){ return [c.it(/服薬状況/, /不良/, '服薬状況：不良')]; },
    untreated: function(c){
      // 受診勧奨判定値以上で、その分野の薬が無い
      return [
        !c.med(/血圧/).length && c.lab('sbp','>=',140), !c.med(/血圧/).length && c.lab('dbp','>=',90),
        !c.med(/血糖/).length && c.lab('hba1c','>=',6.5), !c.med(/血糖/).length && c.lab('fbs','>=',126),
        !c.med(/脂質/).length && c.lab('ldl','>=',140), !c.med(/脂質/).length && c.lab('tg','>=',300)
      ];
    },
    with_lifestyle: function(c){ return [c.med(/./)]; }
  };

  R.self_monitoring = {
    weigh: function(c){ return [c.it(/^体重計/, /なし/, '体重計なし'), c.itAfter(/^体重計/, /測定習慣/, /なし|月1|週1/, '体重測定')]; },
    home_bp: function(c){
      var bp=[c.dis(/高血圧/), c.lab('sbp','>=',130), c.lab('dbp','>=',85)];
      var habit=[c.it(/^血圧計/, /なし/, '血圧計なし'), c.itAfter(/^血圧計/, /測定習慣/, /なし|月1|週1/, '血圧測定')];
      return [bp, habit].some(function(a){ return a.some(function(x){ return x && x.length; }); }) ? [bp, habit] : [];
    },
    steps: function(c){ return [c.it(/歩数/, /4000|6000/, null, EX)]; },
    food_record: function(c){ return [c.lab('bmi','>=',25), c.waist(), c.it(/間食/, /毎日/, null, DIET)]; }
  };

  R.weight = {
    _cat: function(c){ return [c.lab('bmi','>=',25), c.waist(), c.it(/^BMI/, /肥満/)]; },
    // 中性脂肪・HDL は、腹囲か BMI が当たったときの補足理由としてだけ使う
    visceral: function(c){
      var base=[c.waist(), c.lab('bmi','>=',25)];
      return base.some(function(a){ return a.length; }) ? [base, c.lab('tg','>=',150), c.lab('hdl','<',40)] : [];
    },
    target: function(c){ return [c.lab('bmi','>=',25), c.waist()]; },
    rebound: function(c){ return [c.it(/変動/, /あり|増/)]; },
    underweight: function(c){ return [c.lab('bmi','<',18.5), c.it(/^BMI/, /低体重/)]; }
  };

  R.exercise = {
    steps: function(c){ return [c.it(/歩数/, /4000|6000/)]; },
    sedentary: function(c){ return [c.it(/業務/, /デスク/), c.it(/通勤/, /車/)]; },
    brisk: function(c){ return [c.it(/早歩き/, /なし/), c.it(/休日等の身体活動/, /なし/), c.it(/歩行速度/, /遅い/)]; },
    muscle: function(c){ return [c.dis(/糖尿病/), c.lab('hba1c','>=',6.0), c.lab('bmi','>=',25)]; },
    caution: function(c){ return [c.lab('sbp','>=',160), c.lab('dbp','>=',100), c.lab('hba1c','>=',8.0), c.med(/血糖/)]; }
  };

  R.diet_balance = {
    timing: function(c){ return [c.it(/規則性/, /遅い|不規則/)]; },
    skipping: function(c){ return [c.it(/規則性/, /食べない/)]; },
    fast: function(c){ return [c.it(/スピード|速さ/, /早食い/, '早食い')]; },
    snack: function(c){ return [c.it(/間食/, /毎日|週2/)]; },
    drinks: function(c){ return [c.it(/加糖飲料/, /毎日|週2/)]; },
    vegetables: function(c){ return [c.it(/野菜を食べる頻度/, /あれば|ほとんど/), c.it(/野菜.*量|1日の摂取量/, /片手|ほとんど/)]; },
    carbs: function(c){ return [c.lab('hba1c','>=',5.6), c.lab('fbs','>=',100), c.lab('tg','>=',150)]; },
    eating_out: function(c){ return [c.it(/外食/, /3~4|3〜4|毎日/)]; },
    fat: function(c){ return [c.it(/魚と肉/, /肉/, '肉が中心'), c.lab('ldl','>=',120), c.lab('non_hdl','>=',150)]; }
  };

  R.salt = {
    _cat: function(c){ return [c.dis(/高血圧/), c.lab('sbp','>=',130), c.lab('dbp','>=',85)]; },
    measured: function(c){ return [c.it(/測定値/, /8~10|10~14|14/, null)]; },
    noodle: function(c){ return [c.it(/麺類/, /半分以上|全部/, null)]; },
    soup_pickles: function(c){ return [c.it(/汁物/, /毎日/), c.it(/漬物/, /毎日|週2/)]; },
    eating_out: function(c){ return [c.it(/外食/, /3~4|3〜4|毎日/, null, DIET)]; },
    potassium: function(c){
      if(c.lab('egfr','<',45).length) return [];  // 腎機能低下ではカリウムを勧めない（主治医の指示に従う）
      return [c.it(/野菜を食べる頻度/, /あれば|ほとんど/, null, DIET), c.it(/野菜.*量|1日の摂取量/, /片手|ほとんど/, null, DIET)];
    }
  };

  // 飲酒の中項目は「飲酒あり」（または純アルコール量の記入あり）のときだけ判定する
  function drinks(c){ return c.it(/飲酒の有無/, /あり/).length>0 || c.itNum(/平日|休日|純アルコール/, 0.1).length>0; }
  function ifDrink(fn){ return function(c){ return drinks(c) ? fn(c) : []; }; }
  R.alcohol = {
    _cat: function(c){ return [c.it(/飲酒の有無/, /あり/, '飲酒あり')]; },
    amount: ifDrink(function(c){
      var th=c.male()?40:20;
      return [c.itNum(/平日|休日|純アルコール/, th, '純アルコール '), c.lab('ggtp','>=',51)];
    }),
    free_days: ifDrink(function(c){ return [c.it(/飲酒頻度/, /なし|1日\/2週/)]; }),
    binge: ifDrink(function(c){ return [c.itNum(/平日|休日|純アルコール/, 60, '1日 ')]; }),
    snacks: ifDrink(function(c){ return [c.lab('bmi','>=',25), c.waist()]; }),
    labs: ifDrink(function(c){ return [c.lab('ggtp','>=',51), c.lab('tg','>=',150), c.lab('ua','>',7.0), c.lab('alt','>=',31)]; })
  };

  R.smoking = {
    _cat: function(c){ return [c.it(/喫煙歴/, /現在喫煙中/, '喫煙中')]; },
    motivation: function(c){ return [c.it(/喫煙歴/, /現在喫煙中/, '喫煙中')]; },
    methods: function(c){ return [c.it(/喫煙歴/, /現在喫煙中/, '喫煙中')]; },
    heated: function(c){ return [c.it(/種類/, /電子|加熱/)]; },
    relapse: function(c){ return [c.it(/喫煙歴/, /禁煙中/, '禁煙中')]; }
  };

  R.sleep = {
    duration: function(c){ return [c.it(/睡眠時間/, /5時間未満|5~7/)]; },
    quality: function(c){ return [c.it(/睡眠の質/, /不満|どちらとも/), c.it(/日中の眠気/, /多い|時々/)]; },
    sas: function(c){
      // いびき・無呼吸の手がかりがあるときだけ、肥満・高血圧を補足理由に足す（要聴取だけなら要聴取のまま）
      var sign=[].concat(c.it(/いびき/, /あり/), c.it(/無呼吸/, /可能性/));
      var real=sign.some(function(r){ return r.k!=='pend'; });
      return real ? [sign, c.lab('bmi','>=',25), c.dis(/高血圧/)] : sign;
    },
    nocturia: function(c){ return [c.it(/夜間尿|中途覚醒/, /あり|ある|回/)]; },
    habits: function(c){ return c.it(/睡眠の質/, /不満|どちらとも/).length ? [c.it(/飲酒の有無/, /あり/, '寝酒の可能性', ALC)] : []; }
  };

  R.stress = {
    work: function(c){ return [c.it(/ノルマ|職場/, /ある/)]; },
    relations: function(c){ return [c.it(/人間関係|家庭/, /ある/)]; },
    coping: function(c){ return [c.it(/アルコール多飲/, /あり/), c.it(/喫煙/, /現在喫煙中/)]; },
    rest: function(c){ return [c.it(/睡眠不足/, /5時間未満|5~7/)]; },
    consult: function(c){ return [c.it(/ノルマ|人間関係|職場|家庭/, /いつも/)]; }
  };
})();

/* 取り組み内容（面談の目標の文言）→ 中項目の割り当てに使うキーワード
 * GM.goalKw[大項目キー][中項目id] = 正規表現。目標は種別（大項目）で割り当て、その中でこの語が当たった中項目に印を付ける。
 * 1つの目標が複数の中項目に当たってよい。当たらなければ大項目にだけ印が付く。 */
(function(){
  GM.goalKw = {
    medication: {
      adherence: /飲み忘れ|服薬|服用|内服|薬を(飲|忘)|お薬/,
      untreated: /受診|通院|病院|クリニック|医療機関|再検査|精密検査/
    },
    self_monitoring: {
      weigh: /体重(を)?(測|計|記録|チェック)|体重計|体重測定|毎日体重/,
      home_bp: /血圧/,
      steps: /歩数(を)?(記録|確認|チェック)|歩数計/,
      food_record: /(食事|食べた|飲んだ|間食).*(記録|写真|メモ)|(記録|写真).*(食事|食べ)|レコーディング/
    },
    weight: {
      visceral: /腹囲|内臓脂肪|お腹|おなか|ウエスト/,
      target: /減量|kg|ｋｇ|キロ|目標体重|体重を?(減|落|\d)/,
      rebound: /リバウンド|体重.*(維持|増やさない|増えない)/,
      underweight: /やせ|痩せ|低体重|体重を?増や/
    },
    exercise: {
      steps: /歩数|\d+\s*歩|万歩|ウォーキング|散歩|歩く|歩いて/,
      sedentary: /座り|立って|立ち|階段|エレベーター|エスカレーター|こまめに動|1駅/,
      brisk: /早歩き|速歩|運動|ジョギング|ランニング|エアロバイク|バイク|自転車|水泳|プール|ジム|体操|ヨガ/,
      muscle: /筋トレ|筋力|スクワット|腕立て|腹筋|ダンベル|プランク|レジスタンス/,
      caution: /準備運動|ストレッチ|水分補給|無理/
    },
    diet_balance: {
      timing: /夕食.*(時|前|早)|\d+\s*時(まで|以降|前)|遅い時間|規則正しく|食事の時間|寝る.*前.*食/,
      skipping: /朝食|朝ごはん|朝ご飯|欠食|抜かない|3食/,
      fast: /よく噛|噛む|かむ|ゆっくり|早食い|\d+\s*回噛|箸を置/,
      snack: /間食|お菓子|おやつ|夜食|菓子|甘い物|甘いもの|スイーツ|果物|アイス/,
      drinks: /ジュース|加糖|清涼飲料|甘い飲み物|缶コーヒー|炭酸|スポーツドリンク|砂糖/,
      vegetables: /野菜|サラダ|食物繊維|ベジ|食べる順|海藻|きのこ|副菜/,
      carbs: /主食|ご飯|ごはん|白米|炭水化物|パン|大盛|小盛|糖質|おかわり|麺類|麺.*(ご飯|ライス)|丼/,
      eating_out: /外食|コンビニ|惣菜|弁当|社員食堂|食堂|中食|テイクアウト/,
      fat: /揚げ物|脂|肉|魚|油|ラーメン/
    },
    salt: {
      measured: /塩分(測定|チェック|計)|推定.*塩|尿.*塩/,
      noodle: /麺|ラーメン|うどん|そば|汁を(残|飲)|スープを(残|飲)/,
      soup_pickles: /味噌汁|みそ汁|汁物|漬物|梅干/,
      processed: /醤油|しょうゆ|調味料|ソース|ドレッシング|加工食品|ハム|ソーセージ|かけない|減塩|薄味|塩分濃度|薬味|香辛料|七味|酸味|だし/,
      eating_out: /外食|惣菜|コンビニ|弁当|社員食堂|食堂/,
      potassium: /野菜|果物|カリウム/
    },
    alcohol: {
      amount: /\d+\s*(本|杯|合|缶|ml|mL|g)|量を|純アルコール|ビール|日本酒|焼酎|ワイン|ハイボール|ノンアル|酒/,
      free_days: /休肝日|飲まない日|週\s*\d+\s*日/,
      binge: /多量|一度に|飲み会|はしご/,
      snacks: /つまみ|締め|〆/,
      labs: /γ|ガンマ|肝機能|肝臓/
    },
    smoking: {
      motivation: /禁煙|本数|減煙|減らす|吸う/,
      methods: /禁煙外来|補助薬|パッチ|ニコチン|ガム|禁煙アプリ/,
      heated: /加熱式|電子たばこ|電子タバコ|アイコス|IQOS/,
      relapse: /再喫煙|吸わない|禁煙.*(続|継続)/
    },
    sleep: {
      duration: /睡眠時間|\d+\s*時間.*(寝|睡眠)|就寝|寝る時間|早く寝|起床|\d+\s*時(に|までに)寝/,
      quality: /休養|熟睡|睡眠の質|昼寝|寝起き/,
      sas: /いびき|無呼吸|SAS/,
      nocturia: /夜間尿|夜中.*トイレ|中途覚醒/,
      habits: /スマホ|寝酒|カフェイン|入浴|画面|寝る前|寝る\s*\d+\s*(分|時間)前/
    },
    stress: {
      work: /仕事|残業|業務|定時/,
      relations: /家族|人間関係|職場/,
      coping: /ストレス.*(食|飲|吸)|やけ食い|やけ酒/,
      rest: /休養|リラックス|趣味|入浴|深呼吸|瞑想|気分転換/,
      consult: /相談|カウンセ|受診/
    }
  };
})();
