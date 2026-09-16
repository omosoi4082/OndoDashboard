import * as THREE from "three";
import { BARNS } from "./config.js";
import { createOverviewScene } from "./overviewScene.js";
import { createDetailScene } from "./detailScene.js";
import { getDom, frameToMinutes } from "./ui.js";

const dom = getDom();

let selectedBarn = null;
let playing = false;
let playTimer = null;

function currentTMin() {
  return frameToMinutes(Number(dom.timeSlider.value));
}

const overview = createOverviewScene(dom.mainCanvas, { onSelectBarn: selectBarn });
const detail = createDetailScene(dom.detailCanvas, dom.hoverTooltip);

function resizeDetailRenderer() {
  detail.resize(dom.detailCanvasWrap);
}

function openMainViewForPanel() {
  // #overview가 패널 폭(420px)만큼 줄어드는 CSS 트랜지션이 끝난 뒤 다시 프레이밍해야
  // 방 3개(A/B/C)가 패널에 가려지지 않고 항상 화면 안에 들어온다.
  dom.overview.classList.add("panel-open");
  overview.resize();
  overview.refit();
  setTimeout(() => {
    overview.resize();
    overview.refit();
  }, 360);
}

function closeMainViewForPanel() {
  dom.overview.classList.remove("panel-open");
  overview.resize();
  overview.refit();
  setTimeout(() => {
    overview.resize();
    overview.refit();
  }, 360);
}

function selectBarn(id) {
  const isFirstOpen = !dom.panel.classList.contains("open");
  selectedBarn = BARNS.find((b) => b.id === id);
  detail.setSelectedBarn(selectedBarn);
  dom.barnTitleEl.textContent = selectedBarn.name;
  dom.infoAch.textContent = `${selectedBarn.ach} 회/h`;
  dom.infoHum.textContent = `${selectedBarn.humidity}%`;
  dom.panel.classList.add("open");
  if (isFirstOpen) openMainViewForPanel();
  requestAnimationFrame(resizeDetailRenderer); // 패널이 실제로 보인 뒤 크기 계산
}

function closePanel() {
  dom.panel.classList.remove("open");
  selectedBarn = null;
  detail.setSelectedBarn(null);
  closeMainViewForPanel();
}
dom.closeBtn.addEventListener("click", closePanel);

dom.timeSlider.addEventListener("input", () => {
  dom.timeLabel.textContent = `${currentTMin()}분`;
});
dom.thresholdSlider.addEventListener("input", () => {
  dom.thresholdVal.textContent = Number(dom.thresholdSlider.value).toFixed(2);
});
dom.playBtn.addEventListener("click", () => {
  playing = !playing;
  dom.playBtn.textContent = playing ? "⏸" : "▶";
  if (playing) {
    playTimer = setInterval(() => {
      let v = Number(dom.timeSlider.value) + 1;
      if (v > 30) v = 0;
      dom.timeSlider.value = v;
      dom.timeLabel.textContent = `${currentTMin()}분`;
    }, 350);
  } else {
    clearInterval(playTimer);
  }
});

function resizeMain() {
  overview.resize();
}
window.addEventListener("resize", () => {
  resizeMain();
  if (dom.panel.classList.contains("open")) resizeDetailRenderer();
});
resizeMain();

const clock = new THREE.Clock();
let lastElapsed = 0;

(function animate() {
  requestAnimationFrame(animate);
  overview.render();

  if (selectedBarn) {
    const tMin = currentTMin();
    const elapsed = clock.getElapsedTime();
    const delta = elapsed - lastElapsed;
    lastElapsed = elapsed;

    detail.render({
      tMin,
      showVolume: dom.toggleVolume.checked,
      showStreams: dom.toggleVec.checked,
      spreadIntensity: Number(dom.thresholdSlider.value),
      delta,
    });

    dom.infoTemp.textContent = `${selectedBarn.supplyTemp.toFixed(1)}°C`;
    dom.infoTime.textContent = `${tMin}분`;
  }
})();
