"""Build a small, original medical-themed loop using Blender's video sequencer.

Run with Blender 4.5: blender --background --factory-startup --python scripts/build_station_video_loop.py
No hospital branding, third-party footage, audio or runtime rendering dependency.
"""
from pathlib import Path
import math
import bpy

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/videos/nurse-station-care-loop.mp4"
# Slow signage animation does not need movie frame rates; keep texture uploads modest.
WIDTH, HEIGHT, FPS, FRAMES = 640, 360, 12, 72


def build():
    scene = bpy.context.scene
    scene.sequence_editor_clear()
    editor = scene.sequence_editor_create()
    scene.frame_start, scene.frame_end = 1, FRAMES
    scene.render.resolution_x, scene.render.resolution_y = WIDTH, HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.fps = FPS
    scene.render.use_sequencer = True
    scene.render.image_settings.file_format = 'FFMPEG'
    scene.render.ffmpeg.format = 'MPEG4'
    scene.render.ffmpeg.codec = 'H264'
    scene.render.ffmpeg.constant_rate_factor = 'HIGH'
    scene.render.ffmpeg.ffmpeg_preset = 'GOOD'
    scene.render.ffmpeg.gopsize = FPS
    scene.render.ffmpeg.audio_codec = 'NONE'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.render.filepath = str(OUTPUT)
    font_path = Path('C:/Windows/Fonts/msyhbd.ttc')
    if not font_path.exists():
        raise FileNotFoundError('Chinese font required: ' + str(font_path))
    font = bpy.data.fonts.load(str(font_path))
    channel = 0

    def rect(name, x, y, width, height, color, alpha=1):
        nonlocal channel
        channel += 1
        strip = editor.strips.new_effect(name=name, type='COLOR', channel=channel, frame_start=1, frame_end=FRAMES + 1)
        strip.color = color
        strip.blend_type = 'ALPHA_OVER'
        strip.blend_alpha = alpha
        strip.transform.scale_x, strip.transform.scale_y = width / WIDTH, height / HEIGHT
        strip.transform.offset_x, strip.transform.offset_y = x - WIDTH / 2, y - HEIGHT / 2
        return strip

    def label(name, text, x, y, size, color):
        nonlocal channel
        channel += 1
        strip = editor.strips.new_effect(name=name, type='TEXT', channel=channel, frame_start=1, frame_end=FRAMES + 1)
        strip.text, strip.font, strip.font_size, strip.color = text, font, size, (*color, 1)
        strip.location = x / WIDTH, y / HEIGHT
        strip.alignment_x, strip.anchor_x, strip.anchor_y = 'LEFT', 'LEFT', 'CENTER'
        strip.blend_type = 'ALPHA_OVER'
        return strip

    navy, cyan, white = (.016, .060, .095), (.12, .88, .83), (.94, .99, 1)
    rect('Navy background', 320, 180, 640, 360, navy)
    rect('Top accent', 320, 357, 640, 6, cyan)
    rect('Bottom ribbon', 320, 44, 640, 88, (.022, .16, .22))
    label('Header', '智慧病房  /  护士站', 36, 311, 20, (.56, .81, .87))
    messages = [
        (label('Care headline', '用心护理', 32, 214, 64, white),
         label('Care subheading', '关爱就在您身边', 36, 149, 27, (.57, .91, .94))),
        (label('Support headline', '温暖守护', 32, 214, 64, white),
         label('Support subheading', '专业陪伴每一天', 36, 149, 27, (.57, .91, .94))),
    ]
    label('Footer', '关爱  ·  专业  ·  陪伴', 36, 47, 22, white)
    # Broad motion survives downscaling on the wall TV; keep the background steady, without flashes.
    halo = rect('Pulse halo', 506, 209, 184, 184, cyan, .12)
    cross = [(rect('Cross horizontal', 506, 209, 148, 48, cyan), 148, 48),
             (rect('Cross vertical', 506, 209, 48, 148, cyan), 48, 148)]
    satellites = [rect('Orbit ' + str(i), 506, 209, 17, 17, white) for i in range(2)]
    rect('Ribbon track', 320, 93, 576, 16, (.12, .33, .38))
    runner = rect('Moving ribbon', 104, 93, 144, 16, cyan)
    for frame in range(1, FRAMES + 1):
        phase = 2 * math.pi * (frame - 1) / FRAMES
        pulse = .5 - .5 * math.cos(phase * 2)
        local_frame = (frame - 1) % (FRAMES // 2)
        message_index = (frame - 1) // (FRAMES // 2)
        # A short fade/slide between three-second holds makes the content change visible, not flickery.
        opacity = min(1, local_frame / 3, (FRAMES // 2 - local_frame) / 3)
        for index, strips in enumerate(messages):
            for strip in strips:
                strip.blend_alpha = opacity if index == message_index else 0
                strip.keyframe_insert(data_path='blend_alpha', frame=frame)
                strip.transform.offset_y = 16 * (1 - opacity)
                strip.transform.keyframe_insert(data_path='offset_y', frame=frame)
        halo.blend_alpha = .10 + .22 * pulse
        halo.keyframe_insert(data_path='blend_alpha', frame=frame)
        for strip, width, height in cross:
            scale = .68 + .40 * pulse
            strip.transform.scale_x, strip.transform.scale_y = width * scale / WIDTH, height * scale / HEIGHT
            strip.transform.keyframe_insert(data_path='scale_x', frame=frame)
            strip.transform.keyframe_insert(data_path='scale_y', frame=frame)
        for i, satellite in enumerate(satellites):
            angle = phase + i * math.pi
            satellite.transform.offset_x = 506 - WIDTH / 2 + 102 * math.cos(angle)
            satellite.transform.offset_y = 209 - HEIGHT / 2 + 102 * math.sin(angle)
            satellite.transform.keyframe_insert(data_path='offset_x', frame=frame)
            satellite.transform.keyframe_insert(data_path='offset_y', frame=frame)
        runner.transform.offset_x = -216 * math.cos(phase)
        runner.transform.keyframe_insert(data_path='offset_x', frame=frame)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(animation=True)
    print(f'VIDEO_LOOP_OUTPUT {OUTPUT} {OUTPUT.stat().st_size} bytes; {WIDTH}x{HEIGHT}; {FPS}fps; {FRAMES/FPS:g}s')


if __name__ == '__main__':
    build()
