// three.js on sae: does its JavaScript run on sae's engine, and how fast?
// Runs after the bundle of entry.js (THREE). Prints a JSON line of
// correctness results ("check") and one per timing ("time"), so run.sh can
// diff the checks between engines and tabulate the times. MIT.
/* global THREE, print */
const out = typeof print === 'function' ? print : console.log;
const now = ( typeof performance !== 'undefined' && performance.now ) ? () => performance.now() : () => Date.now();
const SCALE = ( typeof BENCH_SCALE !== 'undefined' ) ? BENCH_SCALE : 1;

const r6 = ( x ) => Math.round( x * 1e6 ) / 1e6;
const arr = ( a ) => Array.from( a, r6 );

// --- correctness: the same code, compared with Node byte for byte -----------
function checks() {

	const c = {};
	const m = new THREE.Matrix4().compose(
		new THREE.Vector3( 1, 2, 3 ),
		new THREE.Quaternion().setFromEuler( new THREE.Euler( 0.3, - 0.7, 1.1, 'YXZ' ) ),
		new THREE.Vector3( 2, 0.5, 1.5 ) );
	c.compose = arr( m.elements );
	c.invert = arr( m.clone().invert().elements );
	c.det = r6( m.determinant() );
	const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
	m.decompose( p, q, s );
	c.decompose = [ ...arr( p.toArray() ), ...arr( q.toArray() ), ...arr( s.toArray() ) ];
	c.slerp = arr( new THREE.Quaternion( 0, 0, 0, 1 ).slerp( new THREE.Quaternion( 0.5, 0.5, 0.5, 0.5 ), 0.3 ).toArray() );
	c.cross = arr( new THREE.Vector3( 1, 2, 3 ).cross( new THREE.Vector3( - 2, 0.5, 4 ) ).toArray() );
	c.lookAt = arr( new THREE.Matrix4().lookAt( new THREE.Vector3( 3, 4, 5 ), new THREE.Vector3(), new THREE.Vector3( 0, 1, 0 ) ).elements );
	c.perspective = arr( new THREE.Matrix4().makePerspective( - 0.5, 0.5, 0.4, - 0.4, 0.1, 100 ).elements );
	c.color = new THREE.Color( 'hsl(210, 60%, 40%)' ).getHexString();

	// Object3D: a three-level hierarchy, world matrices and a world position.
	const a = new THREE.Object3D(), b = new THREE.Object3D(), d = new THREE.Object3D();
	a.position.set( 1, 0, 0 ); a.rotation.set( 0, Math.PI / 2, 0 );
	b.position.set( 0, 2, 0 ); b.scale.set( 2, 2, 2 );
	d.position.set( 0, 0, 3 ); d.rotation.set( 0.4, 0, 0.2 );
	a.add( b ); b.add( d );
	a.updateMatrixWorld();
	c.worldMatrix = arr( d.matrixWorld.elements );
	c.worldPosition = arr( d.getWorldPosition( new THREE.Vector3() ).toArray() );
	d.lookAt( 5, 5, 5 );
	c.lookAtQuat = arr( d.quaternion.toArray() );

	// Geometries: counts, bounds and a few positions and normals.
	const box = new THREE.BoxGeometry( 1, 2, 3, 2, 2, 2 );
	box.computeBoundingSphere();
	c.box = [ box.attributes.position.count, box.index.count, r6( box.boundingSphere.radius ), ...arr( box.attributes.normal.array.slice( 0, 9 ) ) ];
	const sph = new THREE.SphereGeometry( 1, 64, 32 );
	sph.computeBoundingBox();
	c.sphere = [ sph.attributes.position.count, sph.index.count, ...arr( sph.attributes.position.array.slice( 300, 306 ) ) ];
	const knot = new THREE.TorusKnotGeometry();
	knot.computeBoundingBox();
	const bb = knot.boundingBox;
	c.knot = [ knot.attributes.position.count, knot.index.count, ...arr( bb.min.toArray() ), ...arr( bb.max.toArray() ), ...arr( knot.attributes.normal.array.slice( 600, 606 ) ) ];

	// Raycasting against a sphere.
	const ray = new THREE.Ray( new THREE.Vector3( 0, 0, 5 ), new THREE.Vector3( 0, 0, - 1 ) );
	c.ray = arr( ray.intersectSphere( new THREE.Sphere( new THREE.Vector3( 0.2, 0, 0 ), 1 ), new THREE.Vector3() ).toArray() );
	return c;

}

// --- timing --------------------------------------------------------------------
// The median of `runs` timings of fn() repeated `reps` times, per call in ms.
function time( name, runs, reps, fn, extra ) {

	fn(); // warm
	const ts = [];
	for ( let r = 0; r < runs; r ++ ) {

		const t0 = now();
		for ( let i = 0; i < reps; i ++ ) fn();
		ts.push( ( now() - t0 ) / reps );

	}

	ts.sort( ( x, y ) => x - y );
	const ms = ts[ ts.length >> 1 ];
	out( JSON.stringify( Object.assign( { time: name, ms: r6( ms ) }, extra || {} ) ) );
	return ms;

}

function place( o, i ) {

	o.position.set( Math.sin( i ) * 10, Math.cos( i * 0.7 ) * 10, i * 0.01 );
	o.rotation.set( i * 0.1, i * 0.2, i * 0.3 );

}

function flat( n ) {

	const root = new THREE.Object3D();
	for ( let i = 0; i < n; i ++ ) {

		const o = new THREE.Object3D(); place( o, i ); root.add( o );

	}

	return root;

}

// A 4-ary tree of n objects (depth about log4 n), built breadth first.
function nested( n ) {

	const root = new THREE.Object3D();
	const all = [ root ];
	for ( let i = 1; i < n; i ++ ) {

		const o = new THREE.Object3D(); place( o, i );
		all[ ( i - 1 ) >> 2 ].add( o ); all.push( o );

	}

	return root;

}

function benches() {

	for ( const n of [ 1000, 5000 ] ) {

		for ( const [ shape, make ] of [ [ 'flat', flat ], [ 'nested', nested ] ] ) {

			const root = make( n );
			// What a frame costs: every object's local matrix and world matrix.
			time( `updateMatrixWorld ${shape} ${n}`, 7, Math.max( 1, Math.round( 20 * SCALE * 1000 / n ) ), () => root.updateMatrixWorld( true ) );
			// The same, with the page turning every object first (an animation loop).
			let t = 0;
			time( `rotate+updateMatrixWorld ${shape} ${n}`, 7, Math.max( 1, Math.round( 20 * SCALE * 1000 / n ) ), () => {

				t += 0.01;
				const cs = root.children;
				root.traverse( ( o ) => { o.rotation.y = t; } );
				root.updateMatrixWorld( true );

			} );

		}

	}

	time( 'BoxGeometry()', 7, Math.round( 200 * SCALE ), () => new THREE.BoxGeometry() );
	time( 'SphereGeometry(1,64,32)', 7, Math.max( 1, Math.round( 10 * SCALE ) ), () => new THREE.SphereGeometry( 1, 64, 32 ) );
	time( 'TorusKnotGeometry()', 7, Math.max( 1, Math.round( 10 * SCALE ) ), () => new THREE.TorusKnotGeometry() );
	time( 'TorusKnotGeometry(1,0.4,256,32)', 5, Math.max( 1, Math.round( 2 * SCALE ) ), () => new THREE.TorusKnotGeometry( 1, 0.4, 256, 32 ) );

	// Matrix ops: N calls per timing, reported per op and as ops a second.
	const N = Math.round( 20000 * SCALE );
	const a = new THREE.Matrix4().compose( new THREE.Vector3( 1, 2, 3 ), new THREE.Quaternion( 0.1, 0.2, 0.3, 0.927 ).normalize(), new THREE.Vector3( 1, 1, 1 ) );
	const b = a.clone().invert(), m = new THREE.Matrix4();
	const pos = new THREE.Vector3( 1, 2, 3 ), quat = new THREE.Quaternion( 0.1, 0.2, 0.3, 0.927 ).normalize(), scl = new THREE.Vector3( 1, 2, 1 );
	const v = new THREE.Vector3();
	for ( const [ name, fn ] of [
		[ 'Matrix4.multiplyMatrices', () => { for ( let i = 0; i < N; i ++ ) m.multiplyMatrices( a, b ); } ],
		[ 'Matrix4.compose', () => { for ( let i = 0; i < N; i ++ ) m.compose( pos, quat, scl ); } ],
		[ 'Matrix4.invert', () => { for ( let i = 0; i < N; i ++ ) m.copy( a ).invert(); } ],
		[ 'Vector3.applyMatrix4', () => { for ( let i = 0; i < N; i ++ ) v.set( 1, 2, 3 ).applyMatrix4( a ); } ],
	] ) {

		const ms = time( name, 7, 1, fn, { ops: N } );
		out( JSON.stringify( { rate: name, opsPerSec: Math.round( N / ms * 1000 ) } ) );

	}

}

out( JSON.stringify( { check: checks() } ) );
if ( typeof BENCH_CHECK_ONLY === 'undefined' ) benches();
