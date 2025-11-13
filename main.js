const dateInput = document.getElementById("dateInput");
const segmentNodes = Array.from(
  dateInput.querySelectorAll(".date-input__segment")
);
const liveOutput = document.getElementById("liveDate");

const segmentConfigs = [
  { type: "day", length: 2, min: 1, max: 31 },
  { type: "month", length: 2, min: 1, max: 12 },
  { type: "year", length: 4, min: 1900, max: 2099 },
];

const configByType = segmentConfigs.reduce((map, config) => {
  map[config.type] = config;
  return map;
}, {});

const state = {
  day: 3,
  month: 2,
  year: 2025,
};

const buffers = {
  day: "",
  month: "",
  year: "",
};

const previews = {
  day: null,
  month: null,
  year: null,
};

let activeIndex = 0;
let hasFocus = false;

function pad(value, length) {
  return String(value).padStart(length, "0");
}

function placeholder(length) {
  return " ".repeat(length);
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getFirstDigitLimit(config) {
  if (config.length === 1) {
    return config.max;
  }
  return Math.floor(config.max / Math.pow(10, config.length - 1));
}

function formatState() {
  return `${pad(state.day, 2)}/${pad(state.month, 2)}/${pad(state.year, 4)}`;
}

function render() {
  segmentConfigs.forEach((config, index) => {
    const node = segmentNodes[index];
    const preview = previews[config.type];
    node.textContent = preview ?? pad(state[config.type], config.length);
    node.classList.toggle("is-active", hasFocus && index === activeIndex);
    node.classList.toggle("is-preview", preview !== null);
  });

  if (!liveOutput) {
    return;
  }

  liveOutput.textContent = `Selected date: ${formatState()}`;
}

function setActiveIndex(nextIndex) {
  const safeIndex = Math.max(0, Math.min(segmentConfigs.length - 1, nextIndex));
  activeIndex = safeIndex;
  render();
}

function moveSegment(delta) {
  const currentType = segmentConfigs[activeIndex].type;
  if (buffers[currentType]) {
    finalizeSegment(currentType, parseInt(buffers[currentType], 10), false);
  }

  const nextIndex =
    (activeIndex + delta + segmentConfigs.length) % segmentConfigs.length;
  activeIndex = nextIndex;
  render();
}

function applyPreview(type, buffer) {
  const config = configByType[type];
  buffers[type] = buffer;
  const previewText =
    buffer.length === 0
      ? placeholder(config.length)
      : buffer + placeholder(config.length - buffer.length);
  previews[type] = previewText;
  render();
}

function clearPreview(type) {
  buffers[type] = "";
  previews[type] = null;
}

function normalizeValue(type, rawValue) {
  const config = configByType[type];
  let value = Number.isNaN(rawValue) ? null : rawValue;

  if (buffers[type]) {
    value = parseInt(buffers[type], 10);
  }

  if (value === null || Number.isNaN(value)) {
    return config.min;
  }

  if (config.length > 1 && value < config.min) {
    // Allow 0 as a transient value but clamp when finalizing.
    value = config.min;
  }

  if (type === "day") {
    const maxForMonth = daysInMonth(state.year, state.month);
    return Math.min(Math.max(value, config.min), maxForMonth);
  }

  return Math.min(Math.max(value, config.min), config.max);
}

function finalizeSegment(type, rawValue, shouldAdvance = true) {
  const hasPending = buffers[type] !== "" || previews[type] !== null;
  if (!hasPending && (rawValue === undefined || Number.isNaN(rawValue))) {
    return;
  }

  const config = configByType[type];
  const value = normalizeValue(type, rawValue);

  if (type === "day") {
    state.day = value;
  } else if (type === "month") {
    state.month = value;
    // Adjust max day for the new month.
    const maxDay = daysInMonth(state.year, state.month);
    if (state.day > maxDay) {
      state.day = maxDay;
      clearPreview("day");
    }
  } else if (type === "year") {
    state.year = value;
    const maxDay = daysInMonth(state.year, state.month);
    if (state.day > maxDay) {
      state.day = maxDay;
      clearPreview("day");
    }
  }

  clearPreview(type);
  render();

  if (shouldAdvance) {
    const nextIndex =
      (activeIndex + 1 + segmentConfigs.length) % segmentConfigs.length;
    activeIndex = nextIndex;
    render();
  }
}

function handleDigit(key) {
  const config = segmentConfigs[activeIndex];
  const type = config.type;
  const currentBuffer = buffers[type];
  const nextBuffer = currentBuffer + key;
  const numeric = parseInt(nextBuffer, 10);
  const firstDigitLimit = getFirstDigitLimit(config);

  if (nextBuffer.length === 1) {
    if (key === "0" && config.min === 1) {
      applyPreview(type, nextBuffer);
      return;
    }

    if (numeric > firstDigitLimit && config.length > 1) {
      buffers[type] = nextBuffer;
      finalizeSegment(type, numeric);
      return;
    }
  }

  if (nextBuffer.length >= config.length) {
    buffers[type] = nextBuffer;
    finalizeSegment(type, numeric);
    return;
  }

  applyPreview(type, nextBuffer);
}

function handleBackspace() {
  const config = segmentConfigs[activeIndex];
  const type = config.type;
  const currentBuffer = buffers[type];

  if (currentBuffer.length > 0) {
    const nextBuffer = currentBuffer.slice(0, -1);
    if (nextBuffer.length === 0) {
      clearPreview(type);
    } else {
      applyPreview(type, nextBuffer);
    }
    render();
    return;
  }

  applyPreview(type, "");
  state[type] = config.min;
  render();
}

function changeSegmentBy(type, delta) {
  const config = configByType[type];
  let nextValue = state[type] + delta;

  if (type === "day") {
    const maxForMonth = daysInMonth(state.year, state.month);
    if (nextValue > maxForMonth) {
      nextValue = config.min;
    } else if (nextValue < config.min) {
      nextValue = maxForMonth;
    }
    state.day = nextValue;
  } else if (type === "month") {
    if (nextValue > config.max) {
      nextValue = config.min;
    } else if (nextValue < config.min) {
      nextValue = config.max;
    }
    state.month = nextValue;
    const maxDay = daysInMonth(state.year, state.month);
    if (state.day > maxDay) {
      state.day = maxDay;
    }
  } else if (type === "year") {
    if (nextValue > config.max) {
      nextValue = config.min;
    } else if (nextValue < config.min) {
      nextValue = config.max;
    }
    state.year = nextValue;
    const maxDay = daysInMonth(state.year, state.month);
    if (state.day > maxDay) {
      state.day = maxDay;
    }
  }

  clearPreview(type);
  render();
}

function handleKeyDown(event) {
  const { key } = event;

  if (!/^[0-9]$/.test(key) && key !== "Backspace" && key !== "Delete") {
    switch (key) {
      case "ArrowRight":
        event.preventDefault();
        moveSegment(1);
        return;
      case "ArrowLeft":
        event.preventDefault();
        moveSegment(-1);
        return;
      case "ArrowUp":
        event.preventDefault();
        changeSegmentBy(segmentConfigs[activeIndex].type, 1);
        return;
      case "ArrowDown":
        event.preventDefault();
        changeSegmentBy(segmentConfigs[activeIndex].type, -1);
        return;
      case "Enter":
      case "Tab":
        finalizeSegment(
          segmentConfigs[activeIndex].type,
          parseInt(buffers[segmentConfigs[activeIndex].type], 10),
          false
        );
        return;
      default:
        return;
    }
  }

  event.preventDefault();

  if (/^[0-9]$/.test(key)) {
    handleDigit(key);
    return;
  }

  handleBackspace();
}

function handleClick(event) {
  const targetSegment = event.target.closest(".date-input__segment");
  if (!targetSegment) {
    return;
  }

  const index = segmentNodes.indexOf(targetSegment);
  if (index >= 0) {
    setActiveIndex(index);
  }
}

dateInput.addEventListener("focus", () => {
  hasFocus = true;
  render();
});

dateInput.addEventListener("blur", () => {
  const currentType = segmentConfigs[activeIndex].type;
  finalizeSegment(
    currentType,
    parseInt(buffers[currentType], 10),
    false
  );

  hasFocus = false;
  render();
});

dateInput.addEventListener("keydown", handleKeyDown);
dateInput.addEventListener("click", handleClick);

segmentNodes.forEach((segment, index) => {
  segment.addEventListener("click", () => {
    setActiveIndex(index);
    dateInput.focus();
  });
});

render();
