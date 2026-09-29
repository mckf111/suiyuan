import json,re
S=json.load(open('script_rows.json'))
ROLE={'yuan':'袁枚','tong':'书童','pang':'旁白','ke':'你（访客）'}
PRON=[('筦龠','筦龠 guǎn yuè'),('隅立','隅 yú'),('三楹','楹 yíng'),('颓弛','弛 chí'),('百卉','卉 huì'),('为置','为置 wèi'),('为之','为之 wéi'),('湍流','湍 tuān'),('夹涧','涧 jiàn'),('舍官','舍 shě'),('舍了','舍 shě'),('月俸','俸 fèng'),('三坟','坟 fén'),('八索','索 suǒ'),('合缝','缝 fèng'),('为藏','为藏 wèi cáng'),('寄还','还 huán'),('长跋','长 cháng'),('罗聘','聘 pìn'),('堆垛','垛 duò'),('菡萏','菡萏 hàn dàn'),('陈诒绂','诒绂 yí fú'),('灶觚','觚 gū'),('庋置','庋 guǐ'),('偌大','偌 ruò'),('冶城','冶 yě'),('打个盹','盹 dǔn'),('攒下','攒 zǎn'),('平垦为田','为田 wéi'),('余竟','余 yú'),('余之仕','余 yú，仕 shì'),('居兹','兹 zī'),('至焉','焉 yān'),('乐得','乐 lè'),('长得','长 zhǎng'),('晃得','晃 huǎng'),('高岗','岗 gǎng'),('诙谐','诙 huī'),('撑持','持 chí'),('喈',''),('嘱咐','咐 fu（轻声）'),('倒也','倒 dào'),('夭阏','')]
EXTRA={
 'chaimen_l0':'开场，平静舒展；括号里的年份不念','chaimen_l2':'朝园里喊，欢快','chaimen_l3':'见到老友，热络带笑',
 'chaimen_a1_0':'随口一句，带点得意','chaimen_o1':'笑着，起身引路',
 'dayuan_a0_1':'把上一句古文说成家常话','dayuan_a1_1':'带点感慨',
 'shanfang_l2':'略带考校的口气','shanfang_l3':'被说中，抚掌而笑',
 'shucang_a1_1':'自嘲','shucang_a1_2':'点睛之句，稍作停顿再说',
 'xiaomian_l0':'慵懒一点',
 'tenghua_l0':'边走边说','shishijie_a1_0':'认真，替人不平',
 'xiangxue_l0':'略带惋惜，随即转为轻快',
 'chuxia_l1':'兴致勃勃','chuxia_o0':'压低声音，像说个秘密','chuxia_o2':'笑着打趣',
 'nanlou_l0':'推窗，语气放开','nanlou_l2':'边指边说，节奏舒展','nanlou_l3':'边指边说','nanlou_l4':'边指边说','nanlou_l5':'边指边说','nanlou_l6':'带点骄傲','nanlou_l7':'边指边说','nanlou_l8':'由衷感叹','nanlou_l9':'全篇情绪最高处，从容不张扬',
 'mubie_l0':'轻声提醒','mubie_l1':'殷勤叮嘱','mubie_l2':'迟疑地问','mubie_l3':'淡然，略带怅惘，放慢','mubie_l4':'停一拍再说，轻',
 'epi4_q':'全片最后一句，放慢，收住',
}
DEF={'yuan':'','tong':'清亮、恭敬','pang':'','ke':'好奇、客气'}
def tip(r):
    t=[]
    if r['k'] in EXTRA: t.append(EXTRA[r['k']])
    elif r['q']: t.append('原文，放慢，按标点断句' if r['who']!='pang' or not r['k'].startswith('epi') else '引文，放慢')
    elif DEF[r['who']]: t.append(DEF[r['who']])
    ps=[n for w,n in PRON if n and w in r['t']]
    if ps: t.append('读音：'+'；'.join(dict.fromkeys(ps)))
    return '。'.join(t)
secs=[]
n=0
for i,st in enumerate(S):
    lines=['| 编号 | 角色 | 台词 | 提示 |','| --- | --- | --- | --- |']
    for r in st['rows']:
        n+=1
        txt=('「'+r['t']+'」') if r['q'] else r['t']
        lines.append(f"| {r['k']} | {ROLE[r['who']]} | {txt} | {tip(r)} |")
    head = f"## {i+1}. {st['name']}" if st['name']!='尾声' else "## 尾声 · 随园之后"
    secs.append(head+"\n\n"+"\n".join(lines))
json.dump(secs,open('script_secs.json','w'),ensure_ascii=False)
from collections import Counter
c=Counter(r['who'] for st in S for r in st['rows']); ch=Counter()
for st in S:
    for r in st['rows']: ch[r['who']]+=len(r['t'])
print(n, dict(c), dict(ch))
print(secs[0][:600])
