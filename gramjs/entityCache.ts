// Which updates have the following fields?

import fs from 'fs';
import path from 'path';
import { getInputPeer, getPeerId } from "./Utils";
import { isArrayLike, returnBigInt } from "./Helpers";
import { Api } from "./tl";
import bigInt from "big-integer";
import { performance } from 'perf_hooks';
import { Writer } from 'steno';

const cacheFileName = "cache.json";

type Entity = Record<string, any>
type PreparedEntity = Record<string, string | number>

export class EntityCache {
    private cacheMap: Map<string, any>;
    private _cacheFile: string | undefined;
    private _writer: Writer | undefined;
    private _preparedEntities: Record<string, PreparedEntity> = {};

    constructor(cacheDir?: string) {
        this.cacheMap = new Map();
        
        if (cacheDir) {
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }

            this._cacheFile = path.join(cacheDir, cacheFileName);
            this._writer = new Writer(this._cacheFile);
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
                    this.cacheMap.set(pid.toString(), peer);
                    this.saveEntity(pid.toString(), peer);
                }
            } catch (e) {}
        }
    }

    get(item: bigInt.BigInteger | string | undefined) {
        if (item == undefined) {
            throw new Error("No cached entity for the given key");
        }
        item = returnBigInt(item);
        if (item.lesser(bigInt.zero)) {
            let res;
            try {
                res = this.cacheMap.get(getPeerId(item).toString());
                if (res) {
                    return res;
                }
            } catch (e) {
                throw new Error("Invalid key will not have entity");
            }
        }
        for (const cls of [Api.PeerUser, Api.PeerChat, Api.PeerChannel]) {
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

    saveEntity(key: string, entity: Entity) {
        if (!this._writer) return;

        const startTime = performance.now();

        this._preparedEntities[key] = this.prepareEntity(entity);

        const stringCache = JSON.stringify(this._preparedEntities);

        this._writer.write(stringCache);

        const endTime = performance.now();
        // console.log(`Cache saved in ${endTime - startTime} ms`);
    }

    private restore() {
        if (!this._writer) return;
        if (!this._cacheFile) return;

        const startTime = performance.now();

        const stringCache = fs.readFileSync(this._cacheFile, "utf-8");

        this.load(stringCache.length === 0 ? "{}" : stringCache);

        const endTime = performance.now();
        // console.log(`Cache restored in ${endTime - startTime} ms`);
    }

    private load(jsonCache: string) {
        const mapCache = new Map();

        const cache = JSON.parse(jsonCache);
        if (typeof cache == "object") {
            for (const entityId in cache) {
                mapCache.set(entityId, this.parseCacheEntity(cache[entityId]));
            }
        }

        this.cacheMap = mapCache;
    }

    private makeCache() {
        const jsonCache: any = {};
        for (const [entityId, entity] of this.cacheMap.entries()) {
            jsonCache[entityId] = this.prepareEntity(entity);
        }
        return JSON.stringify(jsonCache);
    }

    private prepareEntity(entity: Entity): PreparedEntity {
        if (typeof entity == "object") {
            const entityPrepared: PreparedEntity = {};

            for (const key in entity) {
                if (key === "originalArgs") continue;

                switch (typeof entity[key]) {
                    case 'object':
                        if (bigInt.isInstance(entity[key])) {
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

    private parseCacheEntity(entity: PreparedEntity): Entity {
        const parsedEntity: any = {};

        if (typeof entity == "object") {
            for (const key in entity) {
                const value = entity[key];

                switch (typeof value) {
                    case 'string':
                        if (value.startsWith("bigInt:")) {
                            parsedEntity[key] = bigInt(value.replace("bigInt:", ""));
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
