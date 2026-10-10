"""Present actual Blender renders in a deterministic project-style preview frame."""
import hashlib
import json
import zipfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/hospital-floor-reference-v1'
FONT='C:/Windows/Fonts/msyh.ttc'
BOLD='C:/Windows/Fonts/msyhbd.ttc'
W,H=2560,1440


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def make_preview(theme):
    dark=theme=='dark'
    c=({'bg':'#102632','panel':'#0d2235','raised':'#162d43','line':'#29465f',
        'ink':'#e6f2ff','muted':'#afc5db','accent':'#70d7ff','good':'#62dfc7',
        'warn':'#ffd080','select':'#214663'} if dark else
       {'bg':'#dce8ed','panel':'#f6fbff','raised':'#edf7ff','line':'#bfd7e4',
        'ink':'#08275b','muted':'#42618b','accent':'#005bea','good':'#087d77',
        'warn':'#925900','select':'#deedff'})
    image=Image.new('RGB',(W,H),c['bg']);draw=ImageDraw.Draw(image)
    def text(x,y,body,size=25,color=None,bold=False,anchor=None):
        draw.text((x,y),body,font=ImageFont.truetype(BOLD if bold else FONT,size),
                  fill=color or c['ink'],anchor=anchor)
    def rect(bounds,fill=None,r=10,outline=None,width=2):
        draw.rounded_rectangle(bounds,radius=r,fill=fill or c['panel'],outline=outline or c['line'],width=width)
    # This is a static presentation frame, not an assertion of runtime integration.
    rect((16,16,W-16,119),r=4)
    text(W/2,36,'DIGITAL TWIN COMMAND',18,c['accent'],anchor='mt')
    text(W/2,65,'数字孪生智慧医院管理平台',34,bold=True,anchor='mt')
    rect((40,43,310,94),c['raised'],6)
    text(63,52,'示例病区',26,bold=True)
    draw.polygon([(267,65),(285,65),(276,77)],fill=c['ink'])
    text(2160,54,'深色模式' if dark else '浅色模式',25,c['accent'],True)
    text(2390,60,'方案预览',21,c['muted'])
    rect((18,137,1830,1330),c['bg'],8)
    rect((614,159,1250,224),c['panel'],8)
    rect((622,166,926,216),c['accent'],6,c['accent'])
    text(774,190,'楼层鸟瞰',27,'#ffffff' if not dark else '#082739',True,'mm')
    text(1087,190,'走廊视角',26,c['muted'],anchor='mm')
    for x,label,key in [(1390,'入住','good'),(1530,'空床','muted'),(1670,'待处理','warn')]:
        draw.ellipse((x,183,x+14,197),fill=c[key]);text(x+24,171,label,22,c['muted'])
    model=Image.open(OUT/(theme+'.png')).convert('RGBA')
    render_size=model.size
    bbox=model.getchannel('A').getbbox()
    if not bbox:raise RuntimeError('Blender render is empty')
    model=model.crop(bbox)
    scale=min(1740/model.width,1002/model.height)
    model=model.resize((round(model.width*scale),round(model.height*scale)),Image.Resampling.LANCZOS)
    px=924-model.width//2;py=780-model.height//2
    rgba=image.convert('RGBA')
    shadow=Image.new('RGBA',(W,H));mask=Image.new('L',(W,H))
    mask.paste(model.getchannel('A'),(px+4,py+22))
    mask=mask.filter(ImageFilter.GaussianBlur(17)).point(lambda a:round(a*.25))
    shadow.putalpha(mask);rgba=Image.alpha_composite(rgba,shadow)
    rgba.alpha_composite(model,(px,py));image=rgba.convert('RGB');draw=ImageDraw.Draw(image)
    report=json.loads((OUT/'validation.json').read_text(encoding='utf-8'))
    def projected(uv):
        return (px+(uv[0]*render_size[0]-bbox[0])*scale,
                py+((1-uv[1])*render_size[1]-bbox[1])*scale)
    for room in report.get('roomProjection',[]):
        if room['number']=='103':
            points=[projected(uv) for uv in room['corners']]
            draw.line(points+[points[0]],fill=c['accent'],width=4,joint='curve')
        x,y=projected(room['label'])
        selected=room['number']=='103'
        rect((x-42,y-23,x+42,y+22),c['select'] if selected else c['panel'],4,
             c['accent'] if selected else c['line'])
        text(x,y-1,room['number'],24,c['accent'] if selected else c['ink'],True,'mm')
        if room['number']=='106':
            draw.ellipse((x+48,y-17,x+78,y+13),fill=c['warn'])
            text(x+63,y-3,'!',23,'#102632' if dark else '#ffffff',True,'mm')
    # Shared helper closures now draw into the updated raster.
    rect((1848,137,2542,1408),c['panel'],12)
    text(1875,163,'病区工作台',36,bold=True)
    text(1875,214,'楼层总览 / 示例数据',20,c['muted'])
    for i,title in enumerate(['概览','待办','巡视']):
        x=1875+i*211
        rect((x,255,x+200,310),c['select'] if i==0 else c['raised'],6)
        text(x+100,280,title,25,c['accent'] if i==0 else c['muted'],i==0,'mm')
    for i,(label,value) in enumerate([('病房',8),('床位',16),('入住',12),('空床',4)]):
        x=1875+i*160
        rect((x,337,x+146,469),c['raised'],8)
        text(x+17,355,label,22,c['muted']);text(x+17,400,str(value),39,bold=True)
    text(1875,504,'病房列表',28,bold=True)
    rect((2100,496,2511,543),c['raised'],6);text(2122,503,'搜索房间号',22,c['muted'])
    rect((1875,568,2516,613),c['raised'],4)
    for x,label in [(1895,'房间'),(2030,'床位状态'),(2200,'入住 / 总数'),(2390,'状态')]:text(x,577,label,19,c['muted'])
    occupancies=[2,2,2,1,1,1,2,1]
    assert sum(occupancies)==12
    for i,count in enumerate(occupancies):
        y=618+i*60
        if i==2:rect((1875,y,2516,y+54),c['select'],6,c['accent'])
        else:draw.line((1880,y+55,2510,y+55),fill=c['line'],width=1)
        text(1895,y+11,str(101+i),24,c['accent'] if i==2 else c['ink'],i==2)
        for slot in range(2):
            dot=c['good'] if slot<count else c['muted']
            draw.ellipse((2060+slot*30,y+24,2073+slot*30,y+37),fill=dot)
        text(2223,y+12,f'{count} / 2',23)
        text(2390,y+12,'待处理' if i==5 else '正常',22,c['warn'] if i==5 else c['good'])
    text(1875,1130,'设备状态',28,bold=True)
    for i,(title,count) in enumerate([('门口屏','8 / 8'),('床头屏','16 / 16')]):
        x=1875+i*329;rect((x,1183,x+312,1337),c['raised'],8)
        text(x+24,1200,title,25,bold=True);text(x+24,1242,'● 在线',21,c['good'])
        text(x+24,1281,count+'  正常',23,c['muted'])
    text(1875,1360,'以上均为示例数据，不代表实时状态',18,c['muted'])
    rect((482,1354,1374,1419),c['panel'],28)
    for i,label in enumerate(['护士站','病房走廊','病房内']):
        x=500+i*290
        if i==1:rect((x,1361,x+270,1411),c['accent'],22,c['accent'])
        text(x+135,1386,label,26,('#082739' if dark else '#ffffff') if i==1 else c['muted'],i==1,'mm')
    text(38,1367,'Blender 实际渲染',20,c['muted'])
    path=OUT/(theme+'-project-preview.png');image.save(path)
    return path


def main():
    report=json.loads((OUT/'validation.json').read_text(encoding='utf-8'))
    if report['failures'] or len(report['renderProvenance'])!=3:
        raise RuntimeError('Successful native and final render validation required')
    paths=[make_preview(theme) for theme in ['light','dark']]
    board=Image.new('RGB',(W,H*2+104),'#edf3f7');draw=ImageDraw.Draw(board)
    for i,(path,title) in enumerate(zip(paths,['浅色模式 · Blender 实际渲染','深色模式 · Blender 实际渲染'])):
        y=i*(H+52)
        draw.text((24,y+5),title,font=ImageFont.truetype(BOLD,29),fill='#133748')
        board.paste(Image.open(path),(0,y+52))
    board.save(OUT/'comparison.png')
    # Standalone model image retains actual rendering and uses no AI repainting.
    for theme,color in [('light','#dce8ed'),('dark','#102632'),('detail','#dce8ed')]:
        image=Image.open(OUT/(theme+'.png')).convert('RGBA')
        bg=Image.new('RGBA',image.size,color);bg.alpha_composite(image)
        bg.convert('RGB').save(OUT/(theme+'-model.png'))
    guide=ROOT/'docs/model-guides/hospital-floor-reference-v1.md'
    guide.write_text(f'''# 医院楼层鸟瞰 Blender V1

2026-10-09。根据已确认的浅深色概念图重建可编辑楼层，所有模型图由 Blender Cycles 实际渲染。界面预览是实际渲染图与静态界面框架的排版合成，不是已接入网页的截图。

## 交付

- 源文件：`output/hospital-floor-reference-v1/hospital-floor-reference-v1.blend`
- 场景：`Floor_Light`、`Floor_Dark`；共享几何和全景相机，分别保存环境光与主题背景。
- 全景相机：`Floor_Overview_Camera`；近景相机：`Floor_Detail_Camera`。
- 模型图：`light-model.png`、`dark-model.png`、`detail-model.png`。
- 项目风格预览：`light-project-preview.png`、`dark-project-preview.png`；总览 `comparison.png`。
- 原始透明渲染：`light.png`、`dark.png`、`detail.png`。
- 对照参考、贴图、字体已经打包在 `.blend` 中。

## 模型与项目约定

8 间双床病房、16 张独立实体病床，中央弧形护士站、3 个工作位、电梯厅、卫生及储物配套。病床包含可编辑护栏、控制键、双轮脚轮、床品褶皱、床头气电接口、呼叫手柄、床头屏、床头柜和输液架。

根节点 `Hospital_Floor_Reference_V1`；房间 `Room_101` 至 `Room_108`。床位有独立 `bedId`、`roomId`、`slot`，8 个门口屏和16个床头屏具有设备角色节点。标识均为示例；生产接入应显式映射真实病区、房间和床位标识，不能以数组顺序直接绑定。`Preview_Graphics` 可隐藏，房间标签、选中框是展示层。

示意层尺寸约25.5×14.66米，来自视觉推定，没有实测建筑底图。参考图局部尺寸、遮挡结构、文字和数量存在AI不一致，已按8房16床落实；不宣称百分百像素一致、BIM或工程合规。当前未导出网页GLB、未修改项目运行场景。

## 实际验证

- 重开源文件通过：房间 {report['rooms']}，实体床位 {report['physicalBeds']}。
- 网格对象 {report['meshObjects']:,}，求值后三角面 {report['evaluatedTriangles']:,}。
- 128 个脚轮轮胎落地检查，最大误差 {report['maxTyreFloorGapMetres']:.8f} 米。
- 床体未越出房间地面范围、双床未重叠；两场景共享相同几何和相机。
- 3 张最终渲染通过源文件 SHA256、PNG SHA256、尺寸和采样数检查。
- 检查范围不包括通道/设备扫掠体、工程规范和网页性能。

## 重建

从项目根目录使用 Blender 4.5.3：

```powershell
& 'output/tools/blender/blender-4.5.3-windows-x64/blender.exe' --background --threads 8 --python-exit-code 1 --python scripts/build_hospital_floor_reference_v1.py -- --skip-render
& 'output/tools/blender/blender-4.5.3-windows-x64/blender.exe' --background --threads 8 --python-exit-code 1 --python scripts/build_hospital_floor_reference_v1.py -- --render-only --width 2400 --samples 64 --views light dark detail
& 'output/tools/blender/blender-4.5.3-windows-x64/blender.exe' --background --threads 8 --python-exit-code 1 --python scripts/build_hospital_floor_reference_v1.py -- --denoise-only --views light dark detail
& 'output/tools/blender/blender-4.5.3-windows-x64/blender.exe' --background --threads 6 --python-exit-code 1 --python scripts/verify_hospital_floor_reference_v1.py
```

最后使用装有 Pillow 的 Python 运行 `scripts/package_hospital_floor_reference_v1.py`，生成界面排版图和ZIP。原始EXR为重渲染中间文件，不装入交付包。
''',encoding='utf-8')
    scripts=['build_hospital_floor_reference_v1.py','hospital_floor_reference_details.py',
             'verify_hospital_floor_reference_v1.py','package_hospital_floor_reference_v1.py',
             'hospital_reconstruction_common.py','ward_graphite_common.py','ward_graphite_bed.py',
             'ward_graphite_equipment.py']
    files=[p for p in OUT.iterdir() if p.suffix in {'.blend','.png','.json'} and p.name!='delivery.json']
    files += [ROOT/'scripts'/name for name in scripts]+[guide]
    files += [ROOT/'output/imagegen/hospital-floor-themes-20261009/hospital-floor-light-dark-v1.png']
    archive=ROOT/'output/hospital-floor-reference-v1-20261009.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for path in files:z.write(path,path.relative_to(ROOT).as_posix())
    with zipfile.ZipFile(archive) as z:
        bad=z.testzip()
        if bad:raise RuntimeError('Archive CRC failure: '+bad)
        for path in files:
            if hashlib.sha256(z.read(path.relative_to(ROOT).as_posix())).hexdigest()!=sha(path):
                raise RuntimeError('Archive content mismatch')
    delivery={'archive':str(archive),'bytes':archive.stat().st_size,'sha256':sha(archive),
              'files':len(files),'archiveVerified':True,'sourceSha256':report['sourceSha256'],
              'previewNote':'Actual Blender render with static UI composition; not runtime integration'}
    (OUT/'delivery.json').write_text(json.dumps(delivery,indent=2),encoding='utf-8')
    print(json.dumps(delivery,indent=2))


if __name__=='__main__':main()
