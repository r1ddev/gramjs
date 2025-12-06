"use strict";
// Which updates have the following fields?
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityCache = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const Utils_1 = require("./Utils");
const Helpers_1 = require("./Helpers");
const tl_1 = require("./tl");
const big_integer_1 = __importDefault(require("big-integer"));
const perf_hooks_1 = require("perf_hooks");
const cacheFileName = "cache.json";
class EntityCache {
    constructor({ dir, onSave, onGet, } = {}) {
        this._preparedEntities = {};
        this._cacheType = "map";
        this.cacheMap = new Map();
        console.log('conts dir', dir);
        // if both onSave and onGet are provided, cashe will be only callback
        if (onSave && onGet) {
            this._cacheType = "callback";
        }
        if (onSave) {
            this.onSave = onSave;
        }
        if (onGet) {
            this.onGet = onGet;
        }
        // if dir is provided, cashe will be only dir and map
        if (dir) {
            this._cacheType = "file";
            this.initCache(dir);
        }
        setInterval(() => {
            console.log(this.cacheMap);
        }, 3000);
    }
    initCache(cacheDir) {
        console.log('call this._cacheType', this._cacheType);
        if (this._cacheType === "file") {
            if (!fs_1.default.existsSync(cacheDir)) {
                fs_1.default.mkdirSync(cacheDir, { recursive: true });
            }
            this._cacheFile = path_1.default.join(cacheDir, cacheFileName);
            console.log('this._cacheFile', this._cacheFile);
            if (!fs_1.default.existsSync(this._cacheFile)) {
                fs_1.default.writeFileSync(this._cacheFile, "{}", "utf-8");
            }
            this.restore();
        }
    }
    add(entities) {
        var _a;
        const temp = [];
        if (!(0, Helpers_1.isArrayLike)(entities)) {
            if (entities != undefined) {
                if (typeof entities == "object") {
                    if ("chats" in entities) {
                        temp.push(...entities.chats);
                    }
                    if ("users" in entities) {
                        temp.push(...entities.users);
                    }
                    if ("user" in entities) {
                        temp.push(entities.user);
                    }
                }
            }
            if (temp.length) {
                entities = temp;
            }
            else {
                return;
            }
        }
        for (const entity of entities) {
            try {
                const pid = (0, Utils_1.getPeerId)(entity);
                if (!this.cacheMap.has(pid.toString())) {
                    const peer = (0, Utils_1.getInputPeer)(entity);
                    // if we have a onsave call it
                    if (this.onSave) {
                        (_a = this.onSave) === null || _a === void 0 ? void 0 : _a.call(this, pid.toString(), this.prepareEntity(peer));
                    }
                    // if cashe type is not callback (onget and onsave are provided)
                    // save to map and file if necessary
                    if (this._cacheType !== "callback") {
                        this.cacheMap.set(pid.toString(), peer);
                        this.saveEntity(pid.toString(), peer);
                    }
                }
            }
            catch (e) { }
        }
    }
    async get(item) {
        if (item == undefined) {
            throw new Error("No cached entity for the given key");
        }
        item = (0, Helpers_1.returnBigInt)(item);
        if (item.lesser(big_integer_1.default.zero)) {
            let res;
            try {
                if (this.onGet) {
                    try {
                        const itemStr = item.toString();
                        const rawItem = await this.onGet(itemStr);
                        res = this.parseCacheEntity(itemStr, rawItem);
                    }
                    catch (error) {
                        console.warn("[entityCache] get onGet lesser zero error", error);
                        res = this.cacheMap.get((0, Utils_1.getPeerId)(item).toString());
                    }
                }
                else {
                    res = this.cacheMap.get((0, Utils_1.getPeerId)(item).toString());
                }
                if (res) {
                    return res;
                }
            }
            catch (e) {
                throw new Error("Invalid key will not have entity");
            }
        }
        for (const cls of [tl_1.Api.PeerUser, tl_1.Api.PeerChat, tl_1.Api.PeerChannel]) {
            if (this.onGet) {
                try {
                    const itemStr = item.toString();
                    const rawItem = await this.onGet(itemStr);
                    const entity = this.parseCacheEntity(itemStr, rawItem);
                    if (entity) {
                        return entity;
                    }
                }
                catch (error) {
                    console.warn("[entityCache] get onGet error", error);
                }
            }
            const result = this.cacheMap.get((0, Utils_1.getPeerId)(new cls({
                userId: item,
                chatId: item,
                channelId: item,
            })).toString());
            if (result) {
                return result;
            }
        }
        throw new Error("No cached entity for the given key");
    }
    saveEntity(key, entity) {
        if (!this._cacheFile)
            return;
        const startTime = perf_hooks_1.performance.now();
        this._preparedEntities[key] = this.prepareEntity(entity);
        const stringCache = JSON.stringify(this._preparedEntities);
        fs_1.default.writeFileSync(this._cacheFile, stringCache, "utf-8");
        const endTime = perf_hooks_1.performance.now();
        console.log(`Cache saved in ${endTime - startTime} ms`);
    }
    restore() {
        // if (!this._writer) return;
        if (!this._cacheFile)
            return;
        // const startTime = performance.now();
        const stringCache = fs_1.default.readFileSync(this._cacheFile, "utf-8");
        this.load(stringCache.length === 0 ? "{}" : stringCache);
        // const endTime = performance.now();
        // console.log(`Cache restored in ${endTime - startTime} ms`);
    }
    load(jsonCache) {
        const mapCache = new Map();
        const cache = JSON.parse(jsonCache);
        if (typeof cache == "object") {
            for (const entityId in cache) {
                mapCache.set(entityId, this.parseCacheEntity(entityId, cache[entityId]));
                this._preparedEntities[entityId] = cache[entityId];
            }
        }
        this.cacheMap = mapCache;
    }
    prepareEntity(entity) {
        if (typeof entity == "object") {
            const entityPrepared = {};
            for (const key in entity) {
                if (key === "originalArgs")
                    continue;
                switch (typeof entity[key]) {
                    case "object":
                        if (big_integer_1.default.isInstance(entity[key])) {
                            entityPrepared[key] = `bigInt:${entity[key].toString()}`;
                            break;
                        }
                        entityPrepared[key] = JSON.stringify(entityPrepared[key]);
                        break;
                    default:
                        entityPrepared[key] = entity[key];
                        break;
                }
            }
            return entityPrepared;
        }
        return entity;
    }
    parseCacheEntity(entityId, entity) {
        const simplifiedEntity = {};
        for (const key in entity) {
            const value = entity[key];
            switch (typeof value) {
                case "string":
                    if (value.startsWith("bigInt:")) {
                        simplifiedEntity[key] = (0, big_integer_1.default)(value.replace("bigInt:", ""));
                        break;
                    }
                    simplifiedEntity[key] = value;
                    break;
                default:
                    simplifiedEntity[key] = value;
                    break;
            }
        }
        const parsedEntity = (0, Utils_1.parseEntity)((0, Helpers_1.returnBigInt)(entityId), simplifiedEntity);
        return parsedEntity;
    }
}
exports.EntityCache = EntityCache;
