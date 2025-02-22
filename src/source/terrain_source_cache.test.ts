import TerrainSourceCache from './terrain_source_cache';
import Style from '../style/style';
import {RequestManager} from '../util/request_manager';
import Dispatcher from '../util/dispatcher';
import {fakeServer, FakeServer} from 'nise';
import Transform from '../geo/transform';
import {Evented} from '../util/evented';
import Painter from '../render/painter';
import Context from '../gl/context';
import gl from 'gl';
import RasterDEMTileSource from './raster_dem_tile_source';

const context = new Context(gl(10, 10));
const transform = new Transform();

class StubMap extends Evented {
    transform: Transform;
    painter: Painter;
    _requestManager: RequestManager;

    constructor() {
        super();
        this.transform = transform;
        this._requestManager = {
            transformRequest: (url) => {
                return {url};
            }
        } as any as RequestManager;
    }
}

function createSource(options, transformCallback?) {
    const source = new RasterDEMTileSource('id', options, {send() {}} as any as Dispatcher, null);
    source.onAdd({
        transform,
        _getMapId: () => 1,
        _requestManager: new RequestManager(transformCallback),
        getPixelRatio() { return 1; }
    } as any);

    source.on('error', (e) => {
        throw e.error;
    });

    return source;
}

describe('TerrainSourceCache', () => {
    let server: FakeServer;
    let style: Style;
    let tsc: TerrainSourceCache;

    beforeAll(done => {
        global.fetch = null;
        server = fakeServer.create();
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.pngraw'],
            bounds: [-47, -7, -45, -5]
        }));
        const map = new StubMap();
        style = new Style(map as any);
        style.map.painter = {style, context} as any;
        style.on('style.load', () => {
            const source = createSource({url: '/source.json'});
            server.respond();
            style.addSource('terrain', source as any);
            tsc = new TerrainSourceCache(style.sourceCaches.terrain);
            done();
        });
        style.loadJSON({
            'version': 8,
            'sources': {},
            'layers': []
        });
    });

    afterAll(() => {
        server.restore();
    });

    test('#constructor', () => {
        expect(tsc.sourceCache.usedForTerrain).toBeTruthy();
        expect(tsc.sourceCache.tileSize).toBe(tsc.tileSize * 2 ** tsc.deltaZoom);
    });

});
