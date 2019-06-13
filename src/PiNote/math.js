PiNote.PI = Math.PI  - 0.07;

PiNote.isNearZero = function (n, eps) {
    eps = typeof eps !== "undefined" ? eps : 1e-10;
    return Math.abs(n) < eps;
};

PiNote.distanceBetweenPoints = function (p1, p2) {
  var xDiff = p2.x - p1.x;
  var yDiff = p2.y - p1.y;
  return Math.sqrt(xDiff * xDiff + yDiff * yDiff);
},

PiNote.angleWithOrigin = function (origin, point) {
  var xDiff = point.x - origin.x;
  var yDiff = point.y - origin.y;
  var angle = Math.atan2(yDiff, xDiff);
  angle = angle <= 0 ? angle + 2 * Math.PI : angle;
  return angle;
};
