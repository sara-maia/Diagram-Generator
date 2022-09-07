const express = require("express");
const cors = require("cors");
const app = express();
const assembleTour = require("./js/tour");
const {
  createPlantUmlText,
  createSvgUrl,
  createSvgXml,
} = require("./js/plantUML-converter");

//middleware
app.use(cors());
app.use(express.static("./ui"));
app.use(express.json());

//routes
app.get("/", (_req, res) => {
  res.status(200).send("IT'S ALIVE!!!");
});
app.post("/tour", getTourData);
app.post("/uml", getUml);
app.post("/svg", getSvg);
app.post("/viz", createStaticVizData);

//controllers
async function getTourData(req, res) {
  const folderPath = req.body.data;
  const tourData = await assembleTour(folderPath);
  res.status(200).json(tourData);
}

function getUml(req, res) {
  const tourData = req.body.data;
  const uml = createPlantUmlText(tourData);
  res.status(200).json(uml);
}

async function getSvg(req, res) {
  const uml = req.body.data;
  const url = createSvgUrl(uml);
  const xml = await createSvgXml(url);
  res.status(200).json(xml);
}

function createStaticVizData(req, res) {}

//listen
app.listen(5000, () => {
  console.log("server started on port 5000...");
});
