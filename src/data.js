// ============ 史料与剧本 ============
// 证据分级：文载＝袁枚本人诗文原句；图记＝袁起《随园图》及《随园图记》；
// 传述＝后世记载与研究转述；推测＝本页依清中期江南园林做法类推；虚构＝为游览编写的情节与对白。
const TAGS = {
  wen:  { name: '文载', desc: '袁枚本人诗文原句' },
  tu:   { name: '图记', desc: '袁起《随园图》（1865）及《随园图记》' },
  chuan:{ name: '传述', desc: '后世记载、方志与研究者转述' },
  tui:  { name: '推测', desc: '本页依清中期江南园林做法类推' },
  xu:   { name: '虚构', desc: '为游览编写的情节与对白' }
};

const SRC = {
  ji:      { t: '袁枚《随园记》（乾隆十四年，1749）', u: 'https://m.gushiwen.cn/shiwenv_c87eb15978f8.aspx' },
  tuji:    { t: '袁起《随园图》《随园图记》，引文转引自《寻找〈随园图〉中的“随园”》', u: 'https://blog.sina.com.cn/s/blog_147baa4430102x7tl.html' },
  renmin:  { t: '人民网《袁枚与随园》（2015）', u: 'http://politics.people.com.cn/n/2015/0703/c70731-27246899.html' },
  after:   { t: '《袁枚之后的随园》（2017）', u: 'https://m.fx361.com/news/2017/0927/2310498.html' },
  shucang: { t: '袁枚《随园二十四咏·书仓》，转引自《寻常巷陌：随家仓》', u: 'https://blog.sina.com.cn/s/blog_3e503b630102yy1w.html' },
  shihua:  { t: '袁枚《随园诗话》', u: 'https://zh.wikisource.org/zh-hans/%E9%9A%A8%E5%9C%92%E8%A9%A9%E8%A9%B1' },
  shihuaWk:{ t: '维基百科《随园诗话》', u: 'https://zh.wikipedia.org/zh-hans/%E9%9A%A8%E5%9C%92%E8%A9%A9%E8%A9%B1' },
  shidan:  { t: '袁枚《随园食单》（乾隆五十七年，1792 刊）', u: 'https://zh.wikisource.org/wiki/%E9%9A%A8%E5%9C%92%E9%A3%9F%E5%96%AE' },
  jieshu:  { t: '袁枚《黄生借书说》' },
  shiji:   { t: '袁枚诗，见《小仓山房诗集》（维基文库本卷二十四，诗题未核）', u: 'https://zh.wikisource.org/wiki/%E5%B0%8F%E5%80%89%E5%B1%B1%E6%88%BF%E8%A9%A9%E9%9B%86/24' },
  xiang:   { t: '界面新闻《随园先生袁枚到底长什么样？》，引蒋敦复《随园轶事》', u: 'https://www.jiemian.com/article/2493327.html' },
  lunshi:  { t: '袁枚论诗语，转引自《随园诗话》提要', u: 'https://www.diancang.xyz/shicixiqu/suiyuanshihua/' },
  baoen:   { t: '澎湃新闻：大报恩寺琉璃塔数字复原（2023）', u: 'https://www.thepaper.cn/newsDetail_forward_23448410' },
  sui73:   { t: '《寻常巷陌：随家仓》（袁枚墓 1973 年拆除之说）', u: 'https://blog.sina.com.cn/s/blog_3e503b630102yy1w.html' }
};

// 说话人：yuan 袁枚 / tong 书童 / ke 客（你）/ pang 旁白
// q: 原文引语（以「」显示并附出处）；src: 出处键；tag: 证据等级
// look: 本句镜头转向（仅南楼使用方位角 az，单位度，正北为 0）
const STATIONS = [
  {
    id: 'chaimen', name: '柴门', time: 0.05, mode: 'gong',
    lines: [
      { who: 'pang', t: '乾隆五十年（1785），仲春。你出北门桥西行，过红土桥，便到了小仓山下。', tag: 'xu' },
      { who: 'pang', t: '过红土桥，即为随园，柴门向北。', q: 1, src: 'tuji', tag: 'tu' },
      { who: 'tong', t: '先生，客人到了！', tag: 'xu' },
      { who: 'yuan', t: '可算把你盼来了。门是柴门，园子却不小，你随我慢慢走。', tag: 'xu' }
    ],
    ask: [
      { q: '这园子为何叫“随园”？', a: [
        { who: 'yuan', t: '原是织造隋公的园子，人称隋园。我买下来，字音不改，只把意思换了。', tag: 'xu' },
        { who: 'yuan', t: '随其高，为置江楼；随其下，为置溪亭；随其夹涧，为之桥；随其湍流，为之舟。', q: 1, src: 'ji', tag: 'wen' },
        { who: 'yuan', t: '地势高处便起楼，低处便筑亭，一切随它，所以叫随园。', tag: 'xu' }
      ]},
      { q: '门外怎么不见围墙？', a: [
        { who: 'yuan', t: '园子好看，总该让人看见。', tag: 'xu' },
        { who: 'pang', t: '袁起所绘《随园图》中，随园不起墙垣，与山野相融。民国陈诒绂《金陵园墅志》记此园“四时皆花”，“游人不断”。', src: 'renmin', tag: 'chuan' }
      ]}
    ],
    outro: [
      { who: 'yuan', t: '问其值，曰三百金，购以月俸。', q: 1, src: 'ji', tag: 'wen' },
      { who: 'yuan', t: '当年我做江宁知县，拿俸银三百两买下这座荒园。走吧。', tag: 'xu' }
    ],
    notes: [
      { tag: 'tu', t: '入园路线依袁起《随园图记》：“金陵北门桥，迤西半里许，俗号干河沿……过红土桥，即为随园，柴门向北。”', src: 'tuji' },
      { tag: 'wen', t: '《随园记》称“自北门桥西行二里，得小仓山”，与袁起“半里许”的说法不同，两处距离记载有出入。', src: 'ji' },
      { tag: 'chuan', t: '随园不设围墙，附园有水田、菜畦百亩。这一描述出自今人对袁起《随园图》的解读。', src: 'renmin' },
      { tag: 'tui', t: '柴门的形制、尺寸为推测。画面中的季节取自《随园图》题款“同治乙丑仲春”，并按仲春物候布置：竹笋、残梅、油菜花。' },
      { tag: 'xu', t: '“你”是一位不具名的远方友人，访园的日子定在乾隆五十年，这是本页虚构的情节。' }
    ]
  },
  {
    id: 'zhujing', name: '竹径', time: 0.1, mode: 'gong',
    lines: [
      { who: 'pang', t: '入扉，缘短篱，穿修竹，行绿阴中，曲折通门。', q: 1, src: 'tuji', tag: 'tu' },
      { who: 'yuan', t: '万竹立门外，一家藏绿阴。', q: 1, src: 'shiji', tag: 'wen' },
      { who: 'tong', t: '客人留神，竹叶上还挂着露水。', tag: 'xu' }
    ],
    notes: [
      { tag: 'tu', t: '“缘短篱，穿修竹”出自袁起《随园图记》。短篱、竹林与曲径的具体走向为推测。', src: 'tuji' },
      { tag: 'wen', t: '“万竹立门外，一家藏绿阴”出自袁枚一组咏居所日常的五律。本页没有核对到诗题，引用时保留这一不确定性。', src: 'shiji' }
    ]
  },
  {
    id: 'dayuan', name: '大院 · 四桐', time: 0.18, mode: 'gong',
    lines: [
      { who: 'pang', t: '入大院，四桐隅立。面东为三楹，筦龠全园。', q: 1, src: 'tuji', tag: 'tu' },
      { who: 'ke', t: '这四棵梧桐，长得真齐整。', tag: 'xu' },
      { who: 'yuan', t: '院子四角各一棵，到了夏天便是满院阴凉。这三间屋子朝东，是全园的枢纽，往哪里去都从这儿走。', tag: 'xu' }
    ],
    ask: [
      { q: '您当初为何舍了官不做？', a: [
        { who: 'yuan', t: '使吾官于此，则月一至焉；使吾居于此，则日日至焉。二者不可得兼，舍官而取园者也。', q: 1, src: 'ji', tag: 'wen' },
        { who: 'yuan', t: '做着官，一个月才能来一回；住下来，天天都在。两样不能兼得，我便舍了官。', tag: 'xu' }
      ]},
      { q: '这园子原先是什么样子？', a: [
        { who: 'yuan', t: '园倾且颓弛，其室为酒肆……百卉芜谢，春风不能花。', q: 1, src: 'ji', tag: 'wen' },
        { who: 'yuan', t: '我接手时，屋子塌了一半，还开过酒馆，连春风都吹不开花。', tag: 'xu' }
      ]}
    ],
    notes: [
      { tag: 'tu', t: '“四桐隅立”“面东为三楹，筦龠全园”出自袁起《随园图记》。“筦龠”指钥匙，意思是这三间屋子是全园的枢纽。', src: 'tuji' },
      { tag: 'wen', t: '袁枚于乾隆十年（1745）前后买下隋园，乾隆十三年（1748）辞官，移居园中。', src: 'ji' },
      { tag: 'tui', t: '三楹屋的开间、进深与门窗样式，按江南清中期民居推测。' }
    ]
  },
  {
    id: 'shanfang', name: '小仓山房', time: 0.24, mode: 'gong',
    lines: [
      { who: 'yuan', t: '这是小仓山房，我平日读书、会客都在这里。我的诗文集就叫《小仓山房集》。', tag: 'xu' },
      { who: 'pang', t: '此地有崇山峻岭、茂林修竹；是能读三坟五典、八索九丘。', q: 1, src: 'renmin', tag: 'chuan' },
      { who: 'ke', t: '上联借的是《兰亭序》，下联借的是《左传》。', tag: 'xu' },
      { who: 'yuan', t: '一句借王右军，一句借左丘明，凑在一处，倒也严丝合缝。', tag: 'xu' }
    ],
    notes: [
      { tag: 'chuan', t: '小仓山房所挂楹联据人民网《袁枚与随园》转述，文中注出处为《随园图记》（亦名《随园图说》）。', src: 'renmin' },
      { tag: 'chuan', t: '上联出自王羲之《兰亭集序》“此地有崇山峻岭，茂林修竹”；下联出自《左传·昭公十二年》“是能读三坟、五典、八索、九丘”。' },
      { tag: 'tui', t: '堂的位置放在北岭南坡。依据是《随园记》说原主隋公“当山之北巅，构堂皇”，具体坐向为推测。', src: 'ji' }
    ]
  },
  {
    id: 'shucang', name: '书仓', time: 0.32, mode: 'zhi',
    lines: [
      { who: 'yuan', t: '聚书如聚谷，仓储苦不足。为藏万古人，多造三间屋。', q: 1, src: 'shucang', tag: 'wen' },
      { who: 'yuan', t: '书一多，一间屋子就装不下了，我便按经、史、子、集分成四类，放在亭、轩、楼、阁四处。', tag: 'chuan', src: 'shucang' }
    ],
    ask: [
      { q: '一共藏了多少卷？', a: [
        { who: 'yuan', t: '数不清了，四方朋友互相借抄，有无相通。', tag: 'xu' },
        { who: 'pang', t: '后人记载随园藏书多达四十万卷。这个数字未见于袁枚自述，暂且存疑。', src: 'shucang', tag: 'chuan' }
      ]},
      { q: '这些书您都读完了？', a: [
        { who: 'yuan', t: '无问藏书者，几时君尽读。', q: 1, src: 'shucang', tag: 'wen' },
        { who: 'yuan', t: '这话可别问我。我倒常跟来借书的后生说：', tag: 'xu' },
        { who: 'yuan', t: '书非借不能读也。', q: 1, src: 'jieshu', tag: 'wen' }
      ]}
    ],
    notes: [
      { tag: 'wen', t: '《书仓》是《随园二十四咏》中的一首。本页引文转引自网络文章，末句一作“莫问藏书者”，未能核对刻本。', src: 'shucang' },
      { tag: 'chuan', t: '经史子集分藏于亭、轩、楼、阁四处，以及“四十万卷”之说，都出自后人记载。', src: 'shucang' },
      { tag: 'tui', t: '四座藏书建筑的相对位置和形制为推测：亭为六角攒尖，楼为两层。' }
    ]
  },
  {
    id: 'xiaomian', name: '小眠斋', time: 0.4, mode: 'zhi',
    lines: [
      { who: 'yuan', t: '走乏了，就到这间小眠斋歇歇脚。午后我常在这里打个盹。', tag: 'xu' },
      { who: 'pang', t: '袁枚曾请画家罗聘（号两峰）为他画小像，嫌画得不像，题了一段诙谐的长跋，把画寄还给罗聘。两人交情并没有因此受损。', src: 'xiang', tag: 'chuan' }
    ],
    notes: [
      { tag: 'chuan', t: '“小眠斋”见于后人所录随园景名（金石藏、环香处、小眠斋、群玉山头、绿晓阁、柳谷等）。', src: 'renmin' },
      { tag: 'tui', t: '小眠斋在园中的确切位置无图可考，这里是推测安置。' },
      { tag: 'chuan', t: '退画一事见蒋敦复《随园轶事》：“先生请罗两峰画小像，因不甚似，至以像寄还。”', src: 'xiang' }
    ]
  },
  {
    id: 'tenghua', name: '藤花廊', time: 0.47, mode: 'zhi',
    lines: [
      { who: 'yuan', t: '这条廊子顺着山势往下走。再过些日子紫藤开花，整条廊子都是紫的。', tag: 'xu' },
      { who: 'ke', t: '下雨天也能走遍园子了。', tag: 'xu' },
      { who: 'yuan', t: '正是。雨天看园，又是一番景致。', tag: 'xu' }
    ],
    notes: [
      { tag: 'tu', t: '“藤花廊”是袁起《随园图》上标注的景名之一。', src: 'tuji' },
      { tag: 'tui', t: '廊的走向、长度和架藤方式为推测。紫藤花期在季春到初夏，所以仲春只有新叶和花苞。' }
    ]
  },
  {
    id: 'shishijie', name: '诗世界', time: 0.54, mode: 'zhi',
    lines: [
      { who: 'yuan', t: '这里叫“诗世界”。', tag: 'xu' },
      { who: 'yuan', t: '自三百篇至今日，凡诗之传者，都是性灵，不关堆垛。', q: 1, src: 'shihua', tag: 'wen' },
      { who: 'yuan', t: '这些年各地朋友寄来的好诗，我都一首首记下，打算编成一部诗话。', tag: 'xu' }
    ],
    ask: [
      { q: '“性灵”是什么意思？', a: [
        { who: 'yuan', t: '诗者，由情生者也，有必不可解之情，而后有必不可朽之诗。', q: 1, src: 'lunshi', tag: 'wen' },
        { who: 'yuan', t: '写诗要写自己的真性情，不在堆砌典故。', tag: 'xu' }
      ]},
      { q: '听说您收了不少女弟子？', a: [
        { who: 'yuan', t: '闺中能诗的人多得很，只是没人替她们传名。', tag: 'xu' },
        { who: 'pang', t: '袁枚广收诗弟子，女弟子尤其多，《随园诗话》也选录了大量女诗人的作品，当时颇受卫道之士攻击。', src: 'shihuaWk', tag: 'chuan' }
      ]}
    ],
    notes: [
      { tag: 'tu', t: '“诗世界”是袁起《随园图》上标注的景名之一。', src: 'tuji' },
      { tag: 'wen', t: '《随园诗话》初刊于乾隆五十五年（1790）。本页设定的访园时间是 1785 年，那时此书仍在编写中。', src: 'shihua' },
      { tag: 'tui', t: '诗世界的建筑形制为推测。' }
    ]
  },
  {
    id: 'shuanghu', name: '双湖 · 渡鹤桥', time: 0.6, mode: 'zhi',
    lines: [
      { who: 'yuan', t: '随其夹涧，为之桥；随其湍流，为之舟。', q: 1, src: 'ji', tag: 'wen' },
      { who: 'yuan', t: '两片湖水之间夹着一道涧，就架一座桥；水面宽的地方，泊一条小船。', tag: 'xu' },
      { who: 'ke', t: '湖边那座小亭呢？', tag: 'xu' },
      { who: 'yuan', t: '随其下，为置溪亭。', q: 1, src: 'ji', tag: 'wen' },
      { who: 'pang', t: '园中还有一方菡萏池。仲春时荷叶还没出水，要到夏天才是满池荷花。', tag: 'tui' }
    ],
    notes: [
      { tag: 'chuan', t: '“双湖”“菡萏池”“澄碧泉”以及桥名见于后人所录随园景名。桥名有“渡鹤桥”“渡雀桥”两种写法。', src: 'renmin' },
      { tag: 'wen', t: '《随园记》的“随其夹涧，为之桥；随其湍流，为之舟”，说明园中确实有桥、有舟。', src: 'ji' },
      { tag: 'tui', t: '两湖的形状、桥型（单孔石拱）和溪亭的位置为推测。' }
    ]
  },
  {
    id: 'xiangxue', name: '香雪海', time: 0.66, mode: 'shang',
    lines: [
      { who: 'yuan', t: '你来晚了几日，梅花已经在落了。不过不要紧，杏花跟着就开。', tag: 'xu' },
      { who: 'pang', t: '因园中四时皆花，益以虫鸟之音，雨雪之景，因之游人不断。', q: 1, src: 'renmin', tag: 'chuan' },
      { who: 'yuan', t: '一年到头都有人来逛，我也乐得有人一同看花。', tag: 'xu' }
    ],
    notes: [
      { tag: 'chuan', t: '“香雪海”（梅林）见于后人所录随园景名。梅林的范围和株数为推测。', src: 'renmin' },
      { tag: 'chuan', t: '陈诒绂《金陵园墅志》说随园“四时皆花”，并记盛时游人之多，引文转引自人民网。', src: 'renmin' },
      { tag: 'chuan', t: '袁枚在《随园诗话》中说：“雪芹撰《红楼梦》一部……中有所谓大观园者，即余之随园也。”红学界对此多有争议。', src: 'tuji' }
    ]
  },
  {
    id: 'chuxia', name: '厨下', time: 0.72, mode: 'shang',
    lines: [
      { who: 'yuan', t: '每食于某氏而饱，必使家厨往彼灶觚，执弟子之礼。', q: 1, src: 'shidan', tag: 'wen' },
      { who: 'yuan', t: '在谁家吃到一道好菜，我就打发厨子到人家灶下拜师。这些年攒下的方子，正想整理成一部食单。', tag: 'xu' }
    ],
    ask: [
      { q: '做菜，您最看重什么？', a: [
        { who: 'yuan', t: '凡物各有先天，如人各有资禀。', q: 1, src: 'shidan', tag: 'wen' },
        { who: 'yuan', t: '食材本身要好，厨子才有用武之地。', tag: 'xu' }
      ]},
      { q: '宴客总少不了燕窝吧？', a: [
        { who: 'yuan', t: '耳餐者，务名之谓也。贪贵物之名，夸敬客之意，是以耳餐，非口餐也。', q: 1, src: 'shidan', tag: 'wen' },
        { who: 'yuan', t: '不知豆腐得味，远胜燕窝。', q: 1, src: 'shidan', tag: 'wen' }
      ]}
    ],
    outro: [
      { who: 'yuan', t: '可我书斋里偏又自题了一联：', tag: 'xu' },
      { who: 'yuan', t: '无求便是安心法；不饱真为却病方。', q: 1, src: 'renmin', tag: 'chuan' },
      { who: 'ke', t: '您这是嘴上讲养生，灶上讲口福。', tag: 'xu' }
    ],
    notes: [
      { tag: 'wen', t: '《随园食单》刊于乾隆五十七年（1792）。书中“须知单”“戒单”的引文出自袁枚本人。', src: 'shidan' },
      { tag: 'chuan', t: '书斋联“无求便是安心法；不饱真为却病方”，据人民网转述。', src: 'renmin' },
      { tag: 'wen', t: '袁枚的家厨王小余手艺高超，袁枚曾为他作《厨者王小余传》。' },
      { tag: 'tui', t: '随园厨房的位置无考，这里是推测安置。' }
    ]
  },
  {
    id: 'nanlou', name: '南楼', time: 0.84, mode: 'gong', high: 1,
    lines: [
      { who: 'pang', t: '你们登上南楼，推开窗子。', tag: 'tu', look: { garden: 1 } },
      { who: 'yuan', t: '登小仓山，诸景隆然上浮。凡江湖之大，云烟之变，非山之所有者，皆山之所有也。', q: 1, src: 'ji', tag: 'wen', look: { garden: 1 } },
      { who: 'yuan', t: '那道青影是钟山，孝陵就在山南。', tag: 'xu', look: { lm: '钟山' } },
      { who: 'yuan', t: '往东北是鸡鸣寺，寺后便是后湖。', tag: 'xu', look: { lm: '鸡鸣寺' } },
      { who: 'yuan', t: '西边是清凉山，我这小仓山就是从它分出来的。', tag: 'wen', src: 'ji', look: { lm: '清凉山' } },
      { who: 'yuan', t: '西南那片水是莫愁湖。', tag: 'xu', look: { lm: '莫愁湖' } },
      { who: 'yuan', t: '南边那座塔，就是报恩寺的琉璃塔。天晴的时候，塔上的琉璃晃得人睁不开眼。', tag: 'xu', look: { lm: '长干塔' } },
      { who: 'yuan', t: '塔后那一片高岗，是雨花台。', tag: 'xu', look: { lm: '雨花台' } },
      { who: 'ke', t: '金陵的名胜，站在这一座楼上就全看到了。', tag: 'xu', look: { garden: 1 } },
      { who: 'yuan', t: '余竟以一官易此园，园之奇，可以见矣。', q: 1, src: 'ji', tag: 'wen', look: { garden: 1 } }
    ],
    notes: [
      { tag: 'chuan', t: '据今人对袁起《随园图》的解读，登南楼可望钟山、鸡鸣山、清凉山、四望山、卢龙山、莫愁湖、玄武湖、冶城、长干塔、雨花台。', src: 'renmin' },
      { tag: 'wen', t: '《随园记》原文：“凡称金陵之胜者，南曰雨花台，西南曰莫愁湖，北曰钟山，东曰冶城，东北曰孝陵，曰鸡鸣寺。”本页远景按今日实际方位摆放，所以与袁枚所说的方向略有出入。', src: 'ji' },
      { tag: 'chuan', t: '“长干塔”就是大报恩寺琉璃塔。1785 年时塔还在，七十一年后（1856）毁于太平天国战火。', src: 'baoen' },
      { tag: 'tui', t: '南楼的层数、开窗方式和所在位置（南岭）为推测。' }
    ]
  },
  {
    id: 'mubie', name: '暮别', time: 1.0, mode: 'yu',
    lines: [
      { who: 'tong', t: '先生，天黑了，灯笼点上了。', tag: 'xu' },
      { who: 'yuan', t: '路上仔细。下回再来，正赶上紫藤开花。', tag: 'xu' },
      { who: 'ke', t: '这园子，百年以后还会在吗？', tag: 'xu' },
      { who: 'yuan', t: '然则余之仕与不仕，与居兹园之久与不久，亦随之而已。', q: 1, src: 'ji', tag: 'wen' },
      { who: 'pang', t: '后来的事，袁枚没有看到。', tag: 'xu' }
    ],
    notes: [
      { tag: 'wen', t: '“亦随之而已”是《随园记》的结语之一：做不做官、在园中住多久，都随它去。', src: 'ji' },
      { tag: 'xu', t: '送别一幕是为游览编写的情节。' }
    ]
  }
];

// 尾声：随园消失的时间轴
const EPILOGUE = [
  { year: '嘉庆二年', ad: '1797', stage: 1,
    t: '袁枚在随园病逝，终年八十二岁。临终前他嘱咐儿子：',
    q: '能洒扫光鲜，照旧庋置，使宾客来者见依然如我尚存，如此撑持三十年。',
    after: '袁家后人实际守了这座园子六十余年。',
    src: 'after', tag: 'wen' },
  { year: '咸丰三年', ad: '1853', stage: 2,
    t: '太平军攻占南京，定都天京。此后，占地二百二十余亩的随园被平垦为田，亭台楼阁荡然无存。三年后，南楼上望见的那座琉璃塔也毁于战火。',
    src: 'renmin', tag: 'chuan' },
  { year: '同治四年', ad: '1865', stage: 3,
    t: '袁枚的族孙袁起依据史料和记忆，用近乎白描的笔法画成《随园图》，今藏南京博物院。袁家想过重建，终因财力不足，只在袁枚墓旁修了一座祠堂。从此，随园只存在于画中。',
    src: 'renmin', tag: 'chuan' },
  { year: '民国', ad: '1923–1935', stage: 4,
    t: '1923 年，金陵女子大学在随园旧址建永久校址。1935 年，南京辟建广州路等道路，征用遗址土地四十亩，后人所立的随园纪念石碑也被拆除。',
    src: 'tuji', tag: 'chuan' },
  { year: '1974', ad: '一说 1973', stage: 5,
    t: '修建五台山体育设施时，袁枚墓被清理。',
    q: '至此偌大金陵城，再无袁枚一砖一瓦。',
    src: 'after', tag: 'chuan' }
];

// 南楼远眺的地标（方位角：正北 0°、正东 90°；距离为示意）
const LANDMARKS = [
  // 方位按实测经纬度折算；距离按比例压缩（远处压得更多），高度随距离同比缩放，保持从园中望去的视角大小
  { name: '钟山', az: 74, d: 2350, kind: 'mount' },
  { name: '孝陵', az: 85, d: 2050, kind: 'none' },
  { name: '鸡鸣寺', az: 60, d: 1000, kind: 'temple' },
  { name: '后湖', az: 45, d: 1450, kind: 'lake' },
  { name: '清凉山', az: 251, d: 740, kind: 'hill' },
  { name: '莫愁湖', az: 220, d: 1050, kind: 'lake' },
  { name: '冶城', az: 165, d: 740, kind: 'temple' },
  { name: '长干塔', az: 162, d: 1660, kind: 'pagoda' },
  { name: '雨花台', az: 172, d: 1970, kind: 'hill' }
];

// ---------- 配音键与朗读文本 ----------
function assignVoiceKeys() {
  STATIONS.forEach(st => {
    st.lines.forEach((L, i) => L.v = `${st.id}_l${i}`);
    (st.ask || []).forEach((a, k) => { a.v = `${st.id}_q${k}`; a.a.forEach((L, i) => L.v = `${st.id}_a${k}_${i}`); });
    (st.outro || []).forEach((L, i) => L.v = `${st.id}_o${i}`);
  });
  EPILOGUE.forEach((E, k) => { E.vt = `epi${k}_t`; if (E.q) E.vq = `epi${k}_q`; if (E.after) E.va = `epi${k}_a`; });
}
assignVoiceKeys();
