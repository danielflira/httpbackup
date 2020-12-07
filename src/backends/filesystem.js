const Fs = require("fs");
const Path = require("path");
const Crypto = require("crypto");

const Backend = require("./base");

module.exports = class FileSystemBackend extends Backend {
    fixPathString(virtualFilePath) {
        return virtualFilePath
            .replace(/\\/g, "/")
            .split("/")
            .filter((e) => {return e != null && e !== ""})
    }

    dataPath(virtualFilePath) {
        return Path.join("store", "data", virtualFilePath.substr(0, 2), virtualFilePath);
    }

    metaPath(virtualFilePath) {
        return Path.join("store", "meta", 
            ...this.fixPathString(virtualFilePath));
    }

    tempPath(tempID) {
        if ( typeof tempID === "string" && tempID != "" ) {
            return Path.join("store", "temp", tempID);
        }
        
        return Path.join("store", "temp",
            Crypto.randomBytes(16).toString("hex"));
    }

    parsePath(filePath) {
        return {filePath, dirName: Path.dirname(filePath), baseName: Path.basename(filePath)};
    }

    async makeDirs(dirPath) {
        await Fs.promises.mkdir(dirPath, {recursive: true});
    }

    async storeTemp(readStream) {
        let filePath = this.tempPath();
        let {dirName, baseName} = this.parsePath(filePath);

        await this.makeDirs(dirName);

        let temp = await Fs.createWriteStream(filePath);
        let md5Temp = Crypto.createHash("md5");
        let sha512Temp = Crypto.createHash("sha512");
    
        readStream.pipe(temp);
        readStream.pipe(md5Temp);
        readStream.pipe(sha512Temp);
    
        return new Promise((accept, reject) => {
            readStream.on("end", () => {
                let md5 = md5Temp.read().toString("hex");
                let sha512 = sha512Temp.read().toString("hex");
                temp.close();
                accept({tempID: baseName, md5, sha512, dateTime: Date.now()});
            });
    
            readStream.on("error", (e) => {
                reject(e);
            });
        });
    }

    async removeTemp(tempID) {
        let tempPath = this.tempPath(tempID);
        await Fs.promises.unlink(tempPath);
    }

    async storeData(virtualFilePath, readStream) {
        // armazena o arquivo e obtem informacoes (hashes)
        let {tempID, sha512, md5} = await this.storeTemp(readStream);

        let tempPath = this.tempPath(tempID);
        let dataPath = this.dataPath(sha512);

        let result = {};

        // data ja existe com esse hash?
        try {
            let fp = await Fs.promises.open(dataPath, "r");
            fp.close();
            await this.removeTemp(tempID);

            result.newFile = false;
        
        // data nao existe com esse hash?
        } catch (e) {
            await this.makeDirs(this.parsePath(dataPath).dirName);
            await Fs.promises.rename(tempPath, dataPath);
            
            result.newFile = true;
        }

        // independente se arquivo existe ou não, atualiza o metadado
        let meta = await this.retriveMeta(virtualFilePath);
        result.updateMeta = false;
        
        // first time that file is received
        if ( meta.length === 0 ) {
            meta.push({md5, sha512});
            await this.storeMeta(virtualFilePath, meta);
            result.updateMeta = true;
        
        // hash of file changed since last update
        } else if ( meta[meta.length-1].sha512 !== sha512 && meta[meta.length-1].md5 !== md5 ) {
            meta.push({md5, sha512});
            await this.storeMeta(virtualFilePath, meta);
            result.updateMeta = true;
        }

        return result;
    }

    async retriveData(virtualFilePath, writeStream) {
        let meta = await this.retriveMeta(virtualFilePath);
        let dataPath = this.dataPath(meta[meta.length - 1].sha512);

        let file = Fs.createReadStream(dataPath);
        file.pipe(writeStream);

        return new Promise((accept, reject) => {
            file.on("end", (e) => {
                file.close();
                accept(e);
            });

            file.on("error", (e) => {
                file.close();
                reject(e);
            });
        });
    }

    async storeMeta(virtualFilePath, meta) {
        virtualFilePath = this.metaPath(virtualFilePath);

        let {dirName} = this.parsePath(virtualFilePath);

        await this.makeDirs(dirName);
        await Fs.promises.writeFile(virtualFilePath, JSON.stringify(meta));
    }

    async retriveMeta(virtualFilePath) {
        let filePath = this.metaPath(virtualFilePath);

        try {
            let content = await Fs.promises.readFile(filePath);
            return JSON.parse(content);
        } catch(e) {
            return [];
        }
    }
}
