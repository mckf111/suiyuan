# 用法：python 按顺序改名.py 2_袁枚_清单.csv 生成的音频文件夹
# 配音工具按“朗读文本.txt”逐行生成音频后，文件名通常是 001、002……
# 本脚本按文件名排序，依次改成清单里的编号（如 chaimen_l3.mp3），扩展名保留原样。
import csv, os, sys
lst, folder = sys.argv[1], sys.argv[2]
names = [r['文件名'] for r in csv.DictReader(open(lst, encoding='utf-8-sig'))]
files = sorted(f for f in os.listdir(folder) if f.lower().endswith(('.mp3', '.wav', '.m4a', '.ogg')))
if len(files) != len(names):
    sys.exit(f'数量对不上：清单 {len(names)} 句，文件夹里 {len(files)} 个音频。请先检查有没有漏句或多出的文件。')
for f, n in zip(files, names):
    ext = os.path.splitext(f)[1]
    os.rename(os.path.join(folder, f), os.path.join(folder, os.path.splitext(n)[0] + ext))
print(f'已改名 {len(files)} 个文件。')
