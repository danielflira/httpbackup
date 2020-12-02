import Express = require("express");
import Fs = require("fs");
import Path = require("path");
import Crypto = require("crypto");

let app = Express();
const basePath = "./data/";

let printLog = function(message) {
    console.log("[LOG] " + message);
};

// recebe varias strings com paths faz join dos paths corrigindo erros
let pathJoin = function(...filePaths) {
    let filePathArr = [];
    
    filePaths.forEach((filePath) => {
        filePath.split("/").forEach((e) => {
            if ( e != null && e !== "" ) {
                filePathArr.push(e);
            }
        });
    });

    return Path.join(...filePathArr);
};

// faz o parse de um path separando path e filename
let pathParse = function(filePath) {
    let filePathArr = filePath.split("/").filter((e) => {return e != null && e !== ""});
    let fileName = filePathArr.pop();
    let path = Path.join(...filePathArr);

    return {filePath, fileName, path, default: []};
};

// gera um noe de arquivo temporario
let pathTemp = function() {
    return "temp" + Crypto.randomBytes(16).toString("hex");
};

// le o arquivo de metadados
let readInfo = async function(filePath) {
    let newFilePath = pathJoin(basePath, "meta", filePath);

    try {
        let fileContent = await Fs.promises.readFile(newFilePath);
        return JSON.parse(fileContent.toString("utf8"));
    } catch(e) {
        return pathParse(newFilePath);
    }
};

// escreve o arquivo de metadados
let writeInfo = async function(filePath, parsedPath) {
    let newFilePath = pathJoin(basePath, "meta", filePath);
    let jsonParsedPath = JSON.stringify(parsedPath);

    try {
        await Fs.promises.mkdir(parsedPath.path, {recursive: true});
    } catch(e) {
        printLog(`impossible writeInfo cannot create ${parsedPath.path}`);
        throw e;
    }

    try {
        await Fs.promises.writeFile(newFilePath, jsonParsedPath);
    } catch(e) {
        printLog(`impossible writeInfo cannot write ${newFilePath}`);
        throw e;
    }

    printLog(`meta info to ${filePath} for ${filePath}`);
};

// verifica informação do meta data, copia temporario, atualiza meta data
let updateInfo = async function(filePath, tempHash) {
    let fileInfo = await readInfo(filePath);

    let exists = false;

    fileInfo["default"].forEach((e) => {
        if ( e["md5Hash"] === tempHash["md5Hash"] && e["sha512Hash"] === tempHash["sha512Hash"] ) {
            exists = true;
        }
    });

    if ( exists ) {
        printLog(`${tempHash["sha512Hash"]} already exists, removing ${tempHash["tempFileName"]} tempfile`);
        await Fs.promises.unlink(tempHash["tempFileName"]);
    } else {
        printLog(`${tempHash["sha512Hash"]} does not exist, moving ${tempHash["tempFileName"]} tempfile`);
        await writeStore(tempHash);
    }

    fileInfo["default"].push(tempHash);

    await writeInfo(filePath, fileInfo);
};

// escreve um arquivo temporario para o store
let writeStore = async function(tempHash) {
    let newTempPath = pathJoin(basePath, "store", tempHash["sha512Hash"].substr(0, 2), tempHash["sha512Hash"]);
    let parsedPath = pathParse(newTempPath);
    
    await Fs.promises.mkdir(parsedPath["path"], {recursive: true});
    await Fs.promises.rename(tempHash["tempFileName"], parsedPath["filePath"]);

    try {
        await Fs.promises.mkdir(parsedPath.path, {recursive: true});
    } catch(e) {
        printLog(`impossible writeStore cannot create ${parsedPath.path}`);
        throw e;
    }

    try {
        await Fs.promises.rename(tempHash["tempFileName"], parsedPath["filePath"]);
    } catch(e) {
        printLog(`impossible writeStore move ${tempHash["tempFileName"]} to ${parsedPath["filePath"]}`);
        throw e;
    }

    printLog(`store data moved to ${tempHash["tempFileName"]} to ${parsedPath["filePath"]}`);
}

// escreve um arquivo temporario para o store
let readStore = async function(tempHash, writeStream) {
    let newTempPath = pathJoin(basePath, "store", tempHash["sha512Hash"].substr(0, 2), tempHash["sha512Hash"]);
    let parsedPath = pathParse(newTempPath);
    
    let storedFile = await Fs.createReadStream(parsedPath["filePath"]);

    storedFile.pipe(writeStream);

    return new Promise((resolve, reject) => {
        storedFile.on("end", (e) => {
            storedFile.close();
            resolve(e);
        });

        storedFile.on("read", (e) => {
            storedFile.close();
            reject(e);
        });
    });
}

// copia o arquivo para um nome temporario, gera md5/sha512, gera data
let tempFile = async function(fileStream) {
    let tempFileName = pathTemp();

    let fp = await Fs.createWriteStream(tempFileName);
    let md5 = Crypto.createHash("md5");
    let sha512 = Crypto.createHash("sha512");

    fileStream.pipe(fp);
    fileStream.pipe(md5);
    fileStream.pipe(sha512);

    return new Promise((accept, reject) => {
        fileStream.on("end", () => {
            let md5Hash = md5.read().toString("hex");
            let sha512Hash = sha512.read().toString("hex");

            fp.close();

            accept({tempFileName, md5Hash, sha512Hash, dateTime: Date.now()});
        });

        fileStream.on("error", (e) => {
            reject(e);
        });
    });
};

// armazena o arquivo temporariamente e atualiza o meta
let writeFile = async function(filePath, fileStream) {
    printLog(`temporary store to ${filePath}`);
    let tempHash = await tempFile(fileStream);
    await updateInfo(filePath, tempHash);
};

// armazena o arquivo temporariamente e atualiza o meta
let readFile = async function(filePath, fileStream) {
    let fileInfo = await readInfo(filePath);
    
    if ( fileInfo["default"].length <= 0 ) {
        return;
    }

    fileInfo = fileInfo["default"].pop();

    await readStore(fileInfo, fileStream);
};

// entry point de armazenamento
app.post("/store/*", async (req, res) => {
    await writeFile(req.path.replace("/store", ""), req);
    res.end();
});

// entry point de leitura
app.get("/store/*", async (req, res) => {
    await readFile(req.path.replace("/store", ""), res);
    res.end();
});

app.listen(3000, () => {console.log("iniciado")});
