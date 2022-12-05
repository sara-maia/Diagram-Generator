const standardPort = "5000";
const folderForm = document.querySelector("#folderForm");
const folderField = document.querySelector("#folderField");
const umlForm = document.querySelector("#umlForm");
const umlField = document.querySelector("#umlField");
const exportButton = document.querySelector("#buttonExport");
const canvas = document.querySelector("#canvas");

let tour;
let uml;
let page;
let diagram;
let loadingMsg = "processing.....";

folderForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!folderField.value) {
    return;
  }
  updateUml(loadingMsg);
  updateTourData(folderField.value);
});

umlForm.addEventListener("submit", (e) => {
  e.preventDefault();
  updateUml(umlField.value);
  updateDiagram(umlField.value);
});

exportButton.addEventListener("click", (e) => {
  e.preventDefault();

  const copyText = JSON.stringify({
    tour,
    uml,
    diagram,
    createdAt: Date.now(),
  });
  navigator.clipboard
    .writeText(copyText)
    .then(() => alert("JSON code copied to clipboard"), console.log(copyText));
});

const updateUml = (newUml) => {
  umlField.value = newUml;
  if (newUml !== loadingMsg) {
    uml = newUml;
  }
};

const updateTourData = (folderPath) => {
  fetchData("tour", folderPath)
    .then((tourStops) => {
      tour = tourStops;
      return fetchData("uml", tourStops);
    })
    .then((newUml) => {
      updateUml(newUml);
      updateDiagram(newUml);
      exportButton.disabled = false;
      exportButton.classList.remove("button-disabled");
    })
    .catch((err) => console.error(err));
};

const updateDiagram = (newUml) => {
  if (!newUml) {
    return;
  }
  fetchData("svg", newUml)
    .then((xml) => {
      diagram = xml;
      canvas.innerHTML = xml;
      const boxesData = createBoxesData();
      createInfoBoxes(boxesData);
    })
    .catch((err) => console.error(err));
};

async function fetchData(endpoint, data) {
  const response = await fetch(`http://localhost:${standardPort}/${endpoint}`, {
    method: "POST",
    cache: "no-cache",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
  });
  return response.json();
}

function createBoxesData() {
  const boxes = [];
  const diagramTags = document.getElementsByTagName("text");
  const tourNames = [...new Set(tour.map((tourStop) => tourStop.title))];
  tourNames.forEach((name) => {
    const pair = [...diagramTags].filter(
      (diagramTag) => diagramTag.innerHTML === name.replace(/-/g, "")
    );
    const rect1 = pair[0]?.getBoundingClientRect();
    const rect2 = pair[1]?.getBoundingClientRect();
    const tourObj = tour.find((tourStop) => tourStop.title === name);
    pair[0].innerHTML = pair[1].innerHTML = name;
    // tourObj.fileFolder.split("/").at(-1) + "/" + name;

    const box = {
      id: tourObj.ids?.[0],
      file: tourObj.fileName,
      folder: tourObj.fileFolder,
      snippet: tourObj.codeSnippet,
      lines: `${tourObj.codeLines?.start} to ${tourObj.codeLines?.end}`,
      xLeft: Math.min(rect1.left, rect2.left) - 10,
      xRight: Math.max(rect1.right, rect2.right) + 10,
      yTop: Math.min(rect1.top, rect2.top) - 10,
      yBottom: Math.max(rect1.bottom, rect2.bottom) + 10,
    };
    boxes.push(box);
  });
  return boxes;
}

function createInfoBoxes(boxes) {
  boxes.forEach((box) => {
    // const formattedCode = js_beautify(box.folder)
    const boxDiv = document.createElement("div");
    const boxDivModal = document.createElement("div");
    boxDiv.classList.add("info-box");
    boxDivModal.classList.add("info-box-modal");
    boxDiv.style.top = `${box.yTop}px`;
    boxDiv.style.left = `${box.xLeft}px`;
    boxDiv.style.width = `${box.xRight - box.xLeft}px`;
    boxDiv.style.height = `${box.yBottom - box.yTop}px`;
    boxDivModal.innerHTML = `<p><strong>file:</strong> ${box.file}</p>
        <hr>
        <p><strong>folder:</strong> ${box.folder}</p>
        <hr>
        <p><strong>lines of code:</strong> ${box.lines}</p>
        <hr>
        <p><strong>snippet:</strong></p>
        <p><code><pre class="prettyprint">${box.snippet}</pre></code></p>`;
    canvas.appendChild(boxDiv);
    canvas.appendChild(boxDivModal);
  });
}
