const axios = require("axios");
const compress = require("./third_party/plantuml.js");
const folderPath = "/Users/Sara.Maia/Dev/zen/";

function createPlantUmlText(tourStops) {
  const order = getIndexOrder(tourStops);
  const uml = [];
  const routeMap = new Map();
  uml.push(
    "@startuml",
    "!theme aws-orange",
    "actor Client",
    `Client -> ${tourStops[order[0].index].fileName.replace(
      /-/g,
      ""
    )}: placeholder message`
  );
  for (let i = 0; i < order.length - 1; i++) {
    const origin = tourStops[order[i].index].fileName;
    const dest = tourStops[order[i + 1].index].fileName;
    if (!findBetween(origin, 0, i, order, tourStops)) {
      uml.push("activate " + origin.replace(/-/g, ""));
    }
    if (origin != dest) {
      const isReturn = routeMap.get(dest) === origin;
      uml.push(formatUmlLine(origin, dest, "placeholder message", isReturn));
      if (isReturn) {
        routeMap.delete(dest);
      } else {
        routeMap.set(origin, dest);
      }
    }
    if (!findBetween(origin, i + 1, order.length, order, tourStops)) {
      uml.push("deactivate " + origin.replace(/-/g, ""));
    }
  }
  uml.push("@enduml");
  return uml.join("\n");
}

function createSvgUrl(uml) {
  return "https://www.plantuml.com/plantuml/svg/" + compress(uml);
}

async function createSvgXml(url) {
  try {
    let response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(error);
  }
}

function getIndexOrder(objArr) {
  const order = [];
  objArr.forEach((obj, index) => {
    obj.steps.forEach((stepStr) => {
      const step = parseFloat(stepStr);
      order.push({ index, step });
    });
  });
  return order.sort((a, b) => a.step - b.step);
}

function findBetween(name, startIndex, endIndex, order, tourObjs) {
  let includesName = false;
  for (let i = startIndex; i < endIndex; i++) {
    if (tourObjs[order[i].index].fileName === name) {
      includesName = true;
    }
  }
  return includesName;
}

function formatUmlLine(start, end, message, isReturn) {
  return `${start.replace(/-/g, "")} ${isReturn ? "-->" : "->"} ${end.replace(
    /-/g,
    ""
  )} : ${message}`;
}

module.exports = {
  createPlantUmlText,
  createSvgUrl,
  createSvgXml,
};
