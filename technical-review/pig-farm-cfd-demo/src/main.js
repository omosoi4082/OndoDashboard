import * as THREE from "three";
import { BARNS } from "./config.js";
import { createOverviewScene } from "./overviewScene.js";
import { createDetailScene } from "./detailScene.js";
import { getDom, frameToMinutes } from "./ui.js";

const dom = getDom();

let playing = false;
let playTimer = null;

function currentTMin() {
  return frameToMinutes(Number(dom.timeSlider.value));
}

const overview = createOverviewScene(dom.mainCanvas);
const detail = createDetailScene(dom.detailCanvas, dom.hoverTooltip);

function resizeDetailRenderer() {
  detail.resize(dom.detailCanvasWrap);
}

// 상세보기 패널은 항상 열려있고, 항상 자돈사 A동만 표출한다 — 클릭으로 열고/닫는
// 인터렉션은 없다(index.html에서 #overview/#detailPanel도 처음부터 열린 상태로 마크업됨).
const selectedBarn = BARNS[0];
detail.setSelectedBarn(selectedBarn);
dom.barnTitleEl.textContent = selectedBarn.name;
dom.infoAch.textContent = `${selectedBarn.ach} 회/h`;
dom.infoHum.textContent = `${selectedBarn.humidity}%`;
overview.resize();
overview.refit();
resizeDetailRenderer();

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
  resizeDetailRenderer();
});
resizeMain();

const clock = new THREE.Clock();
let lastElapsed = 0;

(function animate() {
  requestAnimationFrame(animate);
  overview.render();

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
})();
