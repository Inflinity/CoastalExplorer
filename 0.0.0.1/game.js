import { createCameras } from './functions/cameras.js';

const canvas = document.getElementById("renderCanvas");
const sizeBox = document.getElementById("sizeDisplay");

let engine = null;
let scene = null;
let sceneToRender = null;

BABYLON.SceneLoader.ShowLoadingScreen = false;
BABYLON.OBJFileLoader.OPTIMIZE_WITH_UV = true;
BABYLON.OBJFileLoader.COMPUTE_NORMALS = true;

const createDefaultEngine = function () { return new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false }); };
const startRenderLoop = function (engine, canvas) { engine.runRenderLoop(function () { if (sceneToRender && sceneToRender.activeCamera) { sceneToRender.render(); } }); };



async function createScene(engine, canvas) {

    const scene = new BABYLON.Scene(engine);

    createCameras(scene, canvas);

    scene.activeCamera = scene.freeCam;

    scene.registerBeforeRender(() => {





  console.log("Aktuelle FPS:", engine.getFps().toFixed(2));



    
  });


  return scene;
}


window.initFunction = async function(){
  const asyncEngineCreation=async function (){ try {return createDefaultEngine();}catch(e){console.log("Engine failed");return createDefaultEngine();} };
  engine = await asyncEngineCreation();
  if (!engine) throw 'engine should not be null.';
  startRenderLoop(engine, canvas);
  scene = await createScene(engine, canvas);
  sceneToRender = scene;
};

initFunction();


window.addEventListener("resize", function () {if (engine) engine.resize();});

