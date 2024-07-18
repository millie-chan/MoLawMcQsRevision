const fs = require("fs");
const path = require("path");
const PDFParser = require("pdf2json"); 
const pdfParser = new PDFParser();

var init = () => {
  var args = process.argv;
  if (args.length < 3) {
    console.error("usage: node index.js <src file> [<dest file>]");
    process.exit(1);
  }
  let destPath = "";
  if (args.length >= 4) {
    destPath = args[3];
  } else {
    destPath = path.join(args[2], "..", "output.json")
  }
  loadPDF(args[2], destPath);
}

var loadPDF = (path, destPath) => {
  pdfParser.on("pdfParser_dataError", (errData) =>
    console.error(errData.parserError)
  );
  pdfParser.on("pdfParser_dataReady", (pdfData) => {
    var data = processLawPDFJson(pdfData);
    exportToFile(destPath, JSON.stringify(data, null, 2));
  });

  pdfParser.loadPDF(path);
}

var processLawPDFJson = (pdfData) => {
  let lawQsObjArr = [];
  let isTitle = true;
  let pageArr = pdfData.Pages.map(page =>
    page.Texts.map(text => {
      var textArr = text.R.map(r => 
        decodeURIComponent(r.T).trim()
      );
      if (textArr.length > 1) {
        console.warn("text arr length is more than 1, need checking", textArr);
        return textArr.join("");
      } else {
        return textArr[0];
      }
    }).filter(text => text.length > 0)
  );
  //console.log(pageArr[129]);
  //process.exit(-1);

  // process table of content
  let tableOfContentPage = pageArr[1];
  let foundContentText = 0;
  tableOfContentPage.forEach(text => {
    let trimmedText = text.trim();
    if (trimmedText.length > 0) {
      if (foundContentText < 2) {
        if (trimmedText.indexOf("目") > -1) {
          foundContentText++;
        }
        if (foundContentText == 1 && trimmedText.indexOf("錄") > -1) {
          foundContentText++;
        }
      } else {
        if (trimmedText.indexOf("-") == -1) {
          if (isTitle) {
            if (lawQsObjArr.length == 0 || (lawQsObjArr[lawQsObjArr.length - 1].pageNum != null)) {
              lawQsObjArr.push({title: trimmedText});
            } else {
              lawQsObjArr[lawQsObjArr.length - 1].title = lawQsObjArr[lawQsObjArr.length - 1].title + trimmedText;
            }
          } else {
            lawQsObjArr[lawQsObjArr.length - 1].pageNum = Number(trimmedText);
            isTitle = true;
          }
        } else {
          isTitle = false;
        }
      }
    }
  });

  // process normal pages
  for (let i = 0; i < lawQsObjArr.length; i++) {
  //for (let i = 2; i < 3; i++) {
    var currentLaw = lawQsObjArr[i];
    currentLaw.qsArr = [];
    var lastPageNum = pageArr.length - 2;
    if (i < (lawQsObjArr.length - 1)) {
      lastPageNum = lawQsObjArr[i + 1].pageNum - 1;
    }

    let isHeader = true;
    let isQs = false;
    let isAnsPage = false;
    let currentQs = currentLaw.qsArr[0];
    for (let pageNum = currentLaw.pageNum + 1; pageNum < lastPageNum + 2; pageNum++) {
      let currentPage = pageArr[pageNum];
      if (!isAnsPage) {
        for (let j = 0; j < currentPage.length; j++) {
          let text = currentPage[j];
          if (isHeader) {
            if (/[0-9]+\)/.test(text)) {
              var qsPrefix = text;
              if (j > 0 && /^[0-9]+$/.test(currentPage[j - 1])) {
                qsPrefix = currentPage[j - 1] + qsPrefix;
              }
              isHeader = false;
              isQs = true;
              currentLaw.qsArr.push({qsPrefix, qs: "", ansArr: [], ans: "", explanation: ""});
            } else if (text == "答案") {
              pageNum--;
              isAnsPage = true;
              break;
            }
            continue;
          }
          let currentQs = currentLaw.qsArr[currentLaw.qsArr.length - 1];
          if (/[0-9]+\)/.test(text)) {
            isQs = true;
            currentLaw.qsArr.push({qsPrefix: text, qs: "", ansArr: [], ans: "", explanation: ""});
          } else if (/[A-Z]\./.test(text)) {
            currentQs.ansArr.push(text + " ");
            isQs = false;
          } else if (isQs) {
            currentQs.qs = currentQs.qs + text;
          } else {
            if ((j < currentPage.length - 1) && /^[0-9]+$/.test(text) && /[0-9]+\)/.test(currentPage[j + 1])) {
              currentPage[j + 1] = text + currentPage[j + 1];
              currentPage[j] = "";
              continue;
            }
            currentQs.ansArr[currentQs.ansArr.length - 1] = currentQs.ansArr[currentQs.ansArr.length - 1] + text;
          }
        }
        isHeader = true;
      } else {
        isHeader = true;
        for (let j = 0; j < currentPage.length; j++) {
          let text = currentPage[j];
          if (isHeader) {
            if (text == "條文") {
              isHeader = false;
            }
            continue;
          }
          
          if (/^[0-9]+\s+[A-Z]{1}$/.test(text)) {
            let matches = text.match(/([0-9]+)\s+([A-Z]{1})/);
            let qsNum = matches[1];
            let qsAns = matches[2];
            currentQs = currentLaw.qsArr[Number(qsNum) - 1];
            currentQs.ans = qsAns;
          } else if (/^[0-9]+$/.test(text) && j < currentPage.length - 1 && /^[A-Z]{1}$/.test(currentPage[j + 1])) {
            let qsNum = text;
            let qsAns = currentPage[j + 1];
            j++;
            currentQs = currentLaw.qsArr[Number(qsNum) - 1];
            currentQs.ans = qsAns;
          } else if (currentQs != null) {
            currentQs.explanation = currentQs.explanation + text;
          } else {
            console.error("something went wrong", text, j, currentPage);
            process.exit(-1);
          }
        }
      }
    }
  }
  return lawQsObjArr;
}

var exportToFile = (destPath, str) => {
  fs.writeFile(
    destPath,
    str,
    (err) => err && console.log(err)
  );
}

init();
