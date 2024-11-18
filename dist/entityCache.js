"use strict";
// Which updates have the following fields?
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const getWriter = async (outputFile) => {
    return new (await Promise.resolve().then(() => __importStar(require('steno')))).Writer(outputFile);
};
class EntityCache {
    constructor(cacheDir) {
        this._preparedEntities = {};
        this.cacheMap = new Map();
        if (cacheDir) {
            this.initCache(cacheDir);
        }
    }
    async initCache(cacheDir) {
        if (!fs_1.default.existsSync(cacheDir)) {
            fs_1.default.mkdirSync(cacheDir, { recursive: true });
        }
        this._cacheFile = path_1.default.join(cacheDir, cacheFileName);
        this._writer = await getWriter(this._cacheFile);
        this.restore();
    }
    add(entities) {
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
                    this.cacheMap.set(pid.toString(), peer);
                    this.saveEntity(pid.toString(), peer);
                }
            }
            catch (e) { }
        }
    }
    get(item) {
        if (item == undefined) {
            throw new Error("No cached entity for the given key");
        }
        item = (0, Helpers_1.returnBigInt)(item);
        if (item.lesser(big_integer_1.default.zero)) {
            let res;
            try {
                res = this.cacheMap.get((0, Utils_1.getPeerId)(item).toString());
                if (res) {
                    return res;
                }
            }
            catch (e) {
                throw new Error("Invalid key will not have entity");
            }
        }
        for (const cls of [tl_1.Api.PeerUser, tl_1.Api.PeerChat, tl_1.Api.PeerChannel]) {
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
        if (!this._writer)
            return;
        const startTime = perf_hooks_1.performance.now();
        this._preparedEntities[key] = this.prepareEntity(entity);
        const stringCache = JSON.stringify(this._preparedEntities);
        this._writer.write(stringCache);
        const endTime = perf_hooks_1.performance.now();
        // console.log(`Cache saved in ${endTime - startTime} ms`);
    }
    restore() {
        if (!this._writer)
            return;
        if (!this._cacheFile)
            return;
        const startTime = perf_hooks_1.performance.now();
        const stringCache = fs_1.default.readFileSync(this._cacheFile, "utf-8");
        this.load(stringCache.length === 0 ? "{}" : stringCache);
        const endTime = perf_hooks_1.performance.now();
        // console.log(`Cache restored in ${endTime - startTime} ms`);
    }
    load(jsonCache) {
        const mapCache = new Map();
        const cache = JSON.parse(jsonCache);
        if (typeof cache == "object") {
            for (const entityId in cache) {
                mapCache.set(entityId, this.parseCacheEntity(cache[entityId]));
            }
        }
        this.cacheMap = mapCache;
    }
    makeCache() {
        const jsonCache = {};
        for (const [entityId, entity] of this.cacheMap.entries()) {
            jsonCache[entityId] = this.prepareEntity(entity);
        }
        return JSON.stringify(jsonCache);
    }
    prepareEntity(entity) {
        if (typeof entity == "object") {
            const entityPrepared = {};
            for (const key in entity) {
                if (key === "originalArgs")
                    continue;
                switch (typeof entity[key]) {
                    case 'object':
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
    parseCacheEntity(entity) {
        const parsedEntity = {};
        if (typeof entity == "object") {
            for (const key in entity) {
                const value = entity[key];
                switch (typeof value) {
                    case 'string':
                        if (value.startsWith("bigInt:")) {
                            parsedEntity[key] = (0, big_integer_1.default)(value.replace("bigInt:", ""));
                            break;
                        }
                        parsedEntity[key] = value;
                        break;
                    default:
                        parsedEntity[key] = value;
                        break;
                }
            }
            return parsedEntity;
        }
        return entity;
    }
}
exports.EntityCache = EntityCache;
