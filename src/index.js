#!/usr/bin/env node

const Express = require("express");
const Backend = require("./backends/filesystem");

var backend = new Backend();
let app = Express();

// entry point de armazenamento
app.post("/store/*", async (req, res) => {
    let filePath = req.path.replace("/store", "");
    let result = null;

    try {
        result = await backend.storeData(filePath, req);
    } catch(e) {
        console.trace(e);
        res.status(500).json(e);
        return;
    }

    if ( result.updateMeta ) {
        console.log(`${filePath} updated with hash ${result.sha512}`);
    } else if ( ! result.updateMeta ) {
        console.log(`${filePath} does not changed hash ${result.sha512}`);
    }

    res.json(result);
});

// entry point de leitura
app.get("/store/*", async (req, res) => {
    let filePath = req.path.replace("/store", "");
    let result = null;

    try {
        result = await backend.retriveData(filePath, res);
    } catch(e) {
        console.trace(e);
        res.status(500).json(e);
        return;
    }

    if ( result.found === false ) {
        console.log(`${filePath} does not exists`);
        res.status(404);
    } else {
        console.log(`${filePath} retriving ${result.sha512}`);    
    }

    res.end();
});

// entry point de leitura
app.get("/meta/*", async (req, res) => {
    let filePath = req.path.replace("/meta", "");
    let info = null;

    try {
        info = await backend.retriveMeta(filePath);
    } catch(e) {
        console.trace(e);
        res.status(500).json(e);
        return;
    }

    res.json(info);
});

// check if hash is already stored
app.get("/hash/*", async (req, res) => {
    let fileHash = req.path.replace("/hash", "");
    let info = null;

    try {
        info = {exists: (await backend.existsHash(fileHash))};
    } catch(e) {
        console.trace(e);
        res.status(500).json(e);
        return;
    }

    res.json(info);
});

app.listen(3000, () => {console.log("listen on :3000")});
