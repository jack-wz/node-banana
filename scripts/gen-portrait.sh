#!/bin/bash
# Generate a formal studio portrait via fal openai/gpt-image-2/edit
# Usage: FAL_KEY=... ./scripts/gen-portrait.sh
set -euo pipefail

WORKDIR="$(cd "$(dirname "$0")/.." && pwd)"
IMG1="/var/folders/kx/ls_1qhts06d3k6zzlblzwb4w0000gn/T/codex-clipboard-2f3f7f94-4ac7-4a51-8e7e-aa41314b57c5.jpg"
IMG2="/var/folders/kx/ls_1qhts06d3k6zzlblzwb4w0000gn/T/codex-clipboard-5de7bec4-da90-4cf0-b159-936ad0dc4233.png"
OUT_DIR="$WORKDIR/outputs"
mkdir -p "$OUT_DIR"

: "${FAL_KEY:?FAL_KEY env var required}"

upload() {
  local file="$1" mime="$2"
  local name type_pair upload_url file_url
  name="$(basename "$file")"
  type_pair=$(curl -sS -X POST "https://rest.fal.ai/storage/upload/initiate" \
    -H "Authorization: Key $FAL_KEY" -H "Content-Type: application/json" \
    -d "{\"file_name\":\"$name\",\"content_type\":\"$mime\"}")
  upload_url=$(echo "$type_pair" | /usr/bin/python3 -c "import sys,json;print(json.load(sys.stdin)['upload_url'])")
  file_url=$(echo "$type_pair" | /usr/bin/python3 -c "import sys,json;print(json.load(sys.stdin)['file_url'])")
  curl -sS -X PUT "$upload_url" -H "Content-Type: $mime" --data-binary "@$file" -o /dev/null
  echo "$file_url"
}

echo "Uploading reference images to fal storage..."
URL1=$(upload "$IMG1" "image/jpeg")
URL2=$(upload "$IMG2" "image/png")
echo "Uploaded."

/usr/bin/python3 - "$URL1" "$URL2" > /tmp/nb_payload.json <<'PYEOF'
import json, sys
prompt = """参考两张输入图片：图片一是人物原图（身份来源），图片二是构图、造型与状态参考。

任务：生成一张正式的书本介绍照片 / 职业照。纯人像，不要任何文字。参考图片二的构图、造型、姿态与状态和服装：坐在简洁的椅子上，深色合身西装内搭白色衬衫，双手自然交握放在腿上，身体微微前倾，面向镜头，自信微笑但不油腻。背景为纯摄影棚背景（干净的浅灰白无缝背景），不要任何实景场景。

画幅比例为 2:3 竖版。

这不是普通证件照，不是廉价写真，不是网红自拍，也不是夸张霸总风照片，而是一张兼具高级商业人像、电影人物海报、个人品牌视觉和社交平台传播感的男性魅力形象图。

一、人物来源逻辑
以图片一的人物为核心身份参考，保留其真实身份识别度：脸型轮廓、五官比例、眉眼气质、发型基础、年龄感、肤色倾向和面部特征。在保持本人可识别的基础上进行高级视觉转译：优化面部光影结构；强化眉骨、鼻梁、下颌线和面部轮廓；提升眼神的稳定感和故事感；让发型更干净利落；让皮肤质感更自然清爽；让整体气质更成熟、更自信、更有身份感。不要把他变成另一个人；不要重塑成明星脸；不要大幅改变脸型；不要过度美颜；不要失去真实感。

二、男性魅力转译目标
沉稳、克制、自信、可靠、干净、有力量感、有身份感、有故事感、有镜头表现力。不讨好、不油腻、不浮夸、不刻意耍帅、不廉价、不网红。人物应像高级商业杂志、个人品牌大片中的主角，远看有气场，近看有细节。

三、目标风格
商务精英风（摄影棚版）：深色西装、干净发型、冷静而温和的眼神、成熟可靠、商业大片质感，配合纯摄影棚无缝背景。

四、服装系统
参考图片二：深色（黑/深藏青）合身西装，剪裁利落不过紧；白色衬衫，领口自然；整体干净、有质感、高级。

五、布光与画质
专业摄影棚布光：柔和主光勾勒面部轮廓，辅以轮廓光分离人物与背景；肤质真实细腻；高分辨率、高清画质、杂志级修图但保留真实皮肤纹理；色彩干净低饱和，高级灰调。

输出：一张 2:3 竖版高清职业形象照。"""
payload = {
    "prompt": prompt,
    "image_urls": [sys.argv[1], sys.argv[2]],
    "image_size": "1024x1536",
    "quality": "high",
    "output_format": "png",
    "num_images": 1,
}
print(json.dumps(payload, ensure_ascii=False))
PYEOF

echo "Submitting to fal queue (openai/gpt-image-2/edit, quality=high)..."
REQ=$(curl -sS -X POST "https://queue.fal.run/openai/gpt-image-2/edit" \
  -H "Authorization: Key $FAL_KEY" -H "Content-Type: application/json" \
  --data-binary @/tmp/nb_payload.json)
echo "$REQ" > /tmp/nb_request.json
STATUS_URL=$(echo "$REQ" | /usr/bin/python3 -c "import sys,json;print(json.load(sys.stdin)['status_url'])")
RESP_URL=$(echo "$REQ" | /usr/bin/python3 -c "import sys,json;print(json.load(sys.stdin)['response_url'])")
rm -f /tmp/nb_payload.json

echo "Waiting for result..."
for i in $(seq 1 60); do
  sleep 5
  ST=$(curl -sS "$STATUS_URL" -H "Authorization: Key $FAL_KEY" | /usr/bin/python3 -c "import sys,json;print(json.load(sys.stdin).get('status','UNKNOWN'))")
  echo "  [$i] status=$ST"
  if [ "$ST" = "COMPLETED" ]; then break; fi
  if [ "$ST" != "IN_QUEUE" ] && [ "$ST" != "IN_PROGRESS" ]; then
    echo "Unexpected status: $ST" >&2; exit 1
  fi
done

curl -sS "$RESP_URL" -H "Authorization: Key $FAL_KEY" > /tmp/nb_result.json
IMG_URL=$(/usr/bin/python3 -c "import json;print(json.load(open('/tmp/nb_result.json'))['images'][0]['url'])")
OUT_FILE="$OUT_DIR/portrait-gpt-image-2-$(date +%Y%m%d-%H%M%S).png"
curl -sS "$IMG_URL" -o "$OUT_FILE"
rm -f /tmp/nb_request.json /tmp/nb_result.json
echo "DONE: $OUT_FILE"
