UPDATE posts
SET
  content_json = json_object(
    'markdown',
    '# 이미지 레이아웃 검증

대표 이미지가 본문 시작부에서 잘리지 않고 자연스럽게 읽히는지 확인합니다.

## 본문 가로 이미지

![본문 가로 이미지](https://placehold.co/1600x900/f3efe7/2c241d.png?text=Wide+Body+Image)

가로 이미지 아래 문단입니다. 이미지가 잘리지 않고 전체가 보여야 합니다.

## 본문 세로 이미지

<figure>
  <img src="https://placehold.co/900x1600/f3efe7/2c241d.png?text=Tall+Body+Image" alt="본문 세로 이미지" />
  <figcaption>세로 이미지도 잘리지 않고 전체가 보여야 합니다.</figcaption>
</figure>

세로 이미지 아래 문단입니다. 너무 커 보이면 본문 최대 폭을 더 줄여야 합니다.'
  ),
  updated_at = '2026-03-28T14:05:00+09:00'
WHERE slug = 'image-layout-test';
