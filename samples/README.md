# Test Media Samples

This directory contains test media assets for development, test fixtures, and automated verification of SceneStitch.

All media in this directory are synthetic fixtures generated for the SceneStitch project and are released under the [Creative Commons Zero (CC0 1.0 Universal) Public Domain Dedication](https://creativecommons.org/publicdomain/zero/1.0/).

## Asset Manifest

| File | Type | Format / Codec | Dimensions / Channels | Duration | License | Purpose |
|---|---|---|---|---|---|---|
| `clip01.mp4` | Video | MP4 (H.264, yuv420p) | 1080×1920 (9:16) @ 30 fps | 3.0 s | CC0 1.0 Universal | Short hook scene test clip |
| `clip02.mp4` | Video | MP4 (H.264, yuv420p) | 1080×1920 (9:16) @ 30 fps | 4.0 s | CC0 1.0 Universal | Process / action test clip |
| `clip03.mp4` | Video | MP4 (H.264, yuv420p) | 1080×1920 (9:16) @ 30 fps | 5.0 s | CC0 1.0 Universal | Hero reveal test clip |
| `image01.png` | Image | PNG | 1080×1920 (9:16) | N/A | CC0 1.0 Universal | Still image test (Ken Burns input / left split) |
| `image02.jpg` | Image | JPEG | 1080×1920 (9:16) | N/A | CC0 1.0 Universal | Still image test (Ken Burns input / right split) |
| `voiceover01.mp3` | Audio | MP3 (192 kbps, 44.1 kHz) | Mono | 2.5 s | CC0 1.0 Universal | Voiceover narration simulation |
| `music01.mp3` | Audio | MP3 (192 kbps, 44.1 kHz) | Mono | 30.0 s | CC0 1.0 Universal | Background music track for ducking tests |

## Generation Commands

These assets were deterministically produced using FFmpeg 6.1+:
```bash
# Clip 01
ffmpeg -y -f lavfi -i "testsrc=size=1080x1920:rate=30" \
  -vf "drawtext=fontfile=/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf:text='Scene 01 - Hook (3.0s)':fontcolor=white:fontsize=72:box=1:boxcolor=black@0.6:boxborderw=20:x=(w-text_w)/2:y=(h-text_h)/2" \
  -t 3.0 -c:v libx264 -pix_fmt yuv420p samples/clip01.mp4

# Clip 02
ffmpeg -y -f lavfi -i "smptebars=size=1080x1920:rate=30" \
  -vf "drawtext=fontfile=/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf:text='Scene 02 - Process (4.0s)':fontcolor=white:fontsize=72:box=1:boxcolor=black@0.6:boxborderw=20:x=(w-text_w)/2:y=(h-text_h)/2" \
  -t 4.0 -c:v libx264 -pix_fmt yuv420p samples/clip02.mp4

# Clip 03
ffmpeg -y -f lavfi -i "testsrc2=size=1080x1920:rate=30" \
  -vf "drawtext=fontfile=/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf:text='Scene 03 - Reveal (5.0s)':fontcolor=white:fontsize=72:box=1:boxcolor=black@0.6:boxborderw=20:x=(w-text_w)/2:y=(h-text_h)/2" \
  -t 5.0 -c:v libx264 -pix_fmt yuv420p samples/clip03.mp4

# Image 01
ffmpeg -y -f lavfi -i "color=c=0x1E1E2E:s=1080x1920:d=1" \
  -vf "drawtext=fontfile=/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf:text='SceneStitch Sample Image 1':fontcolor=0xCDD6F4:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2-50,drawtext=fontfile=/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf:text='Before Grooming (1080x1920)':fontcolor=0xA6ADC8:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2+50" \
  -frames:v 1 samples/image01.png

# Image 02
ffmpeg -y -f lavfi -i "color=c=0x181825:s=1080x1920:d=1" \
  -vf "drawtext=fontfile=/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf:text='SceneStitch Sample Image 2':fontcolor=0xA6E3A1:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2-50,drawtext=fontfile=/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf:text='After Glamour Reveal (1080x1920)':fontcolor=0x94E2D5:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2+50" \
  -frames:v 1 samples/image02.jpg

# Voiceover 01
ffmpeg -y -f lavfi -i "sine=frequency=220:duration=2.5,afade=t=in:ss=0:d=0.1,afade=t=out:st=2.3:d=0.2" \
  -c:a libmp3lame -b:a 192k samples/voiceover01.mp3

# Music 01
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=30.0[a1];sine=frequency=554.37:duration=30.0[a2];sine=frequency=659.25:duration=30.0[a3];[a1][a2][a3]amix=inputs=3:dropout_transition=2,volume=0.3,afade=t=in:ss=0:d=1.0,afade=t=out:st=28.5:d=1.5" \
  -c:a libmp3lame -b:a 192k samples/music01.mp3
```
