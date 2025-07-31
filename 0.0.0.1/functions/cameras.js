export function createCameras(scene, canvas) {

    scene.freeCam = new BABYLON.UniversalCamera('FreeCam', new BABYLON.Vector3(0, 5, -10), scene);
    scene.freeCam.setTarget(BABYLON.Vector3.Zero());
    scene.freeCam.attachControl(canvas, true);

}
    