from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset
import shutil,json,hashlib
import argparse
parser=argparse.ArgumentParser(description='Build bundled, subset OFL fonts from pinned downloaded originals.')
parser.add_argument('--source',required=True,type=Path,help='Directory containing original TTFs, OFL files and sources.json')
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent;source=args.source;out=root/'assets/fonts';out.mkdir(parents=True,exist_ok=True)
# UI corpus plus common simplified Chinese. Rare user-authored characters can fall back to OS CJK fonts.
corpus=''.join(p.read_text() for p in root.rglob('*') if p.is_file() and p.suffix in ['.js','.html','.css'])
common=set()
for lead in range(0xa1,0xf8):
 for trail in range(0xa1,0xff):
  try:common.update(bytes([lead,trail]).decode('gb2312'))
  except UnicodeDecodeError:pass
latin=set(range(0x20,0x250))|set(range(0x1e00,0x1f00))|set(range(0x2000,0x2070))|{0x2212}
chars={ord(c) for c in corpus}|{ord(c) for c in common}|latin
reports=[]
for filename,name,dest,axes,unicodes in [('NotoSansSC.ttf','Streakfit Han','streakfit-han.woff2',{'wght':(400,700)},chars),('Inter.ttf','Streakfit UI','streakfit-ui.woff2',{'opsz':14,'wght':(400,700)},latin),('Barlow-SemiBold.ttf','Streakfit Display','streakfit-display.woff2',{},latin)]:
 font=TTFont(source/filename)
 options=subset.Options();options.flavor='woff2';options.layout_features=['*'];options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*']
 sub=subset.Subsetter(options=options);sub.populate(unicodes=unicodes);sub.subset(font)
 if axes:font=instantiateVariableFont(font,axes,inplace=True)
 for record in font['name'].names:
  if record.nameID in [1,2,3,4,6,16,17]:
   value={1:name,2:'Regular',3:name+'-Preview0341',4:name,6:name.replace(' ','')+'-Preview0341',16:name,17:'Regular'}[record.nameID]
   record.string=value.encode(record.getEncoding())
 font.flavor='woff2';font.save(out/dest)
 data=(out/dest).read_bytes();reports.append({'name':name,'file':dest,'bytes':len(data),'glyphs':len(font.getBestCmap()),'sha256':hashlib.sha256(data).hexdigest()})
for family in ['NotoSansSC','Inter','Barlow']:shutil.copyfile(source/(family+'-OFL.txt'),out/(family+'-OFL.txt'))
source_record=json.loads((source/'sources.json').read_text());source_record['outputs']=reports;source_record['coverage']='UI corpus plus GB2312 common simplified Chinese; Latin and punctuation. System CJK fallback for rare user text.'
(out/'SOURCES.json').write_text(json.dumps(source_record,indent=2)+'\n');print(json.dumps(reports,indent=2))
