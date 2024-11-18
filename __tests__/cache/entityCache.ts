import { Api, bigInt } from '../../gramjs';
import { EntityCache } from '../../gramjs/entityCache';

const entity = new Api.InputChannel({
    channelId: bigInt(123),
    accessHash: bigInt(456)
});

const entityCache = new EntityCache(__dirname + "/cache/asdf");
entityCache.add([entity]);
console.log("entityCache.get", entityCache.get("123"));


const entityCache2 = new EntityCache(__dirname + "/cache/asdf");
console.log("entityCache2.get", entityCache2.get("123"));
