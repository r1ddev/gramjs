import bigInt from "big-integer";
type Entity = Record<string, any>;
export declare class EntityCache {
    private cacheMap;
    private _cacheFile;
    private _writer;
    private _preparedEntities;
    constructor(cacheDir?: string);
    initCache(cacheDir: string): Promise<void>;
    add(entities: any): void;
    get(item: bigInt.BigInteger | string | undefined): any;
    saveEntity(key: string, entity: Entity): void;
    private restore;
    private load;
    private makeCache;
    private prepareEntity;
    private parseCacheEntity;
}
export {};
