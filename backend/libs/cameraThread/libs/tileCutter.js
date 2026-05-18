function convertStringPoints(oldPoints){
    // [["0","0"],["0","150"],["300","150"],["300","0"]]
    var newPoints = []
    oldPoints.forEach((point) => {
        newPoints.push([parseInt(point[0]),parseInt(point[1])])
    })
    return newPoints
}
function makeBigMatricesFromSmallOnes(matrices){
    var bigMatrices = {}
    matrices.forEach(function(matrix,n){
        const regionName = matrix.tag
        if(!bigMatrices[regionName]){
            bigMatrices[regionName] = {
                tag: regionName,
                x: 9999999999,
                y: 9999999999,
                width: matrices.length > 1 ? matrices[0].width : 0,
                height: matrices.length > 1 ? matrices[0].height : 0,
                tilesCounted: 0,
                confidence: 0,
            }
        }
        var bigMatrix = bigMatrices[regionName];
        bigMatrix.x = bigMatrix.x > matrix.x ? matrix.x : bigMatrix.x;
        bigMatrix.y = bigMatrix.y > matrix.y ? matrix.y : bigMatrix.y;
        const newWidth = matrix.x - bigMatrix.x
        const newHeight = matrix.y - bigMatrix.y
        bigMatrix.width = bigMatrix.width < matrix.x ? newWidth === 0 ? matrix.width : newWidth : bigMatrix.width;
        bigMatrix.height = bigMatrix.height < matrix.y ? newHeight === 0 ? matrix.height : newHeight : bigMatrix.height;
        // bigMatrix.tag = matrix.tag;
        bigMatrix.confidence += matrix.confidence;
        bigMatrix.tilesCounted += 1;
    })
    let allBigMatrices = Object.values(bigMatrices)
    allBigMatrices.forEach(function(matrix,n){
        let bigMatrix = allBigMatrices[n]
        bigMatrix.averageConfidence = bigMatrix.confidence / bigMatrix.tilesCounted;
    })
    return allBigMatrices
}
function isPointInPolygon(point, polygon) {
  let x = point[0];
  let y = point[1];

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i][0], yi = polygon[i][1];
    let xj = polygon[j][0], yj = polygon[j][1];

    let intersect = ((yi > y) != (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}
function getTiles(points, tileSize, frameWidth, frameHeight) {
  // Create an array to store the tiles
  let tiles = [];

  // Iterate through each tile in the frame
  for (let x = 0; x < frameWidth; x += tileSize) {
    for (let y = 0; y < frameHeight; y += tileSize) {
      // Create an array to store the points for this tile
      let tilePoints = [        [Math.round(x), Math.round(y)],
        [Math.round(x + tileSize), Math.round(y)],
        [Math.round(x + tileSize), Math.round(y + tileSize)],
        [Math.round(x), Math.round(y + tileSize)]
      ];

      // Check if all points in the tile are inside the polygon
      let inside = true;
      for (let i = 0; i < tilePoints.length; i++) {
        if (!isPointInPolygon(tilePoints[i], points)) {
          inside = false;
          break;
        }
      }

      if (inside) {
        // If all points are inside the polygon, add the tile to the array
        tiles.push(tilePoints);
      } else {
        // If any points are outside the polygon, find the intersection points
        let intersectPoints = [];
        for (let i = 0; i < tilePoints.length; i++) {
          let p1 = tilePoints[i];
          let p2 = tilePoints[(i+1) % tilePoints.length];
          let intersect = getIntersection(p1, p2, points);
          if (intersect) {
            intersectPoints.push(intersect);
          }
        }

        // If there are at least 3 intersection points, create a new set of points for the partially inside tile
        if (intersectPoints.length >= 3) {
          tiles.push(intersectPoints);
        }
      }
    }
  }
  return tiles;
}
function getIntersection(p1, p2, points) {
  // Iterate through each side of the polygon
  for (let i = 0; i < points.length; i++) {
    let p3 = points[i];
    let p4 = points[(i+1) % points.length];

    // Check if the line segment intersects with this side of the polygon
    let intersect = getLineSegmentIntersection(p1, p2, p3, p4);
    if (intersect) {
      return intersect;
    }
  }
  return null;
}
function getLineSegmentIntersection(p1, p2, p3, p4) {
  // Calculate the intersection point using the line segment intersection formula
  let x1 = p1[0];
  let y1 = p1[1];
  let x2 = p2[0];
  let y2 = p2[1];
  let x3 = p3[0];
  let y3 = p3[1];
  let x4 = p4[0];
  let y4 = p4[1];
  let denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (denominator == 0) {
    return null;
  }
  let t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
  let u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    let x = x1 + t * (x2 - x1);
    let y = y1 + t * (y2 - y1);
    return [parseInt(x), parseInt(y)];
  }
  return null;
}
function convertRegionsToTiles(monitorDetails){
    process.logData(`Building Accuracy Mode Detection Tiles...`)
    const width = parseInt(monitorDetails.detector_scale_x) || 640
    const height = parseInt(monitorDetails.detector_scale_y) || 480
    let originalCords;
    try{
        monitorDetails.cords = JSON.parse(monitorDetails.cords)
    }catch(err){

    }
    originalCords = Object.values(monitorDetails.cords)
    const regionKeys = Object.keys(monitorDetails.cords);
    const newRegionsBySquares = {}
    try{
        regionKeys.forEach(function(regionKey){
            const region = monitorDetails.cords[regionKey]
            const tileSize = parseInt(region.detector_tile_size) || parseInt(monitorDetails.detector_tile_size) || 20;
            const squaresInRegion = getTiles(convertStringPoints(region.points),tileSize,width,height)
            squaresInRegion.forEach((square,n) => {
                newRegionsBySquares[`${regionKey}_${n}`] = Object.assign({},region,{
                   "points": square
                })
            })
        })
        // jsonData.rawMonitorConfig.details.cords = newRegionsBySquares;
    }catch(err){
        process.logData('ERROR!')
        process.logData(err.stack)
    }
    // detectorUtils.originalCords = originalCords;
    return {
        originalCords,
        newRegionsBySquares,
    }
}
module.exports = {
    getTiles,
    getIntersection,
    isPointInPolygon,
    convertStringPoints,
    convertRegionsToTiles,
    getLineSegmentIntersection,
    makeBigMatricesFromSmallOnes,
}
