# Overview

This application is a tool for generating sequence diagrams based on purpose-set comments in the codebase.
The tool executes the following tasks:

- Parses all js, jsx, ts, tsx & html files inside a given directory (including sub-directories) in search of start (@@@tourStart) and end (@@@tourEnd) markers in the code.
- `//@@@tourStart` comments take a `step` argument which indicates the order (i.e. tour step number) of that specific bit of code in the sequence / diagram
- Creates an array of objects for commented files with the following keys: fileName, fileFolder, fileExtension, stepNumbers, and codeSnippet.
- Code snippet is formatted to display code chunks between @@@tourStart and @@@tourEnd lines plus opening and closing contexts. E.g. if code snippet is inside a nested function, the snippet will be formatted to include the opening and closing lines of outer blocks based on indentation.
- Generates UML code following PlantUML syntax based on the array of objects generated in the previous step.
- Encodes UML code for PlantUML api & retrieves SVG file from PlantUML server.
- Creates interactive layer above SVG: hovering each step in the diagram shows related data about the file as well as the code snippet.
- Displays diagram draft (SVG) and allows for real-time editing of UML code & resulting diagram with in-browser graphic interface.
- Generates standalone HTML page with final diagram & interactive features.

Demo:

![DiaGen](https://user-images.githubusercontent.com/109988361/188956170-3f9af6a0-243c-40cd-984c-902c44250e7b.gif)

# Getting Started

## Local

Assumes you already have `git`, `node (15.3.0 up)`, and `npm` installed on your machine.

- Clone repo:

```
git clone git@github.com:sara-maia/Generate-Diagram.git
```

- Install dependencies:

```
npm install
```

- Start server & ui:

```
npm start
```

- Browser will load. Follow instructions on page.

# Usage

## Adding comments to code

### Rules:

- All @@@tourStart markers accept any number of arguments that will be incorporated to the final object. Format: `key:value` separated by space
- All @@tourStart markers require at minimum the `step` argument. `step` accepts float numbers, and can be separated by comma if multiple
- @@@tourEnd signals the end of the snippet initiated by the preceding @tourStart line
- A file can contain several snippets

### Example 1:

```
//@@@tourStart(step:01 id:1234)
const example = () => {
    return "this is just an example code"
}
//@@@tourEnd
```

### Example 2:

```
//@@@tourStart(step:01,02.1,02.3 id:1235 madeUpArg:hello)
const example = () => {
    return "this is just an example code"
}
//@@@tourEnd

const relevant = false

const anotherExample = () => {
    let code = "Not very relevant bit"
    //@@@tourStart(step:02.2 id:1236)
    code = "now it is"
    //@@@tourEnd
}
```

## Running the app

- In the terminal, go to folder where SequenceDia.js lives. Run `npm start` .

# Readiness Checklist

### Known issues

- Generating standalone html page is still not fully implemented. In progress.
- ...
