# Android 모바일 키보드 버그 Troubleshooting

> **프로젝트**: Life Dashboard (Obsidian Plugin)
> **환경**: Android WebView (Obsidian Mobile App)
> **해결일**: 2026-02-22

---

## 1. 증상

Android 모바일 환경에서 데이터 입력을 위해 키보드가 올라오는 모든 경우 두 가지 버그가 발생:

### 버그 A — Goal 입력 (상단 고정 헤더)
키보드가 올라오면 plot + table 영역이 키보드 높이만큼 밀려 올라가면서 고정된 상단 헤더(목표 패널)를 가려버린다.

### 버그 B — Table 입력 (할 일 / 평가 셀)
키보드가 올라오자마자 화면이 한 번 깜박이고 키보드가 즉시 닫힌다. 입력 자체가 불가능한 상태.

---

## 2. 환경 이해: Android WebView 키보드 모드

Android WebView는 소프트 키보드 등장 시 두 가지 모드 중 하나로 동작한다.

| 모드 | 설명 | `window.innerHeight` | `vv.height` | `vv.offsetTop` |
|------|------|---------------------|-------------|----------------|
| `adjustResize` | WebView 자체가 리사이즈 | 감소 | 감소 | 0 |
| `adjustPan` | WebView 전체가 위로 이동(Pan) | 불변 | 감소 | 0 (window-pan) |

Obsidian Android는 **`adjustPan`** 모드를 사용한다.
`adjustPan`에서는 `window.innerHeight`가 변하지 않고 `vv.height`만 감소하며, `vv.offsetTop = 0`이다.

---

## 3. 버그 원인 분석

### 버그 A 원인: `scroll-to-focus` 동작

input에 focus가 발생하면 브라우저(Android WebView)는 focused element가 화면에 보이도록 **부모 스크롤 컨테이너를 자동으로 스크롤**한다(scroll-to-focus 동작).

Obsidian의 뷰 구조:
```
.view-content (Obsidian 스크롤 컨테이너)
  └─ .ld-container
       └─ .ld-app (position: relative, 일반 문서 흐름)
            ├─ .ld-header (목표 패널, 고정 영역)
            └─ .ld-body  (table + chart, 스크롤 영역)
```

`.ld-app`이 일반 문서 흐름(normal flow)에 있으므로, `.view-content`가 스크롤되면 `.ld-app` 전체가 위로 이동한다. 결과적으로 `.ld-header`가 화면 밖으로 밀려나고, `.ld-body`가 헤더를 덮어씌우는 것처럼 보인다.

**시도한 접근 (실패):**
1. `vv.offsetTop > 0 ? vv.offsetTop : window.innerHeight - vv.height` 공식으로 `.ld-app`에 `translateY` 적용
   → `translateY`는 부모 컨테이너의 `scrollTop` 변화를 보정하지 못한다.
2. `.view-content { overflow: hidden !important }` 로 scroll 차단
   → 부분 효과. 단, 버그 B를 악화시키는 부작용 발생.
3. `focusin` 이벤트에서 부모 컨테이너의 `scrollTop = 0` 강제 리셋
   → 타이밍 문제로 완전히 차단되지 않음.

### 버그 B 원인: Virtualizer Row Unmount

키보드 등장 → `vv.resize` 이벤트 → `el.style.height = vv.height` 코드 실행 → `.ld-app` 높이 축소 → flex 레이아웃으로 `.ld-body`도 축소 → `@tanstack/react-virtual`의 ResizeObserver가 컨테이너 높이 변화 감지 → visible row 재계산 → **focused row가 visible range 밖이 되어 DOM에서 unmount** → 포커스 잃음 → 키보드 닫힘.

이것이 화면이 "한 번 깜박이는" 현상의 원인이다.

**시도한 접근 (부분 성공):**
- `transform: translateY(N)` → `top: N` 으로 row 위치 변경
  → CSS transform context에 의한 포커스 오작동은 해결됐으나, height 변경으로 인한 row unmount는 여전히 발생.

---

## 4. 최종 해결책

두 버그의 근본 원인을 하나의 변경으로 동시에 해결:

### `.ld-app`을 `position: fixed`로 변경

```css
/* styles.css */
body.is-mobile .ld-app {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
}
```

**버그 A 해결 원리:**
`position: fixed` 요소는 문서 흐름에서 완전히 분리되어 **레이아웃 뷰포트(layout viewport)에 고정**된다. `.view-content`가 `scroll-to-focus`로 아무리 스크롤되어도 fixed 요소의 화면 상 위치는 변하지 않는다. `.ld-header`는 항상 화면 상단에 고정된다.

**버그 B 해결 원리:**
`el.style.height = vv.height` 코드를 제거했다. Fixed 요소는 뷰포트 크기로 자연스럽게 결정되므로 JS로 height를 변경할 필요가 없다. height 변경이 없으면 `.ld-body` 크기가 변하지 않고, virtualizer는 재계산하지 않으며, focused row는 DOM에 유지된다.

### `translateY`만으로 pan 보정

```tsx
// DashboardApp.tsx
const update = () => {
  rafId = requestAnimationFrame(() => {
    const el = appRef.current;
    if (!el) return;

    // height 변경 없음 → virtualizer 재렌더 없음
    // translateY만으로 Android adjustPan 보정
    const offset =
      vv.offsetTop > 0
        ? vv.offsetTop                    // iOS / Android doc-scroll pan
        : window.innerHeight - vv.height; // Android window-pan

    el.style.transform = offset > 0 ? `translateY(${offset}px)` : "";
  });
};
```

키보드가 올라와 `vv.height`가 줄면:
- `offset = window.innerHeight - vv.height` = 키보드 높이
- `translateY(키보드높이)` → `.ld-app`이 키보드 높이만큼 아래로 이동
- Android pan이 WebView를 키보드 높이만큼 위로 이동시켰으므로 상쇄됨
- 결과: 화면 상단에 `.ld-header`가 보임, `.ld-body` 하단은 키보드 뒤에 가려짐 (정상)

### 추가 CSS 수정

```css
/* 모바일에서 .ld-body flex 레이아웃 정상화 */
body.is-mobile .ld-body {
  min-height: 0;      /* 이전: 200px → virtualizer overflow 유발 */
  flex-shrink: 1;     /* 이전: 0 → 공간 부족 시 헤더를 밀어냄 */
}
```

---

## 5. 변경 파일 요약

| 파일 | 변경 내용 |
|------|-----------|
| `styles.css` | `body.is-mobile .ld-app { position: fixed; top:0; left:0; right:0 }` 추가 |
| `styles.css` | `body.is-mobile .ld-body { min-height: 0; flex-shrink: 1 }` 수정 |
| `src/ui/react/DashboardApp.tsx` | `el.style.height = vv.height` 제거, translateY만 유지 |
| `src/ui/react/DashboardApp.tsx` | `lockParentScroll` + `focusin` 리스너 제거 (position:fixed로 불필요) |

---

## 6. 핵심 교훈

1. **`position: fixed`는 scroll-to-focus의 가장 강력한 방어막이다.**
   CSS `overflow: hidden`이나 JS `scrollTop = 0` 리셋보다 훨씬 근본적인 해결책이다.

2. **Virtualizer + 모바일 키보드는 height 변경에 매우 민감하다.**
   `@tanstack/react-virtual` 같은 virtualizer는 컨테이너 크기 변화를 즉시 감지하여 DOM을 재구성한다. 키보드 애니메이션 도중에 컨테이너 크기를 변경하면 focused element가 unmount될 수 있다.

3. **두 버그가 하나의 원인(height 변경)에서 파생될 수 있다.**
   버그 A(헤더 밀림)는 scroll-to-focus, 버그 B(키보드 닫힘)는 virtualizer unmount로 원인이 달라 보이지만, 결국 `.ld-app`을 일반 문서 흐름에 두었던 설계 선택이 두 버그 모두의 배경이었다.

4. **Android `adjustPan` 모드에서 `translateY` 보정은 `position: fixed`와 조합할 때 정확히 동작한다.**
   normal flow 요소에 `translateY`를 적용하면 부모 컨테이너 스크롤과 상호작용이 복잡해진다. Fixed 요소는 레이아웃 뷰포트 기준이므로 pan 보정이 단순하고 예측 가능하다.
