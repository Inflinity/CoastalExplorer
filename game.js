import { createCharacter } from './functions/character.js';
import { createCameras } from './functions/cameras.js';
import { createObjects } from './functions/objects.js';
import { createGround } from './functions/ground.js';
import { createWeather } from './functions/weather.js';
import { createSky } from './functions/sky.js';
import { createLight } from './functions/light.js';
import { createOcean } from './functions/ocean.js';
import { createSound } from './functions/sound.js';
import { createShellSpawner } from './functions/shellSpawner.js';
import { createHud } from './functions/hud.js';
import { createDebugMenu } from './functions/debugMenu.js';
import { getRealDateAsMillis, optimizeMesh } from './functions/helpers.js';

BABYLON.SceneLoader.ShowLoadingScreen = false;
BABYLON.OBJFileLoader.OPTIMIZE_WITH_UV = true;
BABYLON.OBJFileLoader.COMPUTE_NORMALS = true;
  
let canvas = document.getElementById("renderCanvas");
let engine = new BABYLON.Engine(canvas, true, {preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false});
engine.setHardwareScalingLevel(1.0);
engine.enableOfflineSupport = false;
let scene = new BABYLON.Scene(engine);

document.getElementById("loadingText").innerText = "loading ...";

const tiltEarthAxis = 23.5;
const tiltMoonAxis = tiltEarthAxis - 5.14;
const millisecondsPerYear = 365.25 * 24 * 60 * 60 * 1000;


scene.beginnOfAccounting = new Date(); // first time of someone logging in and continuing to play


scene.varTime = 0.0;
scene.varTimeOffset = -7.0;
scene.varTideOffset = -23.0;
scene.varUsedTime = 0;
scene.varUsedTimeHours = scene.varUsedTime % (24 * 60 * 60 * 1000);
scene.varUsedTimeMoonMonths = Math.floor(scene.varUsedTime / (1000 * 60 * 60 * 24 * 29.53));
scene.varWaterIsLoaded = false;
scene.varOnTheFifth = 0;
scene.varInit = 0;
scene.varFractionOfYear = 0.0;
scene.varRatio = 0.0;
scene.varTidenhub = 0.0;  //  optimized still for 12 - 32 max
scene.varBackgroundDarkness = 0.0;
scene.varSunDegrees = 0.0;
scene.varMoonDegrees = 0.0;
scene.varDeltaSunMoon = 0.0;
scene.varSwimming = false;
scene.varSunToBoxDirection = new BABYLON.Vector3(0,0,0);
scene.varSunColor = new BABYLON.Color3(1, 1, 1);
scene.varSunScaleFactor = 0.0;
scene.varLightWeatherFactorIST = 0.5;
scene.varStormSeaFactorIST = 0.4;
scene.varSkyColor = new BABYLON.Color3(84 / 255, 180 / 255, 255 / 255);
scene.varBlueSky = new BABYLON.Color3(84 / 255, 180 / 255, 255 / 255);
scene.varSunColorWhite = new BABYLON.Color3(1, 1, 1);
scene.varSunColorRed = new BABYLON.Color3(1, 0.27, 0);
scene.clearColor = new BABYLON.Color3(0, 0, 0); //render background <- always black
scene.ambientColor = new BABYLON.Color3(0, 0, 0); //moody light specular on surfaces <- always black!
scene.varInitMove = false; //makes the character appear at beginning
scene.varSmallInitMove = false; //perform once during a new moving around phase (start animation again, but not over and over)
scene.idle = false;
scene.idleCounter = 0;
scene.states = []; // leeres Array

var leftButtonDown, rightButtonDown, lookAroundMode, moveAroundMode, keyMode, wKeyPressed, aKeyPressed, sKeyPressed, dKeyPressed, percentageDistance;

/////////////////////////////////////////////////// AMBIENT STUFF ////////////////////////////////////////////////////////////

let { Weather, weatherValues, fountain, fogTexture, particleSystem, createNewSystem } = createWeather(scene);






// sky & backgrounds
let { moonCircle, parentSphere, starSphere, moonSphere, fallingStars, himmelsZelt, cloudsSlow, cloudsFast, moonTextures, moonTextureIndex, currentMoonTextureIndex, nearBackground, farBackground, atmoSphere } = createSky(scene);
var starSphereRotationYSOLL, masterCircleRotationSOLL; // smooth transition posibility for celestial phases 
optimizeMesh(himmelsZelt);



// character and camera
let {box, lowerTorso, head, leftUpperLeg,rightUpperLeg,upperTorso,leftLowerLeg,rightLowerLeg,leftUpperArm,rightUpperArm, leftLowerArm, rightLowerArm } = createCharacter(scene);
let {freeCamera, characterCamera, cameraRadius, cameraTarget, cameraPosition, cameraRadiusMin, cameraRadiusMax, zoomSpeed, camActive} = createCameras(scene, canvas, box);


// light & shadow
let { masterCircle, parentCircle, sun, glowLayer, sunLight, light, lensFlareSystem, flare01, flare03, flare05, flare06, shadowGenerator, nightLight, godrays, underWaterBackGroundFragmentShader } = createLight(scene, engine);


// ground
var groundIsLoaded, ground, groundObservable, waterIsLoaded, ocean, reflexionOnSea, waterMesh, surface, volumetricSystem;
groundObservable = createGround(scene, light);
groundObservable.add((loadedGround) => {ground = loadedGround; groundIsLoaded=true;}); // wait and keep registerBeforeRender idle



// objects
let { objVWBus, objStele } = createObjects(scene, shadowGenerator);







// shadow
shadowGenerator.addShadowCaster(lowerTorso); // has to be added outside constructor



//objStele.material.shadowDepthWrapper = new BABYLON.ShadowDepthWrapper(objStele.material, scene);

[box, lowerTorso, head, leftUpperLeg, rightUpperLeg, upperTorso, leftLowerLeg, rightLowerLeg, leftUpperArm, rightUpperArm, leftLowerArm, rightLowerArm].forEach(mesh => {
  if (mesh.material) {
      mesh.material.shadowDepthWrapper = new BABYLON.ShadowDepthWrapper(mesh.material, scene);
  }
});







let {sound} = createSound(scene);
let audioContextUnlocked = false;

// Event listener to unlock audio context on mouse movement
const unlockAudioContext = () => {
    if (!audioContextUnlocked) {
        sound.play(); // This initializes the audio context
        sound.stop(); // Stop immediately if it's unintended
        audioContextUnlocked = true;
        //console.log("Audio context unlocked via mouse movement.");
        window.removeEventListener("mousemove", unlockAudioContext); // Remove the event listener after unlocking
    }
};


const shellThrowSound = new BABYLON.Sound("shellThrow", "audio/swoosh_01.wav", scene, null, {
  autoplay: false,
  loop: false,
  volume: 0.2
});
shellThrowSound.setPlaybackRate(0.7); // leicht verlangsamter Sound



// Create the Green Algae mesh
var greenAlgae = BABYLON.MeshBuilder.CreateGroundFromHeightMap(
  "GreenAlgae",
  "./graphics/basics/beach_h.png",
  {
    width: 3000,
    height: 3000,
    minHeight: 0,
    maxHeight: 150,
    subdivisions: 36
  },
  scene
);

greenAlgae.position.y += 0.3;
greenAlgae.receiveShadows = true;
greenAlgae.isPickable=false;


// Create the Green Algae material
var bMat = new BABYLON.StandardMaterial("GreenAlgaeMaterial", scene);

// Load the diffuse texture for green algae
var algaeTexture = new BABYLON.Texture("./graphics/greenalgae.png", scene);
bMat.diffuseTexture = algaeTexture;

// Use emissiveTexture for illumination
bMat.emissiveTexture = algaeTexture;
bMat.useEmissiveAsIllumination = true;

// Set opacity texture to handle transparency
bMat.opacityTexture = algaeTexture;
bMat.opacityTexture.getAlphaFromRGB = true;

// Adjust material settings
bMat.specularColor = new BABYLON.Color3(0, 0, 0); // No specular highlights
bMat.disableLighting = true; // Use emissive lighting instead of scene lighting
bMat.ambientColor = new BABYLON.Color3(0, 0, 0);
bMat.alpha = 0.15; // Adjust overall alpha transparency
bMat.diffuseTexture.hasAlpha = true; // Ensure the texture's alpha channel is respected

// Assign the material to the mesh
greenAlgae.material = bMat;


// shells
let { seaShellSpawnerAtlas, shellSpawnZones, seaShells, hollowShellSprite, hollowShellSprite2 } = createShellSpawner(scene);






const now = new Date(); // aktuelles Datum und Uhrzeit
const latitude = 48.7758; // Beispiel: Stuttgart
const longitude = 9.1829;
const golo = new BABYLON.MeshBuilder.CreateSphere("Golo", {diameter: 2}, scene); // Beispiel-Sonne

const sunPosition = calculateSunPosition(new Date(), 48.7758, 9.1829, golo, true);
console.log("Sun Position:", sunPosition);




function calculateSunPosition(date, latitude, longitude, sphere, showDebug=false) {
  // Hilfsfunktionen
  function deg2rad(deg) {
      return deg * (Math.PI / 180);
  }
  function rad2deg(rad) {
      return rad * (180 / Math.PI);
  }

  // Datum vorbereiten
  const dayOfYear = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - 
                                Date.UTC(date.getFullYear(), 0, 0)) / 86400000);

  const timeUTC = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

  // Mittlere Sonnendeklination (ungefähre Formel)
  const decl = -23.44 * Math.cos(deg2rad((360 / 365) * (dayOfYear + 10)));

  // Equation of Time (Korrektur für Analemma, Näherung)
  const B = deg2rad((360/365) * (dayOfYear - 81));
  const EoT = 9.87 * Math.sin(2*B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

  // Wahre Sonnenzeit
  const solarTime = timeUTC + (4 * (longitude)) / 60 + EoT / 60;

  // Stundenwinkel
  const hourAngle = 15 * (solarTime - 12);

  // Höhe der Sonne
  const latRad = deg2rad(latitude);
  const declRad = deg2rad(decl);
  const haRad = deg2rad(hourAngle);

  const altitude = rad2deg(Math.asin(Math.sin(latRad) * Math.sin(declRad) + 
                                     Math.cos(latRad) * Math.cos(declRad) * Math.cos(haRad)));

  // Azimut der Sonne
  const azimuth = rad2deg(Math.atan2(
      -Math.sin(haRad),
      Math.tan(declRad) * Math.cos(latRad) - Math.sin(latRad) * Math.cos(haRad)
  ));

  // Normalisieren auf 0-360°
  const azimuth360 = (azimuth + 360) % 360;

  if (showDebug) {
      console.log("Day of Year:", dayOfYear);
      console.log("Declination:", decl.toFixed(2));
      console.log("Equation of Time (min):", EoT.toFixed(2));
      console.log("Solar Time:", solarTime.toFixed(2));
      console.log("Hour Angle:", hourAngle.toFixed(2));
      console.log("Altitude:", altitude.toFixed(2));
      console.log("Azimuth:", azimuth360.toFixed(2));
  }

  // Setzen der Sphere-Position
  const distance = 50; // Abstand der Sonne von Zentrum, kann beliebig sein
  const altitudeRad = deg2rad(altitude);
  const azimuthRad = deg2rad(azimuth360);

  sphere.position.x = distance * Math.cos(altitudeRad) * Math.sin(azimuthRad);
  sphere.position.y = distance * Math.sin(altitudeRad);
  sphere.position.z = distance * Math.cos(altitudeRad) * Math.cos(azimuthRad);

  return { azimuth: azimuth360, declination: decl };
}












// create HUD
let { hudCam, hudChar, hudCamIcon, hudFrame, hudArrowIcon, journalActive, hudCoastalExplorer, hudSeashellCollector, dragPlane, grabbedShell, dragVelocity, previousPosition, releasedShells, previousPositions } = createHud(scene);
let { advancedTexture, panel, dayTimeCheckbox, dayTimeSlider, cameraCheckbox } = createDebugMenu(engine);

let customOptimizerOptions = new BABYLON.SceneOptimizerOptions(60, 1000);
customOptimizerOptions.optimizations.push(new BABYLON.TextureOptimization(0, 256));
customOptimizerOptions.optimizations.push(new BABYLON.HardwareScalingOptimization(0, 2));

// ################################################################################################################### //
// ################################################ REGISTER BEFORE ################################################## //
// ################################################################################################################### //























































scene.registerBeforeRender(function () {






  scene.varTime += engine.getDeltaTime() * 0.001;

  if(waterIsLoaded){
    if(scene.varOnTheFifth>10) {    // here you can set off-load sky stuff to every x-frame

      if(scene.varInit<2){
        make_the_sky();
        changeWeather(weatherValues[Math.floor(Math.random() * weatherValues.length)]);
        set_the_ocean();
        BABYLON.SceneOptimizer.OptimizeAsync(scene, customOptimizerOptions, function() {}, function() {});
        setTimeout(function() { var loaderDiv = document.getElementById("loadingScreen"); loaderDiv.style.display = "none";}, 500);
        scene.varInit++;
      }

      update_clouds();

    















      scene.varOnTheFifth=0;
    }
    scene.varOnTheFifth++;
    update_ground_and_ocean();
    character_movement();

    const direction3 = box.projectedPosition.subtract(box.position);
    direction3.normalize();
    box.inklination = Math.atan2(direction3.y, direction3.x);

    character_trails();
    resolve_character();
    resolve_camera();

    head.angle = characterCamera.absoluteRotation.clone().toEulerAngles().scale(0.5);
    head.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(head.angle.y, head.angle.x, head.angle.z);


 // spawn stuff
 if(seaShells.length<50000){

  var selectedZone = shellSpawnZones[Math.floor(Math.random() * shellSpawnZones.length)];
  let theta = Math.random() * 2 * Math.PI; // Random angle
  let sqrtR = Math.sqrt(Math.random()); // Square root of a random number for radial distribution
  let r = sqrtR * selectedZone.radius; // Adjust radius with square root to favor points towards the center

  // Convert polar to Cartesian coordinates
  let x = r * Math.cos(theta);
  let z = r * Math.sin(theta);

  // Random position near the player
  let spawnX = selectedZone.centerX+x;
  let spawnZ = selectedZone.centerZ+z;

  let spawnY = ground.getHeightAtCoordinates(spawnX, spawnZ)+0.1; // Get the y-coordinate from the ground

  let rollShellType = Math.floor(Math.random() * seaShellSpawnerAtlas.length);

  const baseSize = 0.4; // 1/5th of 120 pixels
  const sizeVariation = baseSize * (0.9 + Math.random() * 0.2); // 0.9 to 1.1 factor
  var _seaShellSprite = new BABYLON.Sprite("SeaShellSprite", seaShellSpawnerAtlas[rollShellType].spawner);
  _seaShellSprite.cellIndex = Math.floor(Math.random() * seaShellSpawnerAtlas[rollShellType].frames);
  _seaShellSprite.size = sizeVariation;
  _seaShellSprite.angle = Math.random() * Math.PI * 2; // Random angle in radians
  _seaShellSprite.position = new BABYLON.Vector3(spawnX,spawnY,spawnZ);
  _seaShellSprite.isPickable = true;
}




/** 
// despawn stuff out of reach
seaShells.forEach(seaShell => {

//console.log(seaShell);

let distanceX = box.position.x - seaShell.position.x;
let distanceZ = box.position.z - seaShell.position.z;
let distance = Math.sqrt(distanceX * distanceX + distanceZ * distanceZ);

if (distance > 110) {
// Dispose of the sprite
seaShell.dispose();

// Optionally, if you want to remove the disposed sprite from the array
//seaShells = seaShells.filter(item => item.sprite !== seaShell.sprite);
}
});



*/




// new stuff





















  }

  if(groundIsLoaded){if(!waterIsLoaded){
    ({ ocean, reflexionOnSea, waterMesh, surface, volumetricSystem } = createOcean(scene, engine, ground, nearBackground, sun, starSphere, lowerTorso, head, leftUpperLeg,rightUpperLeg,upperTorso,leftLowerLeg,rightLowerLeg,leftUpperArm,rightUpperArm, leftLowerArm,rightLowerArm, greenAlgae));
    waterIsLoaded=true;
  }}

});

engine.runRenderLoop(function () { scene.render(); });

// ################################################################################################################### //
// ########################################## REGISTER BEFORE DEEP FUNCTIONS ######################################### //
// ################################################################################################################### //

function changeWeather(weatherRequest) {

  scene.varSkyColor = scene.varBlueSky

  if(weatherRequest==Weather.bluesky)
  {

  }

  else if(weatherRequest==Weather.breeze)
  {

  }

  else if(weatherRequest==Weather.stormy)
    {

    }

}











function make_the_sky() {
  scene.varUsedTime = getRealDateAsMillis();
  scene.varUsedTimeHours = scene.varUsedTime % (24 * 60 * 60 * 1000);
  scene.varUsedTimeMoonMonths = scene.varUsedTime % (24 * 60 * 60 * 1000 * 29.53);
  scene.varFractionOfYear = ((scene.varUsedTime % millisecondsPerYear) / millisecondsPerYear)* 2 * Math.PI;
  starSphere.rotation.y = scene.varUsedTime * BABYLON.Tools.ToRadians(-0.00000417); //star sphere
  masterCircle.rotation.x = BABYLON.Tools.ToRadians(90 + 48 - (tiltEarthAxis * Math.sin(scene.varFractionOfYear - Math.PI / 2))); //sun sphere
  parentCircle.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(- ((scene.varUsedTimeHours/(60*60*1000))+scene.varTimeOffset) * 15 * Math.PI / 180, 0, 0); //+0.0 is where you can offset the day
  moonCircle.rotation.x = (90+48-(tiltMoonAxis * Math.sin(scene.varFractionOfYear - Math.PI / 2))) * Math.PI/180; //moon sphere
  moonSphere.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(- (((scene.varUsedTimeMoonMonths/(60*60*1000))+6) * 0.511 * Math.PI / 180) - (((scene.varUsedTimeHours/(60*60*1000))+12) * 15 * Math.PI / 180), 0, 0);
  scene.varSunDegrees = -(((- ((scene.varUsedTimeHours/(60*60*1000))+12) * 15) + 180) % 360); // 180 is the sun circle offset
  scene.varMoonDegrees = -((- (((scene.varUsedTimeMoonMonths/(60*60*1000))+6) * 0.511) - (((scene.varUsedTimeHours/(60*60*1000))+12) * 15) -109) % 360); // 109 is just the mapping offset
  scene.varDeltaSunMoon = Math.abs(scene.varSunDegrees - scene.varMoonDegrees);
  scene.varDeltaSunMoon = scene.varDeltaSunMoon % 360;  // Normalize just in case
  if (scene.varDeltaSunMoon > 180) { scene.varDeltaSunMoon = 360 - scene.varDeltaSunMoon; }
  switch (true) {
    case (scene.varDeltaSunMoon <= 180 && scene.varDeltaSunMoon > 157.5): moonTextureIndex = 0; break;
    case (scene.varDeltaSunMoon <= 157.5 && scene.varDeltaSunMoon > 135): moonTextureIndex = 7; break;
    case (scene.varDeltaSunMoon <= 135 && scene.varDeltaSunMoon > 112.5): moonTextureIndex = 6; break;
    case (scene.varDeltaSunMoon <= 112.5 && scene.varDeltaSunMoon > 90): moonTextureIndex = 5; break;
    case (scene.varDeltaSunMoon <= 90 && scene.varDeltaSunMoon > 67.5): moonTextureIndex = 4; break;
    case (scene.varDeltaSunMoon <= 67.5 && scene.varDeltaSunMoon > 45): moonTextureIndex = 3; break;
    case (scene.varDeltaSunMoon <= 45 && scene.varDeltaSunMoon > 22.5): moonTextureIndex = 2; break;
    case (scene.varDeltaSunMoon <= 22.5 && scene.varDeltaSunMoon >= 0): moonTextureIndex = 1; break;
  }
  if(moonTextureIndex !== currentMoonTextureIndex) {
    moonSphere.material.diffuseTexture = moonTextures[moonTextureIndex];
    moonSphere.material.diffuseTexture.hasAlpha = true; 
    moonSphere.material.emissiveTexture = moonTextures[moonTextureIndex];
    currentMoonTextureIndex = moonTextureIndex;
  }





  scene.varRatio = Math.max(0, Math.min(1, ((sun.getAbsolutePosition().y-300) / 1000)));
  ground.material.setFloat("myColorMixFactor", (1.0-((scene.varRatio*scene.varLightWeatherFactorIST)))*0.95); //here is the light of the ground

  scene.varBackgroundDarkness = Math.pow(scene.varRatio, 0.5)+0.1;
  cloudsSlow.material.diffuseTexture.level = scene.varBackgroundDarkness;  // sets the clouds dark in respect to the sun's y-position (with bitty offset and sqeezed by square-func)
  nearBackground.material.diffuseTexture.level = scene.varBackgroundDarkness;
  farBackground.material.diffuseTexture.level = scene.varBackgroundDarkness;

  cloudsFast.visibility=1*scene.varRatio;

  scene.varSunColor = BABYLON.Color3.Lerp(scene.varSunColorRed, scene.varSunColorWhite, scene.varRatio);
  sun.material.diffuseColor = scene.varSunColor;
  sun.material.emissiveColor = scene.varSunColor;
  scene.varSunScaleFactor = 200 + (1-scene.varRatio) * 200; //*100
  sun.scaling = new BABYLON.Vector3(scene.varSunScaleFactor, scene.varSunScaleFactor, scene.varSunScaleFactor);

  godrays.exposure = 0.8;

  sunLight.position.x = sun.getAbsolutePosition().x;
  sunLight.position.y = sun.getAbsolutePosition().y;
  sunLight.position.z = sun.getAbsolutePosition().z;
  glowLayer.intensity = scene.varRatio;

  flare01.color = new BABYLON.Color3(Math.pow(scene.varRatio, 3), Math.pow(scene.varRatio, 3), Math.pow(scene.varRatioo, 3));
  flare05.color = new BABYLON.Color3(Math.pow(scene.varRatio, 3), Math.pow(scene.varRatio, 3), Math.pow(scene.varRatio, 3));
  flare06.color = new BABYLON.Color3(0.5 * Math.pow(scene.varRatio, 3), 0.5 * Math.pow(scene.varRatio, 3), 0.5 * Math.pow(2 * scene.varRatio, 3));
  flare03.color = new BABYLON.Color3(0.5 * Math.pow(2 * scene.varRatio, 3), 0.5 * Math.pow(scene.varRatio, 3), 0.5 * Math.pow(2 * scene.varRatio, 3));

  scene.ambientColor=new BABYLON.Color3(scene.varRatio,scene.varRatio,scene.varRatio);
  sunLight.intensity=(scene.varRatio*1.0*scene.varLightWeatherFactorIST);
 // light.intensity=(scene.varRatio*1.0*scene.varLightWeatherFactorIST);

  nightLight.intensity = (1-scene.varRatio)*0.05;


  shadowGenerator.darkness = (1-(scene.varRatio*2));

  starSphere.visibility = (1-scene.varRatio)*1.0;
  moonSphere.visibility = (1-scene.varRatio)*1.0;

  himmelsZelt.material.alpha=scene.varRatio*2; // ratio in winter only reaches 0.75 -> might lead to error as greater 1






  himmelsZelt.material.emissiveColor = scene.varSkyColor;
  ground.material.setFloat("cloudFactor", 0.6);
  if(sunLight.position.y<320){glowLayer.intensity=0; cloudsFast.visibility=0.0;}












  var upperTorsoMaterial = new BABYLON.StandardMaterial("UpperTorsoMaterial", scene);

  // Assign the material to the upperTorso
  upperTorso.material = upperTorsoMaterial;
  
  // Set the color of the upperTorso (black to cancel out the glow)
  upperTorsoMaterial.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7); // Light grey color
  upperTorsoMaterial.emissiveColor = new BABYLON.Color3(0, 0, 0); // No emissive color
  
  // Create the glow layer
  var glowLayerStars = new BABYLON.GlowLayer("GlowLayerStars", scene);
  glowLayerStars.intensity = 0.7; // Adjust as needed (range: 0 to 1)
  
  // Add the starSphere and upperTorso to the glow layer
  glowLayerStars.addIncludedOnlyMesh(starSphere);
  glowLayerStars.addIncludedOnlyMesh(upperTorso);
  glowLayerStars.addIncludedOnlyMesh(ground);
  
  // Custom emissive color selector function
  glowLayerStars.customEmissiveColorSelector = function (mesh, subMesh, material, result) {
    if (mesh.name === "upperTorso") {
      // Set emissive color to black for upperTorso to cancel out glow
      result.set(0, 0, 0, 1); // Black color
    } else if (mesh.name === "starSphere") {
      // Set emissive color for starSphere
      result.set(1, 1, 1, material.alpha); // White color, respecting the alpha
    }  else if (mesh.name === "Ground") {
      // Set emissive color to black for upperTorso to cancel out glow
      result.set(0, 0, 0, 1); // Black color
    } else {
      // No emissive color for other meshes
      result.set(0, 0, 0, 0);
    }
  };
  
  // Custom emissive texture selector function
  glowLayerStars.customEmissiveTextureSelector = function (mesh) {
    if (mesh.name === "upperTorso") {
      // No emissive texture for upperTorso
      return null;
    } else if (mesh.name === "starSphere") {
      // Use emissive texture for starSphere
      return mesh.material.emissiveTexture;
    } else if (mesh.name === "Ground") {
      // Set emissive color to black for upperTorso to cancel out glow
      return null;
    }// No emissive texture for other meshes
    return null;
};











glowLayer.intensity = 0.7; // Adjust as needed (range: 0 to 1)
  
// Add the starSphere and upperTorso to the glow layer
glowLayer.addIncludedOnlyMesh(starSphere);
glowLayer.addIncludedOnlyMesh(upperTorso);
glowLayer.addIncludedOnlyMesh(ground);

// Custom emissive color selector function
glowLayer.customEmissiveColorSelector = function (mesh, subMesh, material, result) {
  if (mesh.name === "upperTorso") {
    // Set emissive color to black for upperTorso to cancel out glow
    result.set(0, 0, 0, 1); // Black color
  } else if (mesh.name === "starSphere") {
    // Set emissive color for starSphere
    result.set(1, 1, 1, material.alpha); // White color, respecting the alpha
  }  else if (mesh.name === "Ground") {
    // Set emissive color to black for upperTorso to cancel out glow
    result.set(0, 0, 0, 1); // Black color
  } else {
    // No emissive color for other meshes
    result.set(0, 0, 0, 0);
  }
};

// Custom emissive texture selector function
glowLayer.customEmissiveTextureSelector = function (mesh) {
  if (mesh.name === "upperTorso") {
    // No emissive texture for upperTorso
    return null;
  } else if (mesh.name === "starSphere") {
    // Use emissive texture for starSphere
    return mesh.material.emissiveTexture;
  } else if (mesh.name === "Ground") {
    // Set emissive color to black for upperTorso to cancel out glow
    return null;
  }// No emissive texture for other meshes
  return null;
};















}



function set_the_ocean() {
  scene.varTidenhub = 50 + (((1/3) * (- Math.sin(Math.PI * scene.varSunDegrees / 90)) + (2/3) * (- Math.sin(Math.PI * scene.varMoonDegrees / 90))) * 30) + scene.varTideOffset;
  ocean.position.y = scene.varTidenhub;
  surface.position.y = scene.varTidenhub;
  reflexionOnSea.mirrorPlane = new BABYLON.Plane(0, -1, 0, scene.varTidenhub);
}

function update_clouds() {
  cloudsSlow.rotation.y += 0.0001;
  cloudsFast.material.emissiveTexture.uOffset += 0.00002;
  cloudsFast.material.emissiveTexture.vOffset += 0.00002;
}

function update_ground_and_ocean() {
  ground.material.setFloat('time', scene.varTime*.5);
  ground.material.setVector3('cameraPosition' , scene.activeCamera.position);
  ocean.position.x = Math.sin(scene.varTime * 0.5) * 50; // Adjust 0.5 for speed and 5 for amplitude
  ocean.rotation.z = Math.sin(scene.varTime) * 0.001;
  surface.position.x = Math.sin(scene.varTime * 0.5) * 50; // Adjust 0.5 for speed and 5 for amplitude
  surface.rotation.z = Math.sin(scene.varTime) * 0.001;
}

function character_movement(){



  
    
  characterCamera.camDirection = characterCamera.getForwardRay().direction;
  characterCamera.camDirection.normalize();

  characterCamera.factor = Math.exp(-4.0 * Math.pow(characterCamera.camDirection.y, 2));    // Calculate the factor using an exponential decay function
  characterCamera.factor = Math.max(characterCamera.factor, 0.1); // Ensure the factor does not go below 0.1

  //box.waterUnderKeel = tidenhub - ground.getHeightAtCoordinates(box.position.x, box.position.z)+2;
  box.waterUnderKeel = box.distance_surface;







  if(box.distance_surface>0){ box.isSwimming=true; } else { box.isSwimming = false; } // swimming yes or no


  if(box.isSwimming){
    box.force = new BABYLON.Vector3(0, -1, 0).scale(0.06); // gravity
    box.force = box.force.add(box.momentum.scale(0.3)); // momentum trail
    box.jump=0;
  } else {
    box.force = new BABYLON.Vector3(0, -1, 0).scale(0.26); // gravity
    box.force = box.force.add(new BABYLON.Vector3(0, 1, 0).scale(box.jump)); // jump
    box.force = box.force.add(box.momentum.scale(0.7)); // momentum trail
  }

  if (box.jump > 0) { box.jump -= 0.015; } // jump fade out
  if (box.jump > 0.01 && box.jump < 0.02) {box.jumpHit = true;}



  if (moveAroundMode) {
    box.force = box.force.add(
        characterCamera.camDirection
            .normalize()
            .scale(
                (box.characterSpeed - (box.characterSpeed * box.resistance)) * characterCamera.factor * 0.6       // ----------- Speed adjust
            )
    ); // camera push and resistance
  }

  //box.force = box.force.add(box.momentum.scale(0.9)); // buoyancy sine (      breathing)

  // keyboard rotation
  if(aKeyPressed){box.rotation.y -= box.characterSpeed * 3 * Math.PI / 180;}
  if(dKeyPressed){box.rotation.y += box.characterSpeed * 3 * Math.PI / 180;}

  // get direction the character is looking
  box.lookingDirectionOld = box.lookingDirection; 
  box.lookingDirection = (box.rotation.y * 180 / Math.PI) + 270;
  box.lookingDirection = box.lookingDirection < 0 ? 360 + box.lookingDirection : box.lookingDirection;
  box.lookingDirectionDelta = box.lookingDirectionOld - box.lookingDirection;

  lowerTorso.rotation.z = -percentageDistance/40 * Math.PI / 180;


  // Create the direction vector
  box.directionVector = new BABYLON.Vector3(-Math.sin(BABYLON.Tools.ToRadians(box.lookingDirection)), 0,-Math.cos(BABYLON.Tools.ToRadians(box.lookingDirection))).normalize();
  if(wKeyPressed){box.force = box.force.add(box.directionVector.scale((1 - (1 * box.resistance)) * characterCamera.factor))};
  if(sKeyPressed){box.force = box.force.add(box.directionVector.scale((1 - (1 * box.resistance)) * -characterCamera.factor))};

  box.momentum = box.force; // set new momentum trail
  if (box.force.length() > 1.8) {box.force = box.force.normalize().scale(1.8);} // cap the force vector
  box.projectedPosition = box.projectedPosition.add(box.force.scale(0.7)); // resolve the forces acting upon it and last scaler















  // keep out of the ground
  if(box.projectedPosition.y < ground.getHeightAtCoordinates(box.projectedPosition.x, box.projectedPosition.z) + box.characterHeight)
    {
      box.projectedPosition.y=ground.getHeightAtCoordinates(box.projectedPosition.x, box.projectedPosition.z) + box.characterHeight;  //  don't hit the ground
    }


    if(!wKeyPressed&&!aKeyPressed&&!sKeyPressed&&!dKeyPressed){keyMode=false;}

  if (moveAroundMode || !scene.varInitMove || keyMode) {

    if(!scene.varSmallInitMove){
      scene.beginAnimation(lowerTorso, 0, 60, true);
      scene.beginAnimation(leftUpperLeg, 0, 60, true);
      scene.beginAnimation(rightUpperLeg, 0, 60, true);
      scene.beginAnimation(upperTorso, 0, 60, true);
      scene.beginAnimation(leftLowerLeg, 0, 60, true);
      scene.beginAnimation(rightLowerLeg, 0, 60, true);
      scene.beginAnimation(leftUpperArm, 0, 60, true);
      scene.beginAnimation(rightUpperArm, 0, 60, true);
      scene.beginAnimation(leftLowerArm, 0, 20, true);
      scene.beginAnimation(rightLowerArm, 0, 20, true);
      scene.beginAnimation(head, 0, 60, true);
      box.isWalking = true;
      box.stands=false;
      scene.idle=false;
      scene.varSmallInitMove=true;
    }

    if(box.characterSpeed < 1.0){box.characterSpeed += 0.07}; //  speed up to normal ground speed


  
      
      //Lock Square
    if(Math.sqrt(box.projectedPosition.x * box.projectedPosition.x + box.projectedPosition.z * box.projectedPosition.z)<800){
      if(box.projectedPosition.z > 620){box.position.x=box.projectedPosition.x}else{
        //  box.position = box.projectedPosition;
      }
    }

    if(moveAroundMode){
     box.rotation.y=characterCamera.rotation.y + -90*Math.PI/180;
    }





  if(!scene.varInitMove){scene.varInitMove=true;}
  }


  if(!moveAroundMode&&!keyMode){
    scene.stopAnimation(lowerTorso);
    scene.stopAnimation(leftUpperLeg);
    scene.stopAnimation(rightUpperLeg);
    scene.stopAnimation(upperTorso);
    scene.stopAnimation(leftLowerLeg);
    scene.stopAnimation(rightLowerLeg);
    scene.stopAnimation(leftUpperArm);
    scene.stopAnimation(rightUpperArm);
    scene.stopAnimation(head);
    scene.stopAnimation(leftLowerArm);
    scene.stopAnimation(rightLowerArm);
    scene.varSmallInitMove=false;
    box.characterSpeed=0.0;
    lowerTorso.rotation.z = 0;
    box.isWalking = false;
    box.stands = true;
  }
  
  
  //borders
  
  //plateaus
  
  /** 
  plateauArray.forEach(plateau => {
    if(box.projectedPosition.x <= plateau.xMax && box.projectedPosition.x >= plateau.xMin && box.projectedPosition.z >= plateau.zMin && box.projectedPosition.z <= plateau.zMax)
      {box.projectedPosition.y=plateau.position.y+1.5;}
  });
  
  let plateaus = [
    { xMax: -161.0, xMin: -519.0, zMax: 800.0, zMin: 745.5, yHigh: 43.35 },
    ];
  
    plateaus.forEach(plateau => {
      if(box.projectedPosition.x <= plateau.xMax && box.projectedPosition.x >= plateau.xMin && box.projectedPosition.z >= plateau.zMin && box.projectedPosition.z <= plateau.zMax)
        {box.projectedPosition.y = plateau.yHigh+1.5; console.log("now");}
    });
  */
  //walls
  
        // despawn stuff out of reach
  return;
}



function character_trails() {

  const rayStart = new BABYLON.Vector3(box.position.x, 200, box.position.z);
  const rayDir = new BABYLON.Vector3(0, -1, 0);
  box.ray = new BABYLON.Ray(rayStart, rayDir, 500); 
  box.ocean_hit = box.ray.intersectsMesh(ocean, false);

  if (box.ocean_hit && box.ocean_hit.hit) {
      box.distance_surface = box.ocean_hit.pickedPoint.y - box.position.y;
      box.splashPlane.position = box.position.clone();
      box.splashPlane.position.y = box.ocean_hit.pickedPoint.y + 0.1;
  }

  const point1 = new BABYLON.Vector3(box.position.x,ground.getHeightAtCoordinates(box.position.x, box.position.z),box.position.z);
  const point2 = new BABYLON.Vector3(box.projectedPosition.x,ground.getHeightAtCoordinates(box.projectedPosition.x, box.projectedPosition.z),box.projectedPosition.z);
  const direction = point2.subtract(point1);
  const horizontalDistance = Math.sqrt(direction.x ** 2 + direction.z ** 2);
  const rotationX = Math.atan2(direction.y, horizontalDistance);

  function placeFootPlane(footPlaneIndex, position) {
      const plane = box.footPlanes[footPlaneIndex];
      plane.position = position.clone();
      plane.position.y = ground.getHeightAtCoordinates(position.x, position.z) + 0.15;
      plane.rotation.y = box.rotation.y + Math.PI / 2;
      plane.rotation.x = -rotationX + Math.PI / 2;
  }

  const rightFootIndices = [2, 4, 6, 8, 10];
  const leftFootIndices  = [1, 3, 5, 7, 9];

  if (rightUpperLeg.rotation.x > 0 && box.leftLegLock && box.isWalking && !box.isSwimming) {

      placeFootPlane(rightFootIndices[box.footPlaneCounter], box.position);

      box.footPlaneCounter++;
      if (box.footPlaneCounter >= rightFootIndices.length) {box.footPlaneCounter = 0;}

      box.rightLegLock = true;
      box.leftLegLock  = false;
  }

  if (leftUpperLeg.rotation.x > 0 && !box.leftLegLock && box.isWalking && !box.isSwimming) {
      const index = leftFootIndices[box.footPlaneCounter];
      placeFootPlane(index, box.position);
      box.leftLegLock  = true;
      box.rightLegLock = false;
  }

  if (box.jumpHit) {
    box.footPlanes[11].position = box.position.clone();
    box.footPlanes[11].position.y = ground.getHeightAtCoordinates(box.position.x, box.position.z) + 0.15;
    box.footPlanes[11].rotation.y = box.rotation.y + Math.PI / 2;
    box.footPlanes[11].rotation.x = -rotationX + Math.PI / 2;

    box.footPlanes[12].position = box.position.clone();
    box.footPlanes[12].position.y = ground.getHeightAtCoordinates(box.position.x, box.position.z) + 0.15;
    box.footPlanes[12].rotation.y = box.rotation.y + Math.PI / 2;
    box.footPlanes[12].rotation.x = -rotationX + Math.PI / 2;

      box.jumpHit = false;
  }
}





function resolve_character(){
  box.position = box.projectedPosition;
  scene.varSunToBoxDirection = box.position.subtract(sunLight.position).normalize(); // this gets the direction vector from the sun to the box
  light.position = box.position.subtract(scene.varSunToBoxDirection.scale(1000)); // puts the Shadow Creating Light half way from box to sun
  light.position.y += 600;
  light.direction = box.position.subtract(light.position).normalize(); // make the shadow light look at the box

  lowerTorso.position = box.position.clone();
  lowerTorso.rotation.y = box.rotation.y + Math.PI / 2;
  




  // bouncy step
  if(moveAroundMode || keyMode && !box.isSwimming){
    lowerTorso.bouncyFrame = (lowerTorso.bouncyFrame + 1) % 30; // Loop back after X frames
    lowerTorso.position.y += 0.1 * Math.sin(lowerTorso.bouncyFrame / 30 * 2 * Math.PI); // Calculate the sinusoidal value
  }

  // breathing bouyancy underwater
  if(box.isSwimming){
    lowerTorso.bouyancyFrame = (lowerTorso.bouyancyFrame + 1) % 300; // Loop back after X frames
    lowerTorso.position.y += 0.5 * Math.sin(lowerTorso.bouyancyFrame / 300 * 2 * Math.PI); // Calculate the sinusoidal value

    
    if(lowerTorso.rotation.x<1.29){lowerTorso.rotation.x = box.waterUnderKeel * 20 * Math.PI / 180;}
  } else {
    lowerTorso.rotation.x = 0 * Math.PI / 180;
  }







    box.groundUnderFeet = box.position.y - ground.getHeightAtCoordinates(box.position.x, box.position.z) - box.characterHeight;

if(box.groundUnderFeet>0.2 && !box.isSwimming){

rightUpperLeg.rotation.x = -box.groundUnderFeet*6* Math.PI / 180;
rightUpperLeg.rotation.z = box.groundUnderFeet*0.5* Math.PI / 180;

rightUpperLeg.position.y = (box.groundUnderFeet/20)-0.68;
rightUpperLeg.position.z = (box.groundUnderFeet/30);
rightUpperLeg.position.x = (box.groundUnderFeet/70)+0.38;

leftUpperLeg.rotation.x = -box.groundUnderFeet*6* Math.PI / 180;
leftUpperLeg.rotation.z = -box.groundUnderFeet*0.5* Math.PI / 180;

leftUpperLeg.position.y = (box.groundUnderFeet/20)-0.68;
leftUpperLeg.position.z = (box.groundUnderFeet/30);
leftUpperLeg.position.x = (-box.groundUnderFeet/70)-0.38;

rightLowerLeg.rotation.x = box.groundUnderFeet*9* Math.PI / 180;
leftLowerLeg.rotation.x = box.groundUnderFeet*9* Math.PI / 180;

lowerTorso.rotation.x = box.groundUnderFeet*2* Math.PI / 180;

rightUpperArm.rotation.z = box.groundUnderFeet*3* Math.PI / 180;
leftUpperArm.rotation.z = -box.groundUnderFeet*3* Math.PI / 180;

box.isWalking = false;
} else {
box.isWalking = true;
}

if(box.groundUnderFeet>7){

}


  if(!scene.idle&&box.stands){
    scene.idleCounter++;
    //console.log(scene.idle);
    if(scene.idleCounter>300){
      scene.idle=true;
      scene.idleCounter=0;
      //console.log(scene.idle);
    }
  }

  if (scene.idle) {
    if (scene.idleCounter > 2999) {
      scene.idleCounter = 0;
    }
  
    let t = scene.idleCounter / 100; // Skaliere auf langsamen Takt
    let amplitude = 0.05; // Max. Rotation in Radians (~2.8 Grad)
  
    upperTorso.rotation.x = Math.sin(t) * amplitude;
    upperTorso.rotation.z = Math.cos(t * 0.7) * amplitude * 0.8;
  
    scene.idleCounter++;
  }

  return;
}









function resolve_camera(){
  




cameraPosition = new BABYLON.Vector3(
  cameraRadius * Math.sin(characterCamera.beta) * Math.cos(characterCamera.alpha),
  cameraRadius * Math.cos(characterCamera.beta),
  cameraRadius * Math.sin(characterCamera.beta) * Math.sin(characterCamera.alpha));

characterCamera.position = cameraPosition.add(box.position);
characterCamera.setTarget(box.position);
    
      characterCamera.position.y += 1.5;

      // Do not let camera into the Ground
      if(characterCamera.position.y < ground.getHeightAtCoordinates(characterCamera.position.x, characterCamera.position.z)+0.5)
        {
          characterCamera.position.y=ground.getHeightAtCoordinates(characterCamera.position.x, characterCamera.position.z)+0.5;
        }


    // HERE IS THE WATERSURFACE FLIP STUFF (waterMesh is the underwater)
    if(characterCamera.position.y<scene.varTidenhub+1.0){
      if(characterCamera.submerged==false){
        ocean.isVisible=false;
        sun.isVisible=false;
        flare01.size=0.0;
        flare05.size=0.0;
        flare06.size=0.0;
        flare03.size=0.0;
        ground.material.setFloat("vFogStart", 1.0);
        ground.material.setFloat("vFogEnd", 20.0);
        ground.material.setFloat("vFogYes", 1.0);
        ground.material.setColor3("vFogColor", new BABYLON.Color3(76/255*scene.varRatio, 159/255*scene.varRatio, 165/255*scene.varRatio));
        scene.fogColor = new BABYLON.Color3(76/255*scene.varRatio, 159/255*scene.varRatio, 165/255*scene.varRatio);
        scene.fogEnabled = true;
        starSphere.isVisible=false;
        ground.material.setFloat("vCausticsYes", 1.0);
        surface.isVisible=true;
        characterCamera.submerged = true;
        sound.stop();
      }
    } else {

      if(characterCamera.submerged==true){
        ocean.isVisible=true;
        sun.isVisible=true;
        flare01.size=0.0;
        flare05.size=0.0;
        flare06.size=0.0;
        flare03.size=0.0;





        ground.material.setFloat("vFogStart", 10);
        ground.material.setFloat("vFogEnd", 100);
        ground.material.setFloat("vFogYes", 0.0);
        scene.fogEnabled = false;
        starSphere.isVisible=true;
        surface.isVisible=false;
        //volumetricSystem.worldOffset.y=-1000;
        //lowerTorso.rotation.x = 0.0 * Math.PI / 180;
        ground.material.setFloat("vCausticsYes", 0.0);
        characterCamera.submerged = false;
        setTimeout(() => {
   
          if (sound.isReady()) sound.play(); // Play the sound if ready
      }, 5000);
      }
      ocean.material.setFloat("u_Time", scene.varTime*.01); // ocean shader
      ocean.material.setFloat("myColorMixFactorOcean", 0.7+(0.2-0.7)*(1-scene.varRatio));
      ocean.material.setFloat("myColorMixFactorStorm", scene.varStormSeaFactorIST);
    }


    hudCam.position = characterCamera.position.clone();
    var forward = characterCamera.getForwardRay().direction;
    forward.scaleInPlace(20); // Ändere diesen Wert, um die Distanz vor der Kamera anzupassen. 2 ist hier nur ein Beispielwert.
    hudCam.position.addInPlace(forward);
    hudCam.lookAt(characterCamera.position);











    if (grabbedShell) {
      const pick = scene.pick(scene.pointerX, scene.pointerY, mesh => mesh.name === "DragPlane");
      if (pick.hit) {
        const newPos = pick.pickedPoint.clone();
        if (previousPosition) {
          dragVelocity = newPos.subtract(previousPosition);
        }
        grabbedShell.position = newPos;
        previousPosition = newPos.clone();

        if (!Array.isArray(previousPositions)) {
          previousPositions = [];
        }

        previousPositions.push(newPos.clone());

// Nur die letzten 4 Positionen behalten
if (previousPositions.length > 12) {
  previousPositions.shift(); // älteste entfernen
}

if (previousPositions.length >= 2) {
  dragVelocity = previousPositions[previousPositions.length - 1]
    .subtract(previousPositions[0]);

  console.log("🚀 final dragVelocity (4-frame momentum):", dragVelocity);
}


      }
    }
  
    //console.log("releasedShells?", releasedShells);
    //console.log("typeof:", typeof releasedShells);
    //console.log("Array?", Array.isArray(releasedShells));
    

    if (Array.isArray(releasedShells)) {
      for (let shell of releasedShells) {
        if (!shell?.sprite || !shell?.velocity) continue;
    
        shell.sprite.position.addInPlace(shell.velocity);
        shell.velocity.scaleInPlace(0.99998);
        shell.velocity.y -= 0.004;
    
        if (shell.sprite.position.y < -10) {
          shell.sprite.dispose();
          shell.disposed = true;
        }
      }
    
      releasedShells = releasedShells.filter(shell => !shell.disposed);
    }
    







}


































// ################################################################################################################### //
// ################################################ EVENT LISTENERS ################################################## //
// ################################################################################################################### //

scene.onPointerObservable.add((pointerInfo) => {
  const isRightButton = pointerInfo.event.button === 2;
  const isLeftButton = pointerInfo.event.button === 0;

  switch (pointerInfo.type) {
      case BABYLON.PointerEventTypes.POINTERDOWN:
          if (isRightButton) rightButtonDown = true;
          if (isLeftButton) leftButtonDown = true;
          break;

      case BABYLON.PointerEventTypes.POINTERUP:
          if (isRightButton) rightButtonDown = false;
          if (isLeftButton) leftButtonDown = false;
          break;
  }
if (leftButtonDown && rightButtonDown) {moveAroundMode = true;} else if (rightButtonDown) {lookAroundMode = true;} else {moveAroundMode = false;lookAroundMode = false;}
});




canvas.addEventListener("pointermove", function (event) {
  let canvasWidth = canvas.width;

  // Get the mouse position relative to the canvas
  let mouseX = event.clientX - canvas.getBoundingClientRect().left;

  // Calculate the distance from the center of the canvas
  let centerX = canvasWidth / 2;
  let distanceFromCenter = mouseX - centerX;

  // Calculate the percentage distance from the center
  percentageDistance = (distanceFromCenter / centerX) * 100;

  if (!lookAroundMode) return;
  const deltaX = event.movementX || 0;
  const deltaY = event.movementY || 0;
  const rotationSpeed = 0.005;
  characterCamera.alpha -= deltaX * rotationSpeed;
  characterCamera.beta -= deltaY * rotationSpeed;
  characterCamera.beta = Math.max(Math.min(characterCamera.beta, Math.PI - 0.01), 0.01);
});




canvas.addEventListener("wheel", function (event) {
  var zoomAmount = event.deltaY * -zoomSpeed;
  cameraRadius = Math.max(Math.min(cameraRadius - zoomAmount, cameraRadiusMax), cameraRadiusMin);
}, { passive: true });


window.addEventListener("keydown", function (evt) {
if (evt.keyCode === 81) {panel.isVisible = !panel.isVisible;        // Toggle the debug layer
if (scene.debugLayer.isVisible()) {
    scene.debugLayer.hide();
} else {
    scene.debugLayer.show({ embedMode: true });
}} // 'Q'
if (evt.keyCode === 87) {wKeyPressed = true; keyMode=true;} // 'W'
if (evt.keyCode === 65) {aKeyPressed = true; keyMode=true;} // 'A'
if (evt.keyCode === 83) {sKeyPressed = true; keyMode=true;} // 'S'
if (evt.keyCode === 68) {dKeyPressed = true; keyMode=true;} // 'D'

if (evt.keyCode === 32) { if(box.jump <= 0.0 && box.groundUnderFeet<1.0) {box.jump += box.jumpValue;} } // 'spacebar jump'

});

window.addEventListener("keyup", function (evt) {
  if (evt.keyCode === 87) {wKeyPressed = false;} // 'W'
  if (evt.keyCode === 65) {aKeyPressed = false;} // 'A'
  if (evt.keyCode === 83) {sKeyPressed = false;} // 'S'
  if (evt.keyCode === 68) {dKeyPressed = false;} // 'D'
});

document.getElementById('renderCanvas').addEventListener('focus', function() { this.style.outline = 'none'; }); // removes focus outline

window.addEventListener("resize", function () {if (engine) {engine.resize();}});


// ################################################################################################################### //
// ############################################# INTERACT FUNCTIONS ################################################## //
// ################################################################################################################### //


/**
function spawnTriviaMonacha() {
  if(groundIsLoaded){

    //var triviaMonacha = new BABYLON.SpriteManager("TriviaMonacha", "./graphics/triviaMonacha.png", 10, {width: 120, height: 120}, scene); // totalframes, width, height
    var triviaMonachaSprite = new BABYLON.Sprite("TriviaMonachaSprite", triviaMonacha);

    triviaMonachaSprite.cellIndex = Math.floor(Math.random() * 10);

    const baseSize = 0.4; // 1/5th of 120 pixels
    const sizeVariation = baseSize * (0.9 + Math.random() * 0.2); // 0.9 to 1.1 factor
    triviaMonachaSprite.size = sizeVariation;

    triviaMonachaSprite.angle = Math.random() * Math.PI * 2; // Random angle in radians

    
    // Random position near the player
    let randomX = box.position.x + (Math.random() - 0.5) * 10;
    let randomZ = box.position.z + (Math.random() - 0.5) * 10;
    let y = ground.getHeightAtCoordinates(randomX, randomZ)+0.1; // Get the y-coordinate from the ground
      
    triviaMonachaSprite.position = new BABYLON.Vector3(randomX, y, randomZ);

    triviaMonachaSprite.isPickable = true;

    triviaMonacha.isPickable = true;


        // Add the sprite and its manager to the seaShells array
    seaShells.push({triviaMonachaSprite});

/** 
                // Add the sprite and its manager to the seaShells array
                seaShells.push({
                  sprite: triviaMonachaSprite,
                  manager: triviaMonacha
                });
  }
}
*/

function spawnPopUpText(position, text) {
  let textBlock = new BABYLON.GUI.TextBlock();
  textBlock.text = text;
  textBlock.color = "white";
  textBlock.fontSize = 24;
  advancedTexture.addControl(textBlock);

  // Convert the 3D position to a 2D position
  var projectedPosition = BABYLON.Vector3.Project(
      position,
      BABYLON.Matrix.Identity(),
      scene.getTransformMatrix(),
      scene.activeCamera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
  );

  textBlock.left = projectedPosition.x - engine.getRenderWidth() / 2;
  textBlock.top = -projectedPosition.y + engine.getRenderHeight() / 2;

  // Animate the textBlock
  var animation = new BABYLON.Animation("popUpTextAnimation", "top", 60, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
  var keys = []; 
  keys.push({ frame: 0, value: textBlock.top });
  keys.push({ frame: 30, value: textBlock.top - 100 }); // Move up
  animation.setKeys(keys);

  var fadeAnimation = new BABYLON.Animation("fadeAnimation", "alpha", 60, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
  var fadeKeys = [];
  fadeKeys.push({ frame: 0, value: 1 });
  fadeKeys.push({ frame: 30, value: 0 }); // Fade out
  fadeAnimation.setKeys(fadeKeys);

  scene.beginDirectAnimation(textBlock, [animation, fadeAnimation], 0, 30, false, 1, () => {
      advancedTexture.removeControl(textBlock); // Cleanup after animation
  });
}








scene.onPointerUp = function (evt) {
  if (grabbedShell) {
    grabbedShell.parent = null; // Loslösen aus dem HUD
    grabbedShell.isPickable = false;

    // safe fallback
    if (!dragVelocity) dragVelocity = new BABYLON.Vector3(0, 0, 0);

    let launchVelocity = dragVelocity.clone().scale(0.05);
    launchVelocity.y -= 0.002;


  
    if (shellThrowSound && shellThrowSound.isReady()) {
      shellThrowSound.play();
    }

    releasedShells.push({
      sprite: grabbedShell,
      velocity: launchVelocity
    });
  }

  grabbedShell = null;
  previousPosition = null;
  //dragVelocity = BABYLON.Vector3.Zero();
};












// clicking on pickable clickables
scene.onPointerDown = function (evt) {

  var pickResult = scene.pickSprite(this.pointerX, this.pointerY);
  //console.log(pickResult);
  if (pickResult.hit) {

    //console.log(pickResult.pickedSprite);

      spawnPopUpText(pickResult.pickedSprite.position, "+1");


      //changeWeather(weatherValues[Math.floor(Math.random() * weatherValues.length)]);
      //changeWeather(Weather.breeze);
      //createNewSystem();

      // Despawn the sprite or your logic here


      grabbedShell = pickResult.pickedSprite;
      //console.log(grabbedShell);


      grabbedShell.width = grabbedShell.width * 5;
      grabbedShell.height = grabbedShell.height * 5;

      grabbedShell.renderingGroupId = 2;


      seaShells = seaShells.filter(item => item._seaShellSprite.uniqueId !== pickResult.pickedSprite.uniqueId);
      //pickResult.pickedSprite.angle =0;
      //pickResult.pickedSprite.parent = hudCam;


      //pickResult.pickedSprite.position = characterCamera.position.clone();
      //var forward = characterCamera.getForwardRay().direction;
      //forward.scaleInPlace(2); // Ändere diesen Wert, um die Distanz vor der Kamera anzupassen. 2 ist hier nur ein Beispielwert.
      //pickResult.pickedSprite.position.addInPlace(forward);
      //hollowShellSprite=pickResult.pickedSprite;


      if(pickResult.pickedSprite.cellIndex<32){
        spawnPopUpText(box.position, "yeah!");
      }



      //pickResult.pickedSprite.position.y +=1;
      //pickResult.pickedSprite.dispose();
  }






  // clicking the HUD
  var pickResultMesh = scene.pick(this.pointerX, this.pointerY);

  spawnPopUpText(pickResultMesh.pickedMesh.position, pickResultMesh.pickedMesh.name);

  if (pickResultMesh.pickedMesh.name === "HudArrowIcon") {
    camActive = !camActive;
    hudChar.position.y += camActive ? 3 : -3;
    let textureScale = camActive ? -1 : 1;
    hudArrowIcon.material.diffuseTexture.vScale = textureScale;
    hudArrowIcon.material.emissiveTexture.vScale = textureScale;
  }

  if (pickResultMesh.pickedMesh.name === "HudJournal") {
    journalActive = !journalActive;
    hudCoastalExplorer.isVisible=!hudCoastalExplorer.isVisible;
    console.log("what");
  }






  
/**


  if (pickResultMesh.pickedMesh.name === "HudArrowIcon") {
    if(!camActive){
      hudChar.position.y+=2;
      camActive=true;
      hudArrowIcon.material.diffuseTexture.vScale = -1;
      hudArrowIcon.material.emissiveTexture.vScale = -1;
    } else if (camActive){
      hudChar.position.y-=2;
      camActive=false;
      hudArrowIcon.material.diffuseTexture.vScale = 1;
      hudArrowIcon.material.emissiveTexture.vScale = 1;
    }

}
 */

};





function getRandomPointOnSphere(sphereCenter, sphereRadius) {
    var theta = Math.random() * Math.PI; // Zufälliger Winkel von 0 bis π
    var phi = Math.random() * 2 * Math.PI; // Zufälliger Winkel von 0 bis 2π

    // Umwandlung von sphärischen in kartesische Koordinaten
    var x = sphereCenter.x + sphereRadius * Math.sin(theta) * Math.cos(phi);
    var y = sphereCenter.y + sphereRadius * Math.sin(theta) * Math.sin(phi);
    var z = sphereCenter.z + sphereRadius * Math.cos(theta);

    return new BABYLON.Vector3(x, y, z);
};