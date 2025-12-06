// Which updates have the following fields?

import fs from "fs";
import path from "path";
import { getInputPeer, getPeerId, parseEntity } from "./Utils";
import { isArrayLike, returnBigInt } from "./Helpers";
import { Api } from "./tl";
import bigInt from "big-integer";
import { performance } from "perf_hooks";
import { Entity, EntityLike } from "./define";

const cacheFileName = "cache.json";

type EntitySimplified = Record<string, any>;
export type PreparedEntity = Record<string, string | number>;
export type CacheEntityOnSave = (peerId: string, peer: PreparedEntity) => void;
export type CacheEntityOnGet = (
    peerId: string
) => PreparedEntity | Promise<PreparedEntity>;
type CacheType = "map" | "file" | "callback";

export class EntityCache {
    private cacheMap: Map<string, any>;
    private _cacheFile: string | undefined;
    private _preparedEntities: Record<string, PreparedEntity> = {};
    private onSave: CacheEntityOnSave | undefined;
    private onGet: CacheEntityOnGet | undefined;

    private _cacheType: CacheType = "map";

    constructor({
        dir,
        onSave,
        onGet,
    }:
        | {
              dir?: string;
              onSave?: CacheEntityOnSave;
              onGet?: CacheEntityOnGet;
          }
        | undefined = {}) {
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

    initCache(cacheDir: string) {
        console.log('call this._cacheType', this._cacheType);
        
        if (this._cacheType === "file") {
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }

            this._cacheFile = path.join(cacheDir, cacheFileName);

            console.log('this._cacheFile', this._cacheFile);
            

            if (!fs.existsSync(this._cacheFile)) {
                fs.writeFileSync(this._cacheFile, "{}", "utf-8");
            }

            this.restore();   
        }
    }

    add(entities: any) {
        const temp = [];
        if (!isArrayLike(entities)) {
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
            } else {
                return;
            }
        }
        for (const entity of entities) {
            try {
                const pid = getPeerId(entity);
                if (!this.cacheMap.has(pid.toString())) {
                    const peer = getInputPeer(entity);

                    // if we have a onsave call it
                    if (this.onSave) {
                        this.onSave?.(pid.toString(), this.prepareEntity(peer));
                    }

                    // if cashe type is not callback (onget and onsave are provided)
                    // save to map and file if necessary
                    if (this._cacheType !== "callback") {
                        this.cacheMap.set(pid.toString(), peer);
                        this.saveEntity(pid.toString(), peer);
                    }
                }
            } catch (e) {}
        }
    }

    async get(item: bigInt.BigInteger | string | undefined) {
        if (item == undefined) {
            throw new Error("No cached entity for the given key");
        }

        item = returnBigInt(item);
        if (item.lesser(bigInt.zero)) {
            let res;
            try {
                if (this.onGet) {
                    try {
                        const itemStr = item.toString();
                        const rawItem = await this.onGet(itemStr);
                        res = this.parseCacheEntity(itemStr, rawItem);
                    } catch (error) {
                        console.warn(
                            "[entityCache] get onGet lesser zero error",
                            error
                        );

                        res = this.cacheMap.get(getPeerId(item).toString());
                    }
                } else {
                    res = this.cacheMap.get(getPeerId(item).toString());
                }

                if (res) {
                    return res;
                }
            } catch (e) {
                throw new Error("Invalid key will not have entity");
            }
        }
        for (const cls of [Api.PeerUser, Api.PeerChat, Api.PeerChannel]) {
            if (this.onGet) {
                try {
                    const itemStr = item.toString();
                    const rawItem = await this.onGet(itemStr);
                    const entity = this.parseCacheEntity(itemStr, rawItem);

                    if (entity) {
                        return entity;
                    }
                } catch (error) {
                    console.warn("[entityCache] get onGet error", error);
                }
            }

            const result = this.cacheMap.get(
                getPeerId(
                    new cls({
                        userId: item,
                        chatId: item,
                        channelId: item,
                    })
                ).toString()
            );

            if (result) {
                return result;
            }
        }
        throw new Error("No cached entity for the given key");
    }

    saveEntity(key: string, entity: EntitySimplified) {
        if (!this._cacheFile) return;

        const startTime = performance.now();

        this._preparedEntities[key] = this.prepareEntity(entity);

        const stringCache = JSON.stringify(this._preparedEntities);

        fs.writeFileSync(this._cacheFile, stringCache, "utf-8");

        const endTime = performance.now();
        console.log(`Cache saved in ${endTime - startTime} ms`);
    }

    private restore() {
        // if (!this._writer) return;
        if (!this._cacheFile) return;

        // const startTime = performance.now();

        const stringCache = fs.readFileSync(this._cacheFile, "utf-8");

        this.load(stringCache.length === 0 ? "{}" : stringCache);

        // const endTime = performance.now();
        // console.log(`Cache restored in ${endTime - startTime} ms`);
    }

    private load(jsonCache: string) {
        const mapCache = new Map();

        const cache = JSON.parse(jsonCache);
        if (typeof cache == "object") {
            for (const entityId in cache) {
                mapCache.set(
                    entityId,
                    this.parseCacheEntity(entityId, cache[entityId])
                );
                this._preparedEntities[entityId] = cache[entityId];
            }
        }

        this.cacheMap = mapCache;
    }

    private prepareEntity(entity: EntitySimplified): PreparedEntity {
        if (typeof entity == "object") {
            const entityPrepared: PreparedEntity = {};

            for (const key in entity) {
                if (key === "originalArgs") continue;

                switch (typeof entity[key]) {
                    case "object":
                        if (bigInt.isInstance(entity[key])) {
                            entityPrepared[key] = `bigInt:${entity[
                                key
                            ].toString()}`;
                            break;
                        }

                        entityPrepared[key] = JSON.stringify(
                            entityPrepared[key]
                        );
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

    private parseCacheEntity(
        entityId: string,
        entity: PreparedEntity
    ) {
        const simplifiedEntity: EntitySimplified = {};

        for (const key in entity) {
            const value = entity[key];

            switch (typeof value) {
                case "string":
                    if (value.startsWith("bigInt:")) {
                        simplifiedEntity[key] = bigInt(
                            value.replace("bigInt:", "")
                        );
                        break;
                    }

                    simplifiedEntity[key] = value;
                    break;
                default:
                    simplifiedEntity[key] = value;
                    break;
            }
        }

        const parsedEntity = parseEntity(
            returnBigInt(entityId),
            simplifiedEntity
        );

        return parsedEntity;
    }
}

