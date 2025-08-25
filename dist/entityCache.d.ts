import bigInt from "big-integer";
type Entity = Record<string, any>;
export type PreparedEntity = Record<string, string | number>;
export declare class EntityCache {
    private cacheMap;
    private _cacheFile;
    private _preparedEntities;
    private onSave;
    private onGet;
    constructor({ dir, onSave, onGet }?: {
        dir?: string;
        onSave?: (peerId: string, peer: PreparedEntity) => void;
        onGet?: (peerId: string) => Record<string, any>;
    } | undefined);
    initCache(cacheDir: string): void;
    add(entities: any): void;
    get(item: bigInt.BigInteger | string | undefined): any;
    saveEntity(key: string, entity: Entity): void;
    private restore;
    private load;
    private prepareEntity;
    private parseCacheEntity;
}
export {};
