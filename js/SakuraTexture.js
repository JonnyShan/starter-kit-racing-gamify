import * as THREE from 'three';

const SAKURA_R = 255;
const SAKURA_G = 183;
const SAKURA_B = 197;
const GREEN_MIN = 80;
const GREEN_DELTA = 15;
const COLORMAP_URL = 'models/Textures/colormap.png';

export function buildSakuraTexture() {

	return new Promise( ( resolve, reject ) => {

		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => {

			const canvas = document.createElement( 'canvas' );
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext( '2d' );
			ctx.drawImage( img, 0, 0 );

			const imageData = ctx.getImageData( 0, 0, canvas.width, canvas.height );
			const data = imageData.data;

			for ( let i = 0; i < data.length; i += 4 ) {

				const r = data[ i     ];
				const g = data[ i + 1 ];
				const b = data[ i + 2 ];

				if ( g > GREEN_MIN && g > r + GREEN_DELTA && g > b + GREEN_DELTA ) {

					const factor = g / 255;
					data[ i     ] = SAKURA_R * factor;
					data[ i + 1 ] = SAKURA_G * factor;
					data[ i + 2 ] = SAKURA_B * factor;

				}

			}

			ctx.putImageData( imageData, 0, 0 );

			const tex = new THREE.CanvasTexture( canvas );
			tex.colorSpace = THREE.SRGBColorSpace;
			tex.flipY = false;
			tex.anisotropy = 4;
			resolve( tex );

		};
		img.onerror = reject;
		img.src = COLORMAP_URL;

	} );

}
