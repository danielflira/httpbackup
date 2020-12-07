const Fs = require("fs");
const Stream = require("stream");

const test = require("ava");

const BaseBackend = require("../src/backends/base");
const FileSystemBackend = require("../src/backends/filesystem");

test("Base backend storeData shoud throw NotImplemented", async (t) => {
    let backend = new BaseBackend();

    try {
        await backend.storeData();
        t.fail();
    } catch(e) {
        t.pass();
    }
});

test("Base backend retriveData shoud throw NotImplemented", async (t) => {
    let backend = new BaseBackend();

    try {
        await backend.retriveData();
        t.fail();
    } catch(e) {
        t.pass();
    }
});

test("Base backend retriveMeta shoud throw NotImplemented", async (t) => {
    let backend = new BaseBackend();

    try {
        await backend.retriveMeta();
        t.fail();
    } catch(e) {
        t.pass();
    }
});

test("Base backend storeMeta shoud throw NotImplemented", async (t) => {
    let backend = new BaseBackend();

    try {
        await backend.storeMeta();
        t.fail();
    } catch(e) {
        t.pass();
    }
});

test("Transform virtualpath to datarealpath of FileSystemBackend", async (t) => {
    let backend = new FileSystemBackend();

    if ( backend.dataPath("abcdef0123456789") !== "store/data/ab/abcdef0123456789" ) {
        t.fail();
    }

    t.pass();
});

test("Transform virtualpath to metarealpath of FileSystemBackend", async (t) => {
    let backend = new FileSystemBackend();

    if ( backend.metaPath("/primeiro//caminho/") !== "store/meta/primeiro/caminho" ) {
        t.fail();
    }

    if ( backend.metaPath("\\primeiro\\caminho") !== "store/meta/primeiro/caminho" ) {
        t.fail();
    }

    if ( backend.metaPath("\\segundo/caminho\\de//teste") !== "store/meta/segundo/caminho/de/teste" ) {
        t.fail();
    }

    t.pass();
});

test("Random path generation of FileSystemBackend", async (t) => {
    let backend = new FileSystemBackend();

    let path1 = backend.parsePath(backend.tempPath());
    let path2 = backend.parsePath(backend.tempPath());
    let path3 = backend.parsePath(backend.tempPath("teste"));

    if ( path1.dirName !== "store/temp" ) {
        t.fail();
    }

    if ( path2.dirName !== ("store/temp") ) {
        t.fail();
    }

    if ( path1.baseName === path2.baseName ) {
        t.fail();
    }

    if ( path3.baseName !== "teste" ) {
        t.fail();
    }

    t.pass();
});

test("Parse paths of FileSystemBackend", async (t) => {
    let backend = new FileSystemBackend();

    let {filePath, dirName, baseName} = backend.parsePath("store/data/primeiro/path/para/arquivo1");

    if ( filePath !== "store/data/primeiro/path/para/arquivo1" ) {
        t.fail();
    }

    if ( dirName !== "store/data/primeiro/path/para" ) {
        t.fail();
    }

    if ( baseName !== "arquivo1" ) {
        t.fail()
    }

    t.pass();
});

test("Make recursive directories of FileSystemBackend", async (t) => {
    let backend = new FileSystemBackend();

    let filePath = backend.tempPath();
    await backend.makeDirs(filePath);

    let stats = await Fs.promises.stat(filePath)

    if ( ! stats.isDirectory() ) {
        t.fail()
    }

    // cleanup
    await Fs.promises.rmdir(filePath);

    t.pass();
});

test("Create tempfile of FileSystemBackend", async (t) => {
    let backend = new FileSystemBackend();

    let {tempID, md5, sha512} = await backend.storeTemp(Stream.Readable.from("conteudo do arquivo\n"));

    if ( sha512 !== "adc91ac132e584d3ea4fd7b9d0bc393af6fa5a69df8a854318a4739405dd86204e1bdc9235810cce7fe2822c34fe515d8c4313028f287f2684d74f9a6fa566c7" ) {
        t.fail();
    }

    if ( md5 !== "159033dce20972eb518295770fd34f60" ) {
        t.fail();
    }

    await backend.removeTemp(tempID);

    t.pass();
});

test("retrive meta of FileSystemBackend", async (t) => {
    let backend = new FileSystemBackend();
    let filePath = "/caminho/do/arquivo1";

    // cleanup if already exists
    try {
        await Fs.promises.unlink(backend.metaPath(filePath));
    } catch(e) {}

    if ( (await backend.retriveMeta(filePath)).length !== 0 ) {
        t.fail();
    }

    await backend.storeMeta(filePath, {campo1: "valor1"});

    if ( (await backend.retriveMeta(filePath)).campo1 !== "valor1" ) {
        t.fail();
    }

    t.pass();
});

test("store meta of FileSystemBackend", async (t) => {
    let backend = new FileSystemBackend();
    let filePath = "/caminho/do/arquivo2";

    // cleanup if already exists
    try {
        await Fs.promises.unlink(backend.metaPath(filePath));
    } catch(e) {}

    await backend.storeMeta(filePath, {conteudo: "funciona!"});

    if ( (await backend.retriveMeta(filePath)).conteudo !== "funciona!" ) {
        t.fail();
    }

    t.pass()
});

// um arquivo novo deve gerar um newFile == true
// um arquivo existente deve gerar um newFile == false
// atualização de uma entrada com o arquivo atual deve gerar um updateMeta == false
// atualização de uma entrada com um arquivo diferente do atual deve gerar um updateMeta == true
test("store data of FileSystemBackend", async (t) => {
    let backend = new FileSystemBackend();
    let filePath = "/caminho/do/arquivo3";

    let result = await backend.storeData(filePath, Stream.Readable.from("conteudo 1 do arquivo\n"));

    if ( result.newFile !== true && result.updateMeta !== true ) {
        t.fail();
    }

    result = await backend.storeData(filePath, Stream.Readable.from("conteudo 1 do arquivo\n"));

    if ( result.newFile !== false && result.updateMeta !== false ) {
        t.fail();
    }

    result = await backend.storeData(filePath, Stream.Readable.from("conteudo 2 do arquivo\n"));

    if ( result.newFile !== true && result.updateMeta !== true ) {
        t.fail();
    }

    result = await backend.storeData(filePath, Stream.Readable.from("conteudo 1 do arquivo\n"));

    if ( result.newFile !== false && result.updateMeta !== true ) {
        t.fail();
    }

    t.pass();
});

test("retrive data of FileSystemBackend", async (t) => {
    let backend = new FileSystemBackend();
    let filePath = "/caminho/do/arquivo4";

    let result = await backend.storeData(filePath, Stream.Readable.from("conteudo 4 do arquivo 4\n"));

    if ( result.newFile !== true && result.updateMeta !== true ) {
        t.fail();
    }

    const validateStream = new Stream.Writable({
        write(chunk, encoding, callback) {
            if ( ! this.data ) {
                this.data = "" + chunk;
            } else {
                self.data += chunk;
            }

            callback();
        }
    });

    await backend.retriveData(filePath, validateStream);

    if ( validateStream.data !== "conteudo 4 do arquivo 4\n" ) {
        t.fail("o conteúdo do arquivo não bate");
    }

    t.pass();
});
