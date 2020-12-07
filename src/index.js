const Express = require("express");
const Backend = require("./backends/filesystem");

var backend = new Backend();
let app = Express();

// entry point de armazenamento
app.post("/store/*", async (req, res) => {
    await backend.storeData(req.path.replace("/store", ""), req);
    res.end();
});

// entry point de leitura
app.get("/store/*", async (req, res) => {
    await backend.retriveData(req.path.replace("/store", ""), req);
    res.end();
});

// entry point de leitura
app.get("/meta/*", async (req, res) => {
    let info = await backend.retriveMeta(req.path.replace("/meta", ""));
    res.json(info);
});

app.listen(3000, () => {console.log("iniciado")});
