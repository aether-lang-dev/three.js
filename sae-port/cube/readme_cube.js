// The README's spinning cube, drawn through AeRenderer with a stand-in gfx
// that keeps each batch: runs after the IIFE bundle of three-sae.js (THREE)
// on Node or sae's engine (tools/saejs). For the times in CUBE_TIMES it
// prints, per frame, the batch as hex and what three.js itself says the
// picture must be: each face the eye sees, its centre's pixel and its
// colour (MeshNormalMaterial: the normal in the eye's space, through
// three.js's own normal matrix, times 0.5 plus 0.5). check_frame.py holds
// ae3d's picture of that batch to it. MIT.
/* global THREE, print */
const out = typeof print === 'function' ? print : console.log;
const SIZE = 256;
const times = typeof CUBE_TIMES !== 'undefined' ? CUBE_TIMES : [ 1200, 2600 ];

const batches = [];
const gfx = {
	scene: ( w, h ) => 1,
	submit: ( handle, bytes ) => { batches.push( bytes.slice() ); },
	free: () => {},
};

// The README, as it is but for the window.
const camera = new THREE.PerspectiveCamera( 70, SIZE / SIZE, 0.01, 10 );
camera.position.z = 1;
const scene = new THREE.Scene();
const geometry = new THREE.BoxGeometry( 0.2, 0.2, 0.2 );
const material = new THREE.MeshNormalMaterial();
const mesh = new THREE.Mesh( geometry, material );
scene.add( mesh );
const renderer = new THREE.AeRenderer( { width: SIZE, height: SIZE, gfx } );

function animate( time ) {

	mesh.rotation.x = time / 2000;
	mesh.rotation.y = time / 1000;
	renderer.render( scene, camera );

}

const hex = ( bytes ) => Array.from( bytes, ( b ) => ( b < 16 ? '0' : '' ) + b.toString( 16 ) ).join( '' );

for ( const time of times ) {

	animate( time );
	const bytes = batches[ batches.length - 1 ];
	// What three.js says: per face (BoxGeometry's six groups of four vertices).
	const modelView = new THREE.Matrix4().multiplyMatrices( camera.matrixWorldInverse, mesh.matrixWorld );
	const normalMatrix = new THREE.Matrix3().getNormalMatrix( modelView );
	const pos = geometry.attributes.position, nor = geometry.attributes.normal;
	const faces = [];
	for ( let f = 0; f < 6; f ++ ) {

		const c = new THREE.Vector3();
		for ( let k = 0; k < 4; k ++ ) c.add( new THREE.Vector3().fromBufferAttribute( pos, f * 4 + k ) );
		c.multiplyScalar( 0.25 );
		const eye = c.clone().applyMatrix4( modelView );
		const n = new THREE.Vector3().fromBufferAttribute( nor, f * 4 ).applyMatrix3( normalMatrix ).normalize();
		const facing = n.dot( eye.clone().negate().normalize() );
		if ( facing < 0.15 ) continue;
		const ndc = eye.clone().applyMatrix4( camera.projectionMatrix );
		faces.push( {
			face: f,
			x: Math.floor( ( ndc.x + 1 ) / 2 * SIZE ), y: Math.floor( ( 1 - ndc.y ) / 2 * SIZE ),
			rgb: [ n.x, n.y, n.z ].map( ( v ) => Math.round( ( v * 0.5 + 0.5 ) * 255 ) ),
		} );

	}

	out( JSON.stringify( { time, frame: renderer.info.frame, bytes: bytes.length, sent: renderer.info.sent, draws: renderer.info.draws, faces } ) );
	out( hex( bytes ) );

}
