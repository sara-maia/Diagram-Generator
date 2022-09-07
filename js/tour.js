const START_MARKER = "@@@tourStart";
const END_MARKER = "@@@tourEnd";
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
        const fileExtension = entry.name
          .split(".")
          .filter(Boolean) // removes empty extensions (e.g. `filename...txt`)
          .slice(1)
          .join(".");
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
    const fileArgs = retrieveArgs(fileString);
    if (fileArgs) {
      const codeSnippet = formatCodeSnippet(fileString, file.fileName);
      const fileObject = {
        fileName: file.fileName,
        fileFolder: file.fileFolder,
        fileExtension: file.fileExtension,
        steps: fileArgs.step,
        ids: fileArgs.id,
        codeSnippet: codeSnippet,
      };
      tourData.push(fileObject);
    }
  });
  return tourData;
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

  let nextObj = retrieveArgs(str, argStart);
  if (nextObj) {
    obj.id = obj.id.concat(nextObj.id);
    obj.step = obj.step.concat(nextObj.step);
  }
  return obj;
}

function formatCodeSnippet(fileString, file) {
  const lines = fileString.split(/\r?\n/);

  return formatSnippet(lines, 0, lines.length).join("\n");

  function formatSnippet(linesArray, start, end) {
    // console.log("file: ", file, " | start line: ", start, " | end line: ", end);
    const codeOfInterest = findCode(linesArray, start, end);
    if (!codeOfInterest) {
      return null;
    }
    const upperContext = getUpperContext(linesArray, codeOfInterest.topLine);
    const lowerContext = getLowerContext(linesArray, codeOfInterest.bottomLine);

    // console.log("file: ", file, " | upper context: ", upperContext);
    // console.log("file: ", file, " | main code: ", codeOfInterest);
    // console.log("file: ", file, " | lower context: ", lowerContext);

    let snippet = upperContext.code.concat(
      codeOfInterest.foundCode,
      lowerContext.code
    );

    let nextChunk = formatSnippet(
      linesArray,
      lowerContext.bottomLine,
      linesArray.length
    );
    if (nextChunk) {
      snippet = snippet.concat(nextChunk);
    }

    return snippet.filter((line) => line.length > 0);
  }

  function findCode(linesArray, start, end) {
    let foundCode = [];
    let topLine;
    let bottomLine;

    if (end <= start) {
      return null;
    }

    for (let i = start; i < end; i++) {
      if (linesArray[i].includes(START_MARKER)) {
        i++;
        foundCode.push(START_FORMATTER);
        foundCode.push(linesArray[i]);
        topLine = i - 1;
      } else if (linesArray[i].includes(END_MARKER)) {
        foundCode.push(END_FORMATTER);
        bottomLine = i;
        break;
      } else if (foundCode.length > 0) {
        if (!lineIsComment(linesArray[i])) {
          foundCode.push(linesArray[i]);
        }
      }
    }

    if (foundCode.length === 0) {
      return null;
    }

    return { foundCode, topLine, bottomLine };
  }

  function getUpperContext(linesArray, lineNumber) {
    let upperContext = [];
    let topLine = 0;
    let bottomLine = lineNumber;
    let callStatusChanged = false;
    let currentIdentation = lineIdentation(linesArray[lineNumber + 1]);
    for (let i = lineNumber - 1; i >= 0; i--) {
      if (currentIdentation.length === 0) {
        topLine = i - 1;
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
      } else if (linesArray[i].includes(END_MARKER)) {
        topLine = i - 1;
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
    return { code: upperContext.reverse(), topLine, bottomLine };
  }

  function getLowerContext(linesArray, lineNumber) {
    let lowerContext = [];
    let topLine = lineNumber;
    let bottomLine;
    let callStatusChanged = false;
    let currentIdentation = lineIdentation(linesArray[lineNumber]);
    for (let i = lineNumber + 2; i < linesArray.length; i++) {
      if (currentIdentation.length === 0) {
        bottomLine = i - 1;
        break;
      } else if (linesArray[i].includes(START_MARKER)) {
        // lowerContext = [];
        bottomLine = i;
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
        bottomLine = i;
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
    if (!bottomLine) {
      bottomLine = linesArray.length;
    }
    return { code: lowerContext, topLine, bottomLine };
  }
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

// assembleTour("/Users/Sara.Maia/Dev/zen/packages/api").then((res) =>
//   console.log(res)
// );

module.exports = assembleTour;
