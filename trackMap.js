/*
 * Copyright (C) 2020 Microchip Technology Inc.  All rights reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

 // create two-dimensional array to hold the track
var trackShape = new Array([[],[]])

var startFound = false;
var mapX = 0;
var mapY = 0;
var mapDir = 0;
var trackMapDone = false;

// based upon the new coordinate in world space resize the map
// to accomodate the new data, shifting the existing data
// as required
function updateTrackShape() {
  if (mapX < 0) {
    for (var i = 0; i < trackShape.length; i++) {
      trackShape[i].unshift(0);
    }
    mapX = 0;
  }
  if (mapY < 0) {
    var newRow = new Array(trackShape[0].length);
    for (var i = 0; i < trackShape[0].length; i++) {
      newRow[i] = 0;
    }
    trackShape.unshift(newRow);
    mapY = 0;
  }
  if (trackShape.length <= mapY) {
    var newRow = new Array(trackShape[0].length);
    for (var i = 0; i < trackShape[0].length; i++) {
      newRow[i] = 0;
    }
    trackShape.push(newRow);
  }
  if (trackShape[mapY].length <= mapX) {
    for (var i = 0; i < trackShape.length; i++) {
      trackShape[i].push(0);
    }
  }
}

// track types encoded into 4-bits
const TRACK_EMPTY           = 0x00;
const TRACK_START_FINISH    = 0x01; // the start finish straight is always east-west aligned (heading east)
const TRACK_STRAIGHT_HORIZ  = 0x02;
const TRACK_STRAIGHT_VERT   = 0x03;
const TRACK_CURVE_NE        = 0x04; // curve heading North->East
const TRACK_CURVE_ES        = 0x05; // curve heading East->South
const TRACK_CURVE_WN        = 0x06; // curve heading West->North
const TRACK_CURVE_SW        = 0x07; // curve heading South->West
const TRACK_CROSSOVER       = 0x08; // crossover 


// Building a track array:
// 0 - No track
// 1 - Start/Finish 
// 2 - Straight Horizontal
// 3 - Straight Vertical
// 4 - Curve - North -> East (West -> South)
// 5 - Curve - East -> South (North -> West)
// 6 - Curve - West -> North (South -> East)
// 7 - Curve - South -> West (East -> North)
// 8 - Straight Horizontal over Vertical
// 9 - Straight Vertical over Horizontal
//10 - Two Curve - West -> North AND East -> South
//11 - Two Curve - South -> West AND North -> East
//12 - Curve - North -> East over Vertical
//13 - Curve - North -> West over Vertical
//14 - Curve - South -> East over Vertical
//15 - Curve - South -> West over Vertical
//16 - Curve - North -> East over Horizontal
//17 - Curve - North -> West over Horizontal
//18 - Curve - South -> East over Horizontal
//19 - Curve - South -> West over Horizontal
//20 - Crossover - No change in direction
//21 - Two Curve - West -> North AND North -> East
//22 - Two Curve - South -> West AND East -> South
//23 - Two Curve - East -> South AND North -> East
//24 - Two Curve - South -> West AND West -> North
// I just don't deal with straight over curve...
var addTrackToMap = function (trackId, clockwise) {

  // The following IDs are considered as straights for mapping purposes:
  //   43 = Jump piece (part of Launch Kit)
  //   46 = Landing piece (part of Launch Kit)

  const trackTypes = [
    "unknown", "unknown", "unknown", "unknown", "unknown", "unknown", "unknown", "unknown", "unknown", "unknown", //  0- 9
    "Crossover", "Turn", "unknown", "unknown", "unknown", "unknown", "unknown", "Turn", "Turn", "unknown", // 10-19
    "Turn", "unknown", "unknown", "Turn", "unknown", "unknown", "unknown", "unknown", "unknown", "unknown", // 20-29
    "unknown", "unknown", "unknown", "Start", "Finish", "unknown", "Straight", "unknown", "unknown", "Straight", // 30-39
    "Straight", "unknown", "unknown", "Straight", "unknown", "unknown", "Straight", "unknown", "unknown", "unknown" // 40-49
  ];

  var trackType = trackTypes[trackId];
  if (trackType == "Start") {
    if (startFound == true) { // We've already done the whole map.
      trackMapDone = true;
      return;
    }
    startFound = true;
    trackShape[mapY][mapX] = TRACK_START_FINISH;
    mapDir = 1; // East
    mapX += 1;
    updateTrackShape();
  }

  if (startFound == false) {
    return;
  }

  console.log("Found track type[" + trackId + "]: " + trackType);

  // get the current contents of the map
  var currentMapTile = trackShape[mapY][mapX] & 0x0F;
  var currentMapX = mapX;
  var currentMapY = mapY;
  var newMapTile = 0;

  // calculate the tile type to place on the map
  if (trackType == "Straight") {
    switch(mapDir) {
      case 0:
        newMapTile = TRACK_STRAIGHT_VERT;
        mapY -= 1;
        break;
      case 2:
        newMapTile = TRACK_STRAIGHT_VERT;
        mapY += 1;
        break;
      case 1:
        newMapTile = TRACK_STRAIGHT_HORIZ;
        mapX += 1;
        break;
      case 3:
        newMapTile = TRACK_STRAIGHT_HORIZ;
        mapX -= 1;
        break;
    }
  }

  if (trackType == "Turn") {
    if (clockwise) {
      // right hand turns
      switch (mapDir) {
        case 0:
          newMapTile = TRACK_CURVE_NE;
          mapDir = 1;
          mapX += 1;
          break;
        case 1:
          newMapTile = TRACK_CURVE_ES;
          mapDir = 2;
          mapY += 1;
          break;
        case 2:
          newMapTile = TRACK_CURVE_SW;
          mapDir = 3;
          mapX -= 1;
          break;
        case 3:
          newMapTile = TRACK_CURVE_WN;
          mapDir = 0;
          mapY -= 1;
          break;  
      }
    } else {
      // left hand turns
      switch (mapDir) {
        case 0:
          newMapTile = TRACK_CURVE_ES;
          mapDir = 3;
          mapX -= 1;
          break;
        case 1:
          newMapTile = TRACK_CURVE_SW;
          mapDir = 0;
          mapY -= 1;
          break;
        case 2:
          newMapTile = TRACK_CURVE_WN;
          mapDir = 1;
          mapX += 1;
          break;
        case 3:
          newMapTile = TRACK_CURVE_NE;
          mapDir = 2;
          mapY += 1;
          break;
      }
    }
  }

  if (trackType == "Crossover") {
    newMapTile = TRACK_CROSSOVER;

    switch (mapDir) {
      case 0:
        mapY -= 1; 
        break;
      case 1:
        mapX += 1;
        break;
      case 2:
        mapY += 1;
        break;
      case 3:
        mapX -= 1;
        break;
    }
  }

  if (currentMapTile == TRACK_EMPTY) {
    // empty map location currently so just store the contents
    trackShape[currentMapY][currentMapX] = newMapTile;
  } else if (currentMapTile == TRACK_CROSSOVER) {
    // crossover so don't change the existing piece
  } else {
    // map already has a piece at this location 
    // bit shift the tile and place on the map
    newMapTile = newMapTile << 4;
    newMapTile = newMapTile | currentMapTile;
    trackShape[currentMapY][currentMapX] = newMapTile;
  }

  // resize the track shape if required
  updateTrackShape();

  if (trackType == "unknown") {
    console.log("Unknown type: ", trackId);
  }
  console.log("New Track Shape: ", trackShape);
}

var isTrackMapDone = function () {
  return trackMapDone;
}

var setTrackMapDone = function () {
  trackMapDone = true;
}

var resetTrackMap = function () {
  trackMapDone = false;
  startFound = false;
  mapX = 0;
  mapY = 0;
  mapDir = 0;
  trackShape = new Array(1);
  trackShape[0] = new Array(1);
}

var getTrackMapData = function () {
  return trackShape;
}

var setTrackMapData = function (newMap) {
  trackShape = newMap;
}

// map possible tile values into bitmap indexes, the location of the tile type
// in this array indicates which bitmap should be used to represent the tile
const mapTrackImages = [
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x23, 0x32, 0x47, 0x65, 
  0x43, 0x53, 0x63, 0x73, 0x42, 0x52, 0x62, 0x72, 0x08, 0x67, 0x54, 0x46,
  0x75
];

// return an array contianing the names of the images
var getTrackMapImageNames = function() {
  // copy the data to match the dimensions, data will be replaced
  var trackShapeImageIndexes = JSON.parse(JSON.stringify(trackShape));

  console.log("Before: " + trackShape);
  var trackImageIndex = 0;
  var trackImage = 0;
  for (var x = 0; x < trackShape[0].length; x++) {
    for (var y = 0; y < trackShape.length; y++) {
      // get the appropriate index for a given shape
      trackImageIndex = trackShape[y][x];
      trackImage = mapTrackImages.indexOf(trackImageIndex);
      if (trackImage == -1) trackImage = 0;
      trackShapeImageIndexes[y][x] = trackImage;
    }
  }
  console.log("After: " + trackShape);
  return trackShapeImageIndexes;
}

// return a single canvas containing a compound image
var getTrackMapImage = function (size) {
  var Canvas = require('canvas');
  var Image = Canvas.Image;

  var segmentImages = new Array(25);
  for(var i = 0; i < 25; i++) {
    segmentImages[i] = new Image;
    segmentImages[i].src = "images/" + size + "/" + i + ".png";
  }

  var segmentSize = 0;
  if (size == 'small') { segmentSize = 64; }
  if (size == 'medium') { segmentSize = 128; }
  if (size == 'large') { segmentSize = 256; }

  var imgSizeY = trackShape.length * segmentSize;
  var imgSizeX = trackShape[0].length * segmentSize;

  var canvas = new Canvas.createCanvas(imgSizeX, imgSizeY);
  var ctx = canvas.getContext('2d');
  var trackImageIndex = 0;
  var trackImage = 0;
  for (var x = 0; x < trackShape[0].length; x++) {
    for (var y = 0; y < trackShape.length; y++) {
      // get the appropriate index for a given shape
      trackImageIndex = trackShape[y][x];
      trackImage = mapTrackImages.indexOf(trackImageIndex);
      if (trackImage == -1) trackImage = 0;
      ctx.drawImage(segmentImages[trackImage], x * segmentSize, y * segmentSize)
    }
  }
  return (canvas);
}

module.exports = function () {
  return {
    addTrackToMap: addTrackToMap,
    isTrackMapDone: isTrackMapDone,
    setTrackMapDone: setTrackMapDone,
    resetTrackMap: resetTrackMap,
    getTrackMapData: getTrackMapData,
    setTrackMapData: setTrackMapData,
    getTrackMapImageNames: getTrackMapImageNames,
    getTrackMapImage: getTrackMapImage
  }
};
