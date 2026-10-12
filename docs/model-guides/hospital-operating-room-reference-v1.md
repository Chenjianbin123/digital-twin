# 医院与手术室 Blender 参考还原版

2026-10-05。以 `output/imagegen/hospital-concepts-20261005/` 下的两张 AI 效果图为参考，使用 Blender 4.5.3 LTS 建立实际三维几何并用 Cycles 渲染。

这是可编辑的首版还原模型，**没有达到百分百一致**。单张参考图不能确定遮挡部分、背面和真实尺寸；本次采用推定尺寸和设备结构，不是医院实测模型、施工图或设备厂商模型。

## 交付文件

以下路径均相对项目根目录 `E:\projects\digital-twin`。

| 内容 | 医院整体 | 手术室 |
| --- | --- | --- |
| 可编辑源 | `output/hospital-exterior-reference-v1/hospital-exterior-reference-v1.blend` | `output/operating-room-reference-v1/operating-room-reference-v1.blend` |
| Cycles 主视图 | `output/hospital-exterior-reference-v1/hero.png` | `output/operating-room-reference-v1/hero.png` |
| Cycles 局部视图 | `output/hospital-exterior-reference-v1/detail.png` | `output/operating-room-reference-v1/detail.png` |
| 实际文件验证 | `output/hospital-exterior-reference-v1/validation.json` | `output/operating-room-reference-v1/validation.json` |

主视图为 2560 × 1441，局部视图为 1600 × 900。这里的 PNG 是 Blender 实际渲染，不是把原始 AI 图当作模型截图。参考图保留在源文件的 `REFERENCE - concept image, not a render` 图像数据块中；通过打包和 fake user 保证重开后仍存在。

`.blend` 内保留命名部件、倒角修改器、材质节点、灯光以及 `Reference_Hero_Camera`、`Detail_Camera`。主视图相机是默认相机。字体已打包；医院环境照明使用 Blender 自带 `city.exr`，已打包，原许可说明复制到医院输出目录的 `environment-license.txt`。

`output/` 被 Git 忽略。交接时请复制对应整个输出目录，尤其是 `.blend`；只保存 Git 中的脚本不会保留手动调整后的源文件。

## 模型内容

医院根对象为 `HospitalExterior_Reference_V1`，按楼体、门诊裙楼、硬质景观、绿化和救护车分组。包括分层窗框、幕墙横梃、局部百叶、立体标识、屋顶设备、玻璃雨棚及支架、入口门、台阶、道路、长椅、路灯和叶片几何。树木共享叶片网格以控制源文件体积；各树仍可单独调整。

手术室根对象为 `OperatingRoom_Reference_V1`，包括房间外壳、集成墙面设备、手术床、双头手术灯、麻醉工作站、吊塔、双显示器支架和移动设备。手术床保留分段软垫、导轨、锁紧部件、升降柱和脚踏；灯头保留独立透镜、反射器及支架；储物柜保留玻璃、框架、搁板和瓶体。

单位是米，Blender Z 轴向上。设备均是视觉模型，没有承诺实际机械行程或医疗设备功能；屏幕中的波形和图形是模型内的演示几何，不含患者信息或实时数据。

## 与参考图仍有的差异

- 医院：楼体比例、立面重复节奏、雨棚、入口景观与植物形态均有差异。远景为简化城市体块，未还原参考图中的山体、城市细节和行人。材料反射、日照和天空也未做到逐像素匹配。
- 手术室：手术床轮廓和基座、灯具支架、麻醉机面板、吊塔位置与部分设备比例仍有差异。构图、表面微纹理及反射质感尚未达到参考图的写实程度。
- 没有测量像素相似度，不能提供有依据的“还原百分比”。原生文件通过验证也不等于完成视觉百分百验收。

## 验证结果与边界

重新打开实际 `.blend`，检查了必要分组、米制单位、Cycles、主相机、材质分配、有限顶点/矩阵、打包图像和字体，以及主渲染尺寸；两套文件的 `validation.json` 均无失败项。

| 指标 | 医院 | 手术室 |
| --- | ---: | ---: |
| Mesh 对象 | 8,311 | 1,573 |
| 评估后三角面，包含实例、修改器及文字曲线 | 4,191,116 | 432,968 |

几何数量是实际检查结果，不代表视觉相似度。六个新增 Python 文件通过语法编译检查。主视图和局部图进行了人工视觉检查。未修改生产场景配置、已有模型、业务代码或用户已有改动，未创建 Git 提交。

本轮未导出或接入生产 GLB，未验证网页帧率、交互或医院设备接口。这些文件用于 Blender 中的编辑和渲染。

## 重建

生成脚本只写本次两个输出目录。重建会覆盖同名的本次产物；如果已在 Blender 中手工修改，请先另存副本。

```powershell
$blenderReference = 'E:\projects\digital-twin\output\tools\blender\blender-4.5.3-windows-x64\blender.exe'
& $blenderReference --background --threads 6 --python-exit-code 1 --python scripts/build_hospital_exterior_reference_v1.py -- --width 2560 --samples 64
& $blenderReference --background --threads 6 --python-exit-code 1 --python scripts/build_operating_room_reference_v1.py -- --width 2560 --samples 64
& $blenderReference --background --threads 4 --python-exit-code 1 --python scripts/verify_hospital_reference_models.py -- --asset hospital --render-detail
& $blenderReference --background --threads 4 --python-exit-code 1 --python scripts/verify_hospital_reference_models.py -- --asset operating-room --render-detail
```

共享几何和材质辅助函数位于 `scripts/hospital_reconstruction_common.py`；医院景观位于 `scripts/hospital_reference_landscape.py`；手术设备位于 `scripts/operating_room_reference_equipment.py`。验证脚本的 `--pack-reference` 是显式补打包选项，正常使用更新后的生成脚本重建时无需额外添加。
