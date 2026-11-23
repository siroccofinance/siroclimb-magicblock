#!/bin/bash
# Encode web deliverables from the PNG masters. Usage: ./encode.sh  (run from coin-video/)
set -e
OUT=../hero
V="$OUT/video"; P="$OUT/poster"
mkdir -p "$V" "$P"
CM="out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int:sws_dither=ed"
TAG="-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"
enc() { # src w h name crf
  ffmpeg -v error -y -framerate 30 -i "$1/f_%04d.png" -vf "scale=$2:$3:$CM,format=yuv420p" \
    -c:v libx264 -profile:v high -preset veryslow -crf $5 -g 120 -pix_fmt yuv420p $TAG -movflags +faststart -an "$V/$4.mp4"
  ffmpeg -v error -y -framerate 30 -i "$1/f_%04d.png" -vf "scale=$2:$3:$CM,format=yuv420p" \
    -c:v libvpx-vp9 -crf $(( $5 + 8 )) -b:v 0 -row-mt 1 -deadline good -cpu-used 1 -g 120 -pix_fmt yuv420p $TAG -an "$V/$4.webm"
}
enc master-hero-4k 3840 2160 sirocco-hero-3840x2160 16
enc master-hero-4k 2560 1440 sirocco-hero-2560x1440 18
enc master-hero-4k 1920 1080 sirocco-hero-1920x1080 19
enc master-mobile 1080 1350 sirocco-hero-mobile-1080x1350 19
for s in "master-hero-4k 1920 1080 sirocco-hero-poster-1920x1080" "master-hero-4k 3840 2160 sirocco-hero-poster-3840x2160" "master-mobile 1080 1350 sirocco-hero-mobile-poster-1080x1350"; do
  set -- $s
  ffmpeg -v error -y -i "$1/f_0000.png" -vf "scale=$2:$3:flags=lanczos" -q:v 2 "$P/$4.jpg"
  python3 -c "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').resize((int(sys.argv[2]), int(sys.argv[3])), Image.LANCZOS).save(sys.argv[4], quality=90, method=6)" "$1/f_0000.png" $2 $3 "$P/$4.webp"
done
