export function frameToMinutes(frame) {
  return frame * 2;
}

export function getDom() {
  return {
    overview: document.getElementById("overview"),
    mainCanvas: document.getElementById("mainCanvas"),
    detailCanvas: document.getElementById("detailCanvas"),
    detailCanvasWrap: document.getElementById("detailCanvasWrap"),
    hoverTooltip: document.getElementById("hoverTooltip"),

    panel: document.getElementById("detailPanel"),
    barnTitleEl: document.getElementById("barnTitle"),
    closeBtn: document.getElementById("closeBtn"),

    infoTemp: document.getElementById("infoTemp"),
    infoHum: document.getElementById("infoHum"),
    infoAch: document.getElementById("infoAch"),
    infoTime: document.getElementById("infoTime"),

    timeSlider: document.getElementById("timeSlider"),
    timeLabel: document.getElementById("timeLabel"),
    playBtn: document.getElementById("playBtn"),
    toggleVolume: document.getElementById("toggleVolume"),
    toggleVec: document.getElementById("toggleVec"),
    thresholdSlider: document.getElementById("threshold"),
    thresholdVal: document.getElementById("thresholdVal"),
  };
}
