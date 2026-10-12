# 医院外观 V3：门诊停车与医院前场精修

2026-10-09。基于保留的 V2 原生模型，新增小规模门诊停车、访客进场道、急救通道延伸段和医院前场配套。四张图均由保存的 Blender 场景真实渲染，已逐张检查。源文件重新打开验证通过，失败项为 0。

## 本轮改进

- 前场左侧设置 14 个车位，包含 2 个带轮椅标识与侧向接驳空间的无障碍示意位。放置 6 辆普通轿车，保留 8 个空位；车身、玻璃、轮胎、轮毂、车灯和门缝可编辑。
- 访客从左侧道路进入停车区或门诊落客区；右侧延续急救通道，并添加急救导视和地面标识。停车中央通道宽 6 米，是场景设计尺寸，不是交通专项审批结果。
- 补充到入口的中央步行路径、过街标线、局部提示铺装、园林座椅、分层绿化、照明、垃圾箱和入口排水沟。
- 修正入口侧坡道的坡面、落地平台与扶手。楼前花坛退让出坡道空间。
- 细化临床楼翼的石材横带及竖向分区，延长右楼标识石材墙，补充门诊入口石材门楣；改善玻璃透射和石材色调。
- 停车构件使用独立的米制坐标根对象，避免建筑原有横向缩放改变车辆比例。共用车位线只保留一份实体几何，避免重叠面引起渲染黑块。

## 交付文件

| 文件 | 内容 |
| --- | --- |
| [hospital-exterior-reference-v3.blend](E:/projects/digital-twin/output/hospital-exterior-reference-v3/hospital-exterior-reference-v3.blend) | 独立可编辑场景，默认主图机位，贴图与字体已打包 |
| [hero.png](E:/projects/digital-twin/output/hospital-exterior-reference-v3/hero.png) | 2560 × 1441，全景，64 samples |
| [parking.png](E:/projects/digital-twin/output/hospital-exterior-reference-v3/parking.png) | 1600 × 900，停车区近景，48 samples |
| [entrance.png](E:/projects/digital-twin/output/hospital-exterior-reference-v3/entrance.png) | 1600 × 900，门诊入口，48 samples |
| [comparison.png](E:/projects/digital-twin/output/hospital-exterior-reference-v3/comparison.png) | 1600 × 900，以 V2 原主机位渲染 V3，48 samples |
| [validation.json](E:/projects/digital-twin/output/hospital-exterior-reference-v3/validation.json) | 源文件、几何、道路、车位、轮胎落地及成图来源校验 |
| [manifest.json](E:/projects/digital-twin/output/hospital-exterior-reference-v3/manifest.json) | 版本、源文件、机位和车位记录 |

四份 `*-render-settings.json` 包含源文件及 PNG 的 SHA-256、尺寸、采样和色彩管理参数。`comparison.png` 可与包内 `comparison-v2.png` 对照。交付包还包含原概念图、环境许可、建模与验证脚本和 `checksums.json`。

## 实际验证

| 指标 | 结果 |
| --- | --- |
| Blender | 4.5.3 LTS |
| 源文件大小 | 147,484,262 字节 |
| Mesh 对象 | 20,931 |
| 包含实例与修改器的求值三角面 | 7,914,902 |
| 车位 / 无障碍示意位 / 车辆 | 14 / 2 / 6 |
| 停放车辆轮胎 | 24 个，逐个对实际停车路面射线检查通过 |
| 停车车轮最大路面误差 | 0.00000006 米，检查阈值 0.02 米 |
| 车辆与车位 | 车辆均在各自车位内，无车辆重复占位，无车位或车辆侵入指定急救区域 |
| 道路连接 | 停车通道连接门诊道路；访客和急救道路均连接公共道路 |
| 坡道 | 上下端与各自平台的高度差小于 0.01 米 |
| V2 对照机位 | 与保留的 V2 主机位匹配 |
| 四张正式图 | 尺寸、采样、降噪和源文件/图片哈希全部通过 |
| V2 原源文件 | SHA-256 与本轮开始前一致，未覆盖 |

高精度源模型用于编辑及离线渲染，三角面数不代表网页实时预算。

## 编辑与复现

主要新增脚本为 [refine_hospital_exterior_reference_v3.py](E:/projects/digital-twin/scripts/refine_hospital_exterior_reference_v3.py)、[hospital_exterior_parking_v3.py](E:/projects/digital-twin/scripts/hospital_exterior_parking_v3.py)、[hospital_exterior_campus_v3.py](E:/projects/digital-twin/scripts/hospital_exterior_campus_v3.py) 和 [verify_hospital_exterior_reference_v3.py](E:/projects/digital-twin/scripts/verify_hospital_exterior_reference_v3.py)。

医院原有根对象名为 `HospitalExterior_Reference_V3`；停车与新增前场分别位于独立米制根 `V3_Campus` 下的 `V3_Parking`、`V3_Hospital_Forecourt`。车位对象记录编号、宽长和是否无障碍示意位；车辆记录所属车位，便于后续替换或减少车辆。

源文件可独立打开和编辑。生成脚本复用 V2 的渲染、几何及验证函数，交付包提供全部脚本依赖，但不重复打包 V2 `.blend`；从头复建仍需要项目中原有的 V2 源文件、概念图和许可文件，并保持原目录关系。重建会替换生成的 V3 文件，手工编辑前建议另存版本。

本机大场景直接全帧降噪可能超出内存，正式图采用两阶段 Blender 流程：先保存线性多层 EXR，再退出场景进程，在空场景中执行 OIDN 合成降噪。几何和分辨率保持不变。源文件默认采样为 96；交付采样以每张图片的参数记录为准。

```powershell
Set-Location 'E:/projects/digital-twin'
$hospitalBlender = 'output/tools/blender/blender-4.5.3-windows-x64/blender.exe'
& $hospitalBlender --background --threads 8 --python-exit-code 1 --python scripts/refine_hospital_exterior_reference_v3.py -- --skip-render
if ($LASTEXITCODE -ne 0) { throw 'V3 构建失败' }

foreach ($hospitalView in @('hero','entrance','parking','comparison')) {
    $hospitalWidth = if ($hospitalView -eq 'hero') { 2560 } else { 1600 }
    $hospitalSamples = if ($hospitalView -eq 'hero') { 64 } else { 48 }
    & $hospitalBlender --background --threads 8 --python-exit-code 1 --python scripts/refine_hospital_exterior_reference_v3.py -- --render-only --raw --views $hospitalView --width $hospitalWidth --samples $hospitalSamples
    if ($LASTEXITCODE -ne 0) { throw 'V3 EXR 渲染失败' }
    & $hospitalBlender --background --threads 8 --python-exit-code 1 --python scripts/refine_hospital_exterior_reference_v3.py -- --denoise-only --views $hospitalView
    if ($LASTEXITCODE -ne 0) { throw 'V3 降噪失败' }
}
& $hospitalBlender --background --threads 6 --python-exit-code 1 --python scripts/verify_hospital_exterior_reference_v3.py --
```

## 范围

这是依据概念图进一步设计的医院可视化场景。停车、无障碍示意位、坡道和导视表达医院使用场景，未做实地测绘、交通转弯轨迹分析、停车专项或无障碍法规审查，不作为工程施工依据。单张参考图不可见部分包含设计补充，未宣称百分百还原。

本轮没有修改前端业务代码，没有进行网页 GLB 导出、加载或性能验收，也未覆盖上一轮手术室模型。前期预览及 EXR 是中间文件，不纳入正式交付包。
