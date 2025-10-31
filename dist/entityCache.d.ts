import bigInt from "big-integer";
type EntitySimplified = Record<string, any>;
export type PreparedEntity = Record<string, string | number>;
export type CacheEntityOnSave = (peerId: string, peer: PreparedEntity) => void;
export type CacheEntityOnGet = (peerId: string) => PreparedEntity | Promise<PreparedEntity>;
export declare class EntityCache {
    private cacheMap;
    private _cacheFile;
    private _preparedEntities;
    private onSave;
    private onGet;
    constructor({ dir, onSave, onGet, }?: {
        dir?: string;
        onSave?: CacheEntityOnSave;
        onGet?: CacheEntityOnGet;
    } | undefined);
    initCache(cacheDir: string): void;
    add(entities: any): void;
    get(item: bigInt.BigInteger | string | undefined): Promise<any>;
    saveEntity(key: string, entity: EntitySimplified): void;
    private restore;
    private load;
    private prepareEntity;
    private parseCacheEntity;
}
export {};
