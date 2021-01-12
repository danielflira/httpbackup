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
        return await Fs.promises.mkdir(dirPath, {recursive: true});
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
                console.log(e);
                reject(e);
            });
        });
    }

    async unlink(path) {
        return await Fs.promises.unlink(path);
    }

    async rename(path1, path2) {
        return await Fs.promises.rename(path1, path2);
    }

    async removeTemp(tempID) {
        let tempPath = this.tempPath(tempID);
        await this.unlink(tempPath);
    }

    async storeData(virtualFilePath, readStream) {
        // armazena o arquivo e obtem informacoes (hashes)
        let {tempID, sha512, md5} = await this.storeTemp(readStream);

        let tempPath = this.tempPath(tempID);
        let dataPath = this.dataPath(sha512);

        let result = {sha512};

        if ( md5 === "d41d8cd98f00b204e9800998ecf8427e" && sha512 === "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e" ) {
            result.error = "empty file";
            await this.removeTemp(tempID);
            return result
        }

        // data ja existe com esse hash?
        try {
            let fp = await Fs.promises.open(dataPath, "r");
            fp.close();
            await this.removeTemp(tempID);

            result.newFile = false;
        
        // data nao existe com esse hash?
        } catch (e) {
            await this.makeDirs(this.parsePath(dataPath).dirName);
            await this.rename(tempPath, dataPath);
            
            result.newFile = true;
        }

        // independente se arquivo existe ou não, atualiza o metadado
        let meta = await this.retriveMeta(virtualFilePath);

        // add space to files
        if ( ! meta.data ) {
            meta.data = [];
        }

        // separate data for easy access
        let {data} = meta;

        result.updateMeta = false;
        
        // first time that file is received
        if ( data.length === 0 ) {
            data.push({md5, sha512});
            await this.storeMeta(virtualFilePath, meta);
            result.updateMeta = true;
        
        // hash of file changed since last update
        } else if ( data[data.length-1].sha512 !== sha512 && data[data.length-1].md5 !== md5 ) {
            data.push({md5, sha512});
            await this.storeMeta(virtualFilePath, meta);
            result.updateMeta = true;
        }

        return result;
    }

    async retriveData(virtualFilePath, writeStream) {
        let meta = await this.retriveMeta(virtualFilePath);

        if ( ! meta.data ) {
            return new Promise((accept, reject) => {
                accept({found: false});
            });
        }

        let lastFile = meta.data[meta.data.length - 1];
        lastFile.found = true;

        let dataPath = this.dataPath(lastFile.sha512);

        let file = Fs.createReadStream(dataPath);
        file.pipe(writeStream);

        return new Promise((accept, reject) => {
            file.on("end", (e) => {
                file.close();
                accept(lastFile);
            });

            file.on("error", (e) => {
                file.close();
                reject(e);
            });
        });
    }

    async writeFile(filePath, data) {
        return await Fs.promises.writeFile(filePath, data);
    }

    async storeMeta(virtualFilePath, meta) {
        virtualFilePath = this.metaPath(virtualFilePath);

        let {dirName} = this.parsePath(virtualFilePath);

        await this.makeDirs(dirName);
        await this.writeFile(virtualFilePath, JSON.stringify(meta));
    }

    async readFile(filePath) {
        return await Fs.promises.readFile(filePath);
    }

    async retriveMeta(virtualFilePath) {
        let filePath = this.metaPath(virtualFilePath);

        try {
            let content = await this.readFile(filePath);
            return JSON.parse(content);
        } catch(e) {
            return {};
        }
    }

    async existsHash(fileHash) {
        fileHash = fileHash.replace(/\//g, "");
        fileHash = this.dataPath(fileHash);
        let fp = null;

        try {
            fp = await Fs.promises.open(fileHash, "r");
            fp.close();
        } catch(e) {
            return false;
        }

        return true;
    }
}
