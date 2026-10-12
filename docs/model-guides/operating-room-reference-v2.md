# 手术室模型 V2 精修版

本轮在保留 V1 原文件的基础上精修手术室。交付的是 Blender 原生几何场景和 Cycles 实际渲染，效果图没有使用 AI 重绘或后期绘制来替代模型细节。

## 文件

工作区目录：`output/operating-room-reference-v2/`。

- `operating-room-reference-v2.blend`：可编辑源文件，默认打开主视角，另存有三个设备近景机位和 V1 对照机位。
- `hero.png`：2560 × 1441 主效果图。
- `bed.png`、`lights.png`、`anesthesia.png`：1600 × 900 手术床、双无影灯和麻醉机近景。
- `comparison.png`：沿用 V1 相机位置、方向和焦距的精修版图，用于和 `output/operating-room-reference-v1/hero.png` 对照。
- `validation.json`：重新打开实际交付源文件后的结构、几何、资源和渲染尺寸验证报告。

## 本轮精修内容

1. **手术床**：五块带弧面的分段软垫与边缘压缝；调整床面比例；补充侧轨快拆夹具、滚花锁紧旋钮、关节轴承和倾斜执行器；调整升降柱与波纹防护罩关系，重做低位钢制底座。
2. **双无影灯**：两组灯头各 66 个独立反光杯、凸透镜和发光体；重做灯壳曲面、密封边、中心握柄；支架连接到灯头实际姿态的轴承位置。
3. **麻醉设备**：重新建模连续弯曲、均匀节距的波纹呼吸管；补充吸收罐、透明风箱、流量刻度、服务面板、推手和线缆；监护屏使用明确标记 DEMO 的演示内容。
4. **环境细节**：器械车增加连续布面褶皱和带指环的器械；储物柜改用不同高度的瓶体和包装盒；修正门窗前的金属遮挡，保留浅层背景的示意观察窗。
5. **材质与光线**：区分哑光软垫、拉丝钢、光学反光杯和透明玻璃；增加物理尺度的细微颗粒和粗糙度变化，重新平衡顶部照明与侧面反射。
6. **落地与对照**：修正脚轮离地间隙；保留 V1 对照相机，主图机位另作小幅调整。

## 验证方法

已重开核验的源文件包含 1,902 个网格对象，应用修改器后共 700,464 个三角面；两盏灯共 132 个独立反光杯、五块弧面软垫。52 个轮胎均通过 2 mm 落地误差检查，V1 对照相机与原文件一致。源文件大小为 43,490,636 字节。

先用低采样预览检查整间构图和三个局部，再输出最终分辨率。独立 Blender 进程重新读取 `.blend`，检查必需组件、材质、有限坐标、相机、打包图片和字体，统计实际经过修改器的三角面，并检查脚轮最低点与地面相差不超过 2 mm。

`validation.json` 中的通过结果只代表实际执行的原生模型与文件检查。模型仍是根据单张概念图人工推定尺寸和结构的视觉重建，未达到逐像素一致，也没有实测医院图纸或设备工程资料。门窗后方仍采用浅层示意背景；设备不包含可用于临床或机械设计的功能仿真。医院外观本轮未修改；尚未导出生产 GLB 或接入网页。

## 重建与重渲染

在项目根目录执行。重建需要保留的 V1 源文件和原参考图；直接打开交付 `.blend` 不需要这些外部文件，图像和字体已打包。

```powershell
$blenderExe = 'E:/projects/digital-twin/output/tools/blender/blender-4.5.3-windows-x64/blender.exe'
& $blenderExe --background --threads 8 --python-exit-code 1 --python scripts/refine_operating_room_reference_v2.py -- --skip-render
& $blenderExe --background --threads 8 --python-exit-code 1 --python scripts/refine_operating_room_reference_v2.py -- --render-only --width 2560 --samples 64 --views hero
& $blenderExe --background --threads 8 --python-exit-code 1 --python scripts/refine_operating_room_reference_v2.py -- --render-only --width 1600 --samples 48 --views bed lights anesthesia comparison
& $blenderExe --background --threads 4 --python-exit-code 1 --python scripts/verify_operating_room_reference_v2.py
```

建模脚本：`scripts/refine_operating_room_reference_v2.py`、`scripts/operating_room_refinement_v2.py`；复用 `scripts/hospital_reconstruction_common.py`。没有修改 V1 脚本、业务代码或生产场景配置。
