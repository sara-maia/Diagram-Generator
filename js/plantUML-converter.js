const axios = require("axios");
const compress = require("./third_party/plantuml.js");
const folderPath = "/Users/Sara.Maia/Dev/zen/";

function createPlantUmlText(tourStops) {
  const order = getIndexOrder(tourStops);
  const uml = [];
  uml.push("@startuml", "!theme aws-orange");
  for (let i = 0; i < order.length - 1; i++) {
    const origin = tourStops[order[i].index].fileName;
    const dest = tourStops[order[i + 1].index].fileName;
    if (origin != dest) {
      uml.push(formatUmlLine(origin, dest, "placeholder message"));
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

function formatUmlLine(start, end, message) {
  return `${start.replace(/-/g, "")} -> ${end.replace(/-/g, "")} : ${message}`;
}

module.exports = {
  createPlantUmlText,
  createSvgUrl,
  createSvgXml,
};
