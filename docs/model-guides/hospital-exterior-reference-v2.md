# 医院外观 V2：Blender 原生精修交付

本版本在保留医院外观 V1 的基础上，继续细化建筑立面、入口大厅、玻璃雨棚、园区道路、植物和远景。交付对象是可编辑的 Blender 场景及其真实 Cycles 渲染图。原参考图用于指导构图与外观，未用于替代三维模型渲染。

交付状态：四张正式图已完成并逐张检查，最终 `.blend` 已重新打开验证，失败项为 0。主图为 2560 × 1441，入口、立面及同机位对照图均为 1600 × 900；四份成图记录的源文件与 PNG 哈希全部匹配。

## 已实现的精修

- **建筑比例与立面层次**：按参考调整建筑横向体量，保留人物和救护车的宽度比例；调整医院标识，增加竖向石材构件、石材分缝、窗框和滴水细部。主效果图使用调整后的机位，同时保留 V1 原机位用于对照。
- **具有进深的玻璃窗**：移除紧贴玻璃的实心遮挡，补充楼板、窗后墙、隔断、窗帘、不同降下高度的百叶，以及部分室内灯具。玻璃使用透射材质，窗后的明暗变化来自实际几何和材质。
- **入口与大厅**：将大厅改为有内部空间的结构，增加楼板、立柱、夹层栏杆、服务台、等候座椅、室内导视、灯带和自动门门框。入口透过玻璃可看到部分内部空间。
- **分块玻璃雨棚**：雨棚拆分为 64 块玻璃，补充压片、接缝、中间支柱、柱脚和斜撑，使近景能看清构件关系。
- **材质与光照**：重新调整石材、金属、玻璃、沥青和植物的颜色、粗糙度及细微表面起伏；铺地具有砖缝。保留城市 HDR 的照明和反射，单独设置摄影机看到的天空，调整阳光及大厅补光。
- **园区与环境**：园区树木使用三种有分枝和叶片的共享几何原型，增加屋顶植物、比例人物和入口导视；救护车侧道、灯杆和相邻花坛一起调整，避免车道穿入裙楼或花坛。远景增加分层城市、树林、河道及山体，均为场景几何。

## 文件与视图

模型输出目录：`E:\projects\digital-twin\output\hospital-exterior-reference-v2`。

| 文件 | 用途 | 最终验收要求 |
| --- | --- | --- |
| [hospital-exterior-reference-v2.blend](E:/projects/digital-twin/output/hospital-exterior-reference-v2/hospital-exterior-reference-v2.blend) | 可编辑原生场景，默认主效果图机位 | 独立重新打开并通过源文件检查 |
| [hero.png](E:/projects/digital-twin/output/hospital-exterior-reference-v2/hero.png) | 医院整体效果 | 宽度至少 2560，目标 2560 × 1441 |
| [entrance.png](E:/projects/digital-twin/output/hospital-exterior-reference-v2/entrance.png) | 入口雨棚和大厅近景 | 至少 1600 × 900 |
| [facade.png](E:/projects/digital-twin/output/hospital-exterior-reference-v2/facade.png) | 窗框、石材及窗后空间近景 | 至少 1600 × 900 |
| [comparison.png](E:/projects/digital-twin/output/hospital-exterior-reference-v2/comparison.png) | 从 V1 保存的原机位渲染 V2 | 至少 1600 × 900；相机变换和成像参数匹配 V1 |
| [validation.json](E:/projects/digital-twin/output/hospital-exterior-reference-v2/validation.json) | 最终源文件及四张成图验证 | 已通过；包含各项成图来源校验 |
| [manifest.json](E:/projects/digital-twin/output/hospital-exterior-reference-v2/manifest.json) | 源文件、参考图、机位和版本说明 | 随源文件保存 |
| [environment-license.txt](E:/projects/digital-twin/output/hospital-exterior-reference-v2/environment-license.txt) | 环境贴图附带许可说明 | 随交付保留 |

`comparison.png` 是同一 V1 机位下的 V2 渲染，可与 [V1 hero.png](E:/projects/digital-twin/output/hospital-exterior-reference-v1/hero.png) 对照；它不是由两张图拼接的图片。

保留的上一版源文件：[hospital-exterior-reference-v1.blend](E:/projects/digital-twin/output/hospital-exterior-reference-v1/hospital-exterior-reference-v1.blend)。原参考图：[hospital-exterior-high-fidelity-v1.png](E:/projects/digital-twin/output/imagegen/hospital-concepts-20261005/hospital-exterior-high-fidelity-v1.png)。

保存的场景机位分别为 `Reference_Hero_Camera`、`Entrance_Detail_Camera`、`Facade_Detail_Camera` 和 `V1_Comparison_Camera`。主体根对象为 `HospitalExterior_Reference_V2`；楼栋、裙楼、硬质铺地、植物、车辆及远景保留独立分组，便于继续编辑。

交付包按以下内容打包：V2 `.blend`、四张正式渲染图、V1 主效果图、原概念图、环境许可、资产清单与最终验证报告、四份 `*-render-settings.json` 成图来源记录、本文、六个生成/验证脚本及校验和清单。六个脚本包括四个 V2 脚本和 `hospital_reconstruction_common.py`、`hospital_reference_landscape.py` 两个共同依赖。中间预览、EXR 和阶段检查报告不纳入交付包。

包中不包含体积较大的 V1 `.blend`。打包后的 V2 `.blend` 已内嵌所需图像和字体，可以独立打开、编辑和重新渲染；若要从生成脚本完整复建，仍需项目原有的 V1 源文件，并保持脚本中的项目路径关系。包内 V1 效果图用于视觉对照，不能替代复建所需的 V1 源文件。

## 资源打包与最终统计

已重新打开的最终源文件中，`city.exr`、参考概念图、Microsoft YaHei Regular 和 Bold 字体均已打包。参考图保留 fake user，避免因未挂接到材质而在保存时丢失。材质纹理主要由 Blender 节点生成，远景无需联网请求背景图片。环境贴图许可随交付目录中的 `environment-license.txt` 保留。

以下数值来自最终 `validation.json`：

| 指标 | 最终实测 |
| --- | --- |
| Blender 版本 | 4.5.3 LTS |
| 原生文件大小 | 142,845,774 字节 |
| Mesh 对象数 | 20,136 |
| 共享网格去重后的顶点数 | 265,260 |
| 包含修改器、实例、曲线和字体的求值三角面数 | 5,817,039 |
| 窗后墙数 | 1,050 |
| 分块雨棚玻璃数 | 64 |
| V1 对照相机 | 匹配已保存的 V1 相机 |
| 救护车与裙楼边界 | 车辆真实几何的 XY 外廓位于裙楼外 |
| 四轮距实际道路表面的最大误差 | 约 2.98 × 10⁻⁸ 米，低于 0.02 米阈值 |
| 源文件与成图检查失败项 | 0 |
| 四张图的来源校验 | 源文件哈希、PNG 哈希、尺寸、采样和降噪记录全部通过 |

三角面统计反映高精度离线场景的实际几何量，不代表已达到网页实时渲染预算。

## 复现与验证

在项目根目录使用现有 Blender 4.5.3 执行。构建过程读取 V1 并写入独立 V2 文件；重新构建会替换当前 V2 生成结果。若已在 Blender 中手工修改 V2，请先另存保留。只重渲染时使用 `--render-only`，它直接读取已保存的 V2，不重新执行建模步骤，也不把临时渲染机位写回源文件。

本轮正式成图参数为主图 2560 × 1441、64 samples，入口、立面及对照图各 1600 × 900、48 samples。源文件保留的默认设置是 96 samples，供后续编辑和自行渲染使用；它不代表本次交付图片的实际采样数。最终验证状态仍以 `validation.json` 为准。

本机直接对完整场景执行全分辨率 OIDN 降噪曾发生内存不足，正式交付采用两个独立 Blender 进程：先用 `--raw` 输出 32 位多层 EXR 及参数记录，结束该进程释放场景；再用 `--denoise-only` 在空场景中读取 EXR，通过合成器完成降噪和 PNG 输出，采用 FAST prefilter、HIGH quality 和 HDR 设置。四张正式图已通过该流程完成，色彩管理从原渲染参数恢复；模型几何和成图分辨率未因内存问题降低。建议本机重渲染沿用以下流程。

每幅图的 `*-render-settings.json` 记录源 `.blend` 的 SHA-256、尺寸、采样数及色彩管理参数；降噪完成后补充 PNG 的 SHA-256 和降噪方式。最终验证要求四张图片的来源记录均与当前源文件及当前 PNG 匹配，以防旧图混入本次交付。以下每个 Blender 调用均为独立进程，前一步正常结束后再进入下一步。

```powershell
Set-Location 'E:\projects\digital-twin'
$hospitalBlender = 'E:\projects\digital-twin\output\tools\blender\blender-4.5.3-windows-x64\blender.exe'

# 从 V1 构建并保存 V2，暂不渲染。
& $hospitalBlender --background --threads 8 --python-exit-code 1 --python scripts/refine_hospital_exterior_reference_v2.py -- --skip-render

# 从已保存的 V2 生成低分辨率检查图，文件名为 preview-*.png。
& $hospitalBlender --background --threads 8 --python-exit-code 1 --python scripts/refine_hospital_exterior_reference_v2.py -- --render-only --views hero entrance facade comparison --width 960 --samples 24

# 重新打开原生文件，独立检查结构、资源、对照相机和车辆位置。
& $hospitalBlender --background --threads 8 --python-exit-code 1 --python scripts/verify_hospital_exterior_reference_v2.py -- --source-only

# 主图第一阶段：2560 × 1441，64 samples，保存 EXR 通道和成图参数。
& $hospitalBlender --background --threads 8 --python-exit-code 1 --python scripts/refine_hospital_exterior_reference_v2.py -- --render-only --views hero --width 2560 --samples 64 --raw
if ($LASTEXITCODE -ne 0) { throw '医院主图 EXR 渲染失败' }

# 主图第二阶段：新进程仅加载 EXR，降噪并输出 hero.png。
& $hospitalBlender --background --threads 8 --python-exit-code 1 --python scripts/refine_hospital_exterior_reference_v2.py -- --denoise-only --views hero
if ($LASTEXITCODE -ne 0) { throw '医院主图降噪失败' }

# 其余三图各 1600 × 900、48 samples；每幅图均分开启动渲染和降噪进程。
foreach ($hospitalView in @('entrance', 'facade', 'comparison')) {
    & $hospitalBlender --background --threads 8 --python-exit-code 1 --python scripts/refine_hospital_exterior_reference_v2.py -- --render-only --views $hospitalView --width 1600 --samples 48 --raw
    if ($LASTEXITCODE -ne 0) { throw ('医院细节 EXR 渲染失败：' + $hospitalView) }
    & $hospitalBlender --background --threads 8 --python-exit-code 1 --python scripts/refine_hospital_exterior_reference_v2.py -- --denoise-only --views $hospitalView
    if ($LASTEXITCODE -ne 0) { throw ('医院细节降噪失败：' + $hospitalView) }
}

# 成图完成后，再次重新打开源文件并检查全部交付项。
& $hospitalBlender --background --threads 8 --python-exit-code 1 --python scripts/verify_hospital_exterior_reference_v2.py --
```

构建入口为 [refine_hospital_exterior_reference_v2.py](E:/projects/digital-twin/scripts/refine_hospital_exterior_reference_v2.py)，建筑细化在 [hospital_exterior_architecture_v2.py](E:/projects/digital-twin/scripts/hospital_exterior_architecture_v2.py)，植物、车辆和环境细化在 [hospital_exterior_landscape_v2.py](E:/projects/digital-twin/scripts/hospital_exterior_landscape_v2.py)。它们复用 [hospital_reconstruction_common.py](E:/projects/digital-twin/scripts/hospital_reconstruction_common.py) 和 [hospital_reference_landscape.py](E:/projects/digital-twin/scripts/hospital_reference_landscape.py) 的几何生成函数。从头复建还需要保留的 V1 源文件、参考图和 V1 目录中的环境许可说明；只打开交付 `.blend` 不需要这些生成脚本。

独立检查入口为 [verify_hospital_exterior_reference_v2.py](E:/projects/digital-twin/scripts/verify_hospital_exterior_reference_v2.py)。该脚本重新打开磁盘上的文件，检查必要分组、单位、Cycles 设置、默认和细节机位、有限坐标、有效材质、打包图像与字体，并统计经过修改器求值后的几何。车辆检查使用世界坐标下的真实几何边界及道路 BVH 射线；对照机位从 V1 重新加载后再比较。完整检查还核对四张图片的源文件/PNG 哈希、实际尺寸、最低采样数及降噪记录，结果写入报告的 `renderProvenance`；`--source-only` 不要求成图来源记录。检查过程不保存或修改 `.blend`，只写验证报告；发现失败项时以非零状态退出。

## 验证范围与保真边界

已逐张查看整体、入口、立面和 V1 同机位成图，检查构图边距、玻璃反射、遮挡及构件关系。源文件重开、几何、资源、车辆落地和四张成图来源校验均通过；四个 V2 脚本完成语法检查，来源校验函数的正常与异常输入共 11 个内存夹具检查通过。该结果确认本次交付的一致性，不能用来量化与概念图的视觉相似度。

模型依据单张概念效果图推测体量和构件关系。参考图不可见部分、室内空间、植物、车辆、人物和远景包含设计补充；院名和导视为场景示意。此版本没有真实医院测绘、施工图或 BIM 数据支撑，不能声称百分百还原、实测尺寸准确或工程可施工，也没有通过像素相似度给出百分比。

本轮没有接入项目网页，没有进行 GLB 的三角面、文件体积、贴图、材质或绘制调用预算验收，也没有执行浏览器加载、交互或性能验收。网页使用应另行完成模型简化、必要的材质烘焙、GLB 导出和真实页面检查；当前高精度离线渲染成功不能替代这些步骤。
