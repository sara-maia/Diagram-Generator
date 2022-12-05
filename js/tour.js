const START_MARKER = "@tourStart";
const END_MARKER = "@tourEnd";
const START_FORMATTER = "<span class='code-highlight'>";
const END_FORMATTER = "</span>";

const fs = require("fs");
const { resolve } = require("path");
const { readdir } = require("fs").promises;

async function assembleTour(dir) {
  try {
    const files = await getFiles(dir);
    return formatTourData(files);
  } catch (error) {
    return error;
  }
}

async function getFiles(dir) {
  const dirEntries = await readdir(dir, { withFileTypes: true });

  const files = await Promise.all(
    dirEntries.map((entry) => {
      const res = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        return getFiles(res);
      } else {
        const validExtensions = ["ts", "tsx", "js", "jsx", "html"];
        const fileExtension = entry.name.split(".").pop();
        if (!validExtensions.includes(fileExtension)) {
          return;
        }
        return {
          fullPath: res,
          fileName: entry.name,
          fileExtension,
          fileFolder: dir,
        };
      }
    })
  );
  return Array.prototype.concat(...files).filter((file) => file);
}

function formatTourData(filesArray) {
  const tourData = [];

  filesArray.forEach((file) => {
    const fileString = fs.readFileSync(file.fullPath, {
      encoding: "utf8",
      flag: "r",
    });
    if (fileString.includes(START_MARKER)) {
      const lines = fileString.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(START_MARKER)) {
          const code = getCodeInfo(lines, i);
          const tourStop = {
            ...retrieveArgs(lines[i]),
            codeSnippet: code.snippet,
            codeLines: { start: code.startLine, end: code.endLine },
            fileName: file.fileName,
            fileFolder: file.fileFolder,
            fileExtension: file.fileExtension,
          };
          tourData.push(tourStop);
          i = code.endLine;
        }
      }
    }
  });
  return tourData;
}

function getCodeInfo(linesArr, index) {
  const startLine = index;
  let lineCounter = index + 1;
  let endLine;
  let mainCodeSnippet = [START_FORMATTER];
  while (lineCounter < linesArr.length) {
    if (linesArr[lineCounter].includes(END_MARKER)) {
      mainCodeSnippet.push(END_FORMATTER);
      endLine = lineCounter;
      break;
    }
    mainCodeSnippet.push(linesArr[lineCounter]);
    lineCounter++;
  }

  const upperContext = getUpperContext(linesArr, startLine);
  const lowerContext = getLowerContext(linesArr, endLine);
  const codeWithContext = upperContext
    .concat(mainCodeSnippet, lowerContext)
    .join("\n");

  return { snippet: codeWithContext, startLine, endLine };
}

function retrieveArgs(str, initialPosition = 0) {
  const argStart =
    str.indexOf(START_MARKER, initialPosition) + START_MARKER.length + 1;
  if (argStart === START_MARKER.length) {
    //does not exist
    return null;
  }
  let nextChar = argStart;
  let argString = "";
  while (str[nextChar] !== ")" && nextChar < argStart + 255) {
    argString = argString + str[nextChar];
    nextChar++;
  }
  let properties = argString.split(" ");
  const obj = {};
  properties.forEach((property) => {
    let tup = property.split(":");
    obj[tup[0]] = tup[1].split(",");
  });

  if (obj.outboundMessage?.[0]) {
    obj.outboundMessage = obj.outboundMessage[0].split("--").join(" ");
  }

  if (obj.title?.[0]) {
    obj.title = obj.title[0].split("--").join(" ");
  }

  return obj;
}

function getUpperContext(linesArray, lineNumber) {
  let upperContext = [];
  let callStatusChanged = false;
  let currentIdentation = lineIdentation(linesArray[lineNumber + 1]);
  for (let i = lineNumber - 1; i >= 0; i--) {
    if (currentIdentation.length === 0) {
      if (
        linesArray[i + 1].startsWith("})") ||
        linesArray[i + 1].startsWith(")")
      ) {
        while (i > 0 && lineIdentation(linesArray[i]).length !== 0) {
          i--;
        }
        upperContext.push(linesArray[i]);
      }
      break;
    } else if (linesArray[i].length < 1 || lineIsComment(linesArray[i])) {
      callStatusChanged = false;
    } else if (
      lineIdentation(linesArray[i]).length < currentIdentation.length
    ) {
      currentIdentation = lineIdentation(linesArray[i]);
      callStatusChanged = true;
      upperContext.push(linesArray[i]);
    } else if (
      lineIdentation(linesArray[i]).length > currentIdentation.length
    ) {
      let tempIdentationSize = lineIdentation(linesArray[i + 1]).length;
      i--;
      while (
        lineIdentation(linesArray[i]).length !== tempIdentationSize &&
        i >= 0 &&
        lineIdentation(linesArray[i - 1]).length !== 0 &&
        !linesArray[i - 1]?.includes(END_MARKER)
      ) {
        i--;
      }
      callStatusChanged = false;
    } else {
      if (callStatusChanged) {
        upperContext.push(currentIdentation + "...");
        callStatusChanged = false;
      }
    }
  }
  return upperContext.reverse();
}

function getLowerContext(linesArray, lineNumber) {
  let lowerContext = [];
  let callStatusChanged = false;
  let currentIdentation = lineIdentation(linesArray[lineNumber]);
  for (let i = lineNumber + 2; i < linesArray.length; i++) {
    if (currentIdentation.length === 0) {
      break;
    } else if (linesArray[i].length < 1 || lineIsComment(linesArray[i])) {
      callStatusChanged = false;
    } else if (
      lineIdentation(linesArray[i]).length < currentIdentation.length
    ) {
      currentIdentation = lineIdentation(linesArray[i]);
      callStatusChanged = true;
      if (linesArray[i].endsWith("{")) {
        lowerContext.push(linesArray[i] + "...}");
      } else {
        lowerContext.push(linesArray[i]);
      }
    } else if (
      lineIdentation(linesArray[i]).length > currentIdentation.length
    ) {
      let tempIdentationSize = lineIdentation(linesArray[i - 1]).length;
      i++;
      while (
        lineIdentation(linesArray[i]).length !== tempIdentationSize &&
        lineIdentation(linesArray[i + 1]).length !== 0 &&
        i < linesArray.length &&
        !linesArray[i + 1]?.includes(START_MARKER)
      ) {
        i++;
      }
      callStatusChanged = false;
    } else {
      if (callStatusChanged) {
        lowerContext.push(currentIdentation + "...");
        callStatusChanged = false;
      }
    }
  }
  return lowerContext;
}

function lineIdentation(string) {
  let identation = "";
  if (string && string.length > 0) {
    for (let char of string) {
      if (char === " ") {
        identation = identation + " ";
      } else {
        break;
      }
    }
  }
  return identation;
}

function lineIsComment(line) {
  if (
    line.includes("//") ||
    line.includes("/**") ||
    line.includes(" * ") ||
    line.includes("*/")
  ) {
    return true;
  } else {
    return false;
  }
}

// assembleTour("/Users/Sara.Maia/Dev/zen/packages/data/src/pricing").then((res) =>
//   console.log(res)
// );

module.exports = assembleTour;
