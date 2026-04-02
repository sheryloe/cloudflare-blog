import React from "react";
import ReactDOM from "react-dom/client";

import { MarkdownContent } from "./components/markdown-content";
import "./styles.css";

const sampleMarkdown = `
# 본문 이미지 검증

대표 이미지 아래에서 본문 이미지가 어떻게 보이는지 확인합니다.

## 가로 이미지

![가로 본문 이미지](https://placehold.co/1600x900/f3efe7/2c241d.png?text=Wide+Body+Image)

가로 이미지는 전체가 보여야 하고, 너무 넓으면 본문 폭 안에서만 커져야 합니다.

## 세로 이미지

<figure>
  <img src="https://placehold.co/900x1600/f3efe7/2c241d.png?text=Tall+Body+Image" alt="세로 본문 이미지" />
  <figcaption>세로 이미지도 잘리지 않고 전체가 보여야 합니다.</figcaption>
</figure>

세로 이미지는 원본 비율을 유지한 채 중앙 정렬되어야 합니다.
`;

function VerifyImageLayoutPage() {
  return (
    <div className="editorial-shell">
      <div className="editorial-page">
        <section className="detail-hero">
          <div className="detail-hero__copy">
            <p className="section-header__eyebrow">Image Layout Verify</p>
            <h1 className="detail-hero__title">대표 이미지와 본문 이미지 비율 검증</h1>
            <p className="detail-hero__summary">
              대표 이미지는 잘리지 않고 전체 노출, 본문 이미지는 원본 비율 유지가 목표입니다.
            </p>
          </div>
        </section>

        <article className="detail-article">
          <div className="detail-media">
            <img
              className="cover-image"
              src="https://placehold.co/1800x1125/e9e1d6/2c241d.png?text=Cover+Image+Should+Not+Crop"
              alt="대표 이미지 검증용"
            />
          </div>

          <MarkdownContent content={sampleMarkdown} />
        </article>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <VerifyImageLayoutPage />
  </React.StrictMode>,
);
