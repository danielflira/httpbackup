#!/usr/bin/env node

const Express = require("express");
const Backend = require("./backends/filesystem");

var backend = new Backend();
let app = Express();

// entry point de armazenamento
app.post("/store/*", async (req, res) => {
    let filePath = req.path.replace("/store", "");
    let result = await backend.storeData(filePath, req);

    if ( result.updateMeta ) {
        console.log(`${filePath} updated with hash ${result.sha512}`);
    } else if ( ! result.updateMeta ) {
        console.log(`${filePath} does not changed hash ${result.sha512}`);
    }

    res.json(result);

    res.end("\n");
});

// entry point de leitura
app.get("/store/*", async (req, res) => {
    let filePath = req.path.replace("/store", "");

    let result = await backend.retriveData(filePath, res);

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
    let info = await backend.retriveMeta(filePath);
    res.json(info);
});

app.listen(3000, () => {console.log("listen on :3000")});
