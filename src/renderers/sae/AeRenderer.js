// AeRenderer: three.js drawn by ae3d, through sae's `gfx` host functions.
//
// On sae there is no WebGL: a page is untrusted code on an interpreter, so it
// describes the frame and native code draws it. render(scene, camera) walks
// the scene once and hands the host ONE batch a frame (gfx.submit): the
// camera, every visible mesh's world matrix and material parameters, and the
// geometry that is new or changed since the last batch. The layout is
// ae3d.batch's, version 1 (see writeBatch below and ae3d's
// src/ae3d/batch/module.ae).
//
// This first cut draws Mesh + MeshNormalMaterial (FrontSide or DoubleSide),
// indexed or not; other objects are skipped with a warning once. Groups,
// drawRange, instancing, lights, textures and the other materials are later.
//
// MIT, as three.js is. Part of the sae-port branch (PORT.md).

import { Color } from '../../math/Color.js';
import { DoubleSide, BackSide } from '../../constants.js';

const MAGIC = 0x31424541; // "AEB1"
const VERSION = 1;
const HEADER_WORDS = 40;
const DRAW_WORDS = 20;
const MATERIAL_NORMAL = 1;
const FLAG_DOUBLE_SIDE = 1;

class AeRenderer {

	constructor( parameters = {} ) {

		const { width = 640, height = 480, gfx = globalThis.gfx } = parameters;
		if ( ! gfx ) throw new Error( 'AeRenderer: no gfx host (run on sae, or pass { gfx })' );

		this.isAeRenderer = true;
		this.gfx = gfx;
		this.width = width;
		this.height = height;
		this.domElement = null;
		this.handle = gfx.scene( width, height );
		this.info = { frame: 0, meshes: 0, draws: 0, bytes: 0, sent: 0 };
		this._clear = new Color( 0x000000 );
		this._clearAlpha = 1;
		this._sent = new Map(); // geometry id -> the versions sent
		this._freed = [];
		this._warned = new Set();
		this._loop = null;
		this._onDispose = ( event ) => this._geometryGone( event.target );

	}

	setSize( width, height ) {

		// The scene's size is fixed when it is made; a resize is a new scene.
		if ( width === this.width && height === this.height ) return;
		this.gfx.free( this.handle );
		this.width = width;
		this.height = height;
		this.handle = this.gfx.scene( width, height );
		this._sent.clear();
		this._freed.length = 0;

	}

	setPixelRatio() {}

	setClearColor( color, alpha = 1 ) {

		this._clear.set( color );
		this._clearAlpha = alpha;

	}

	// The page's frame clock calls fn(time) each frame, as WebGLRenderer's
	// does through the browser's requestAnimationFrame.
	setAnimationLoop( fn ) {

		this._loop = fn;
		if ( fn === null ) return;
		const raf = globalThis.requestAnimationFrame;
		const tick = ( time ) => {

			if ( this._loop !== fn ) return;
			fn( time );
			raf( tick );

		};

		raf( tick );

	}

	dispose() {

		this._loop = null;
		this.gfx.free( this.handle );
		this.handle = 0;

	}

	render( scene, camera ) {

		if ( scene.matrixWorldAutoUpdate === true ) scene.updateMatrixWorld();
		if ( camera.parent === null && camera.matrixWorldAutoUpdate === true ) camera.updateMatrixWorld();

		const meshes = [];
		const draws = [];
		scene.traverseVisible( ( object ) => {

			if ( ! object.isMesh ) return;
			const material = object.material;
			if ( Array.isArray( material ) || ! material.isMeshNormalMaterial || material.side === BackSide || object.isInstancedMesh || object.isSkinnedMesh ) {

				this._warn( object.type + ' with ' + ( Array.isArray( material ) ? 'several materials' : material.type ) );
				return;

			}

			const geometry = object.geometry;
			const position = geometry.attributes.position;
			if ( position === undefined ) return;
			const versions = this._versions( geometry );
			const sent = this._sent.get( geometry.id );
			if ( sent === undefined || sent !== versions ) {

				if ( sent === undefined ) geometry.addEventListener( 'dispose', this._onDispose );
				const gone = this._freed.indexOf( geometry.id );
				if ( gone >= 0 ) this._freed.splice( gone, 1 ); // disposed and drawn again: sent anew
				this._sent.set( geometry.id, versions );
				if ( ! meshes.includes( geometry ) ) meshes.push( geometry );

			}

			draws.push( object );

		} );

		const batch = this._write( camera, meshes, draws );
		this.gfx.submit( this.handle, new Uint8Array( batch ) );
		this.info.frame ++;
		this.info.meshes = this._sent.size;
		this.info.draws = draws.length;
		this.info.bytes = batch.byteLength;
		this.info.sent = meshes.length;
		this._freed.length = 0;
		return batch;

	}

	_versions( geometry ) {

		const a = geometry.attributes;
		const index = geometry.index;
		return a.position.version + ':' + ( a.normal ? a.normal.version : - 1 ) + ':' + ( a.uv ? a.uv.version : - 1 ) + ':' + ( index ? index.version : - 1 );

	}

	_geometryGone( geometry ) {

		geometry.removeEventListener( 'dispose', this._onDispose );
		if ( this._sent.delete( geometry.id ) ) this._freed.push( geometry.id );

	}

	_warn( what ) {

		if ( this._warned.has( what ) ) return;
		this._warned.add( what );
		// sae has print and no console.
		const say = globalThis.console ? globalThis.console.warn : globalThis.print;
		if ( say ) say( 'AeRenderer: ' + what + ' is not drawn yet' );

	}

	// One batch, ae3d.batch's layout version 1, all 32-bit little-endian words.
	_write( camera, meshes, draws ) {

		let words = HEADER_WORDS + 1;
		for ( const g of meshes ) {

			const v = g.attributes.position.count;
			words += 3 + v * 8 + ( g.index ? g.index.count : 0 );

		}

		words += 1 + this._freed.length + 1 + draws.length * DRAW_WORDS;
		const buffer = new ArrayBuffer( words * 4 );
		const u = new Uint32Array( buffer );
		const f = new Float32Array( buffer );

		u[ 0 ] = MAGIC; u[ 1 ] = VERSION; u[ 2 ] = words; u[ 3 ] = this.info.frame + 1;
		f.set( camera.matrixWorldInverse.elements, 4 );
		f.set( camera.projectionMatrix.elements, 20 );
		f[ 36 ] = this._clear.r; f[ 37 ] = this._clear.g; f[ 38 ] = this._clear.b; f[ 39 ] = this._clearAlpha;

		let at = HEADER_WORDS;
		u[ at ++ ] = meshes.length;
		for ( const g of meshes ) {

			const position = g.attributes.position;
			const normal = g.attributes.normal;
			const uv = g.attributes.uv;
			const index = g.index;
			const v = position.count;
			u[ at ++ ] = g.id + 1; u[ at ++ ] = v; u[ at ++ ] = index ? index.count : 0;
			at = copy( f, at, position, v, 3 );
			at = copy( f, at, normal, v, 3 );
			at = copy( f, at, uv, v, 2 );
			if ( index ) {

				if ( index.isInterleavedBufferAttribute ) {

					for ( let i = 0; i < index.count; i ++ ) u[ at + i ] = index.getX( i );

				} else {

					u.set( index.array, at );

				}

				at += index.count;

			}

		}

		u[ at ++ ] = this._freed.length;
		for ( const id of this._freed ) u[ at ++ ] = id + 1;

		u[ at ++ ] = draws.length;
		for ( const object of draws ) {

			const material = object.material;
			u[ at ] = object.geometry.id + 1; // ae3d's ids start at 1
			u[ at + 1 ] = MATERIAL_NORMAL;
			u[ at + 2 ] = material.side === DoubleSide ? FLAG_DOUBLE_SIDE : 0;
			f[ at + 3 ] = material.opacity;
			f.set( object.matrixWorld.elements, at + 4 );
			at += DRAW_WORDS;

		}

		return buffer;

	}

}

// `count` items of `size` from a three.js attribute into f at `at`, zeros
// when there is none; a plain Float32Array is copied whole.
function copy( f, at, attribute, count, size ) {

	const n = count * size;
	if ( attribute === undefined ) {

		f.fill( 0, at, at + n );

	} else if ( ! attribute.isInterleavedBufferAttribute && attribute.itemSize === size && attribute.array instanceof Float32Array && ! attribute.normalized ) {

		f.set( attribute.array.subarray( 0, n ), at );

	} else {

		for ( let i = 0; i < count; i ++ ) {

			f[ at + i * size ] = attribute.getX( i );
			if ( size > 1 ) f[ at + i * size + 1 ] = attribute.getY( i );
			if ( size > 2 ) f[ at + i * size + 2 ] = attribute.getZ( i );

		}

	}

	return at + n;

}

export { AeRenderer };
