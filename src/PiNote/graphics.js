PiNote.getContainer = function () {
  return new PIXI.Container();
};

PiNote.getRectangle = function (x, y, width, height, color, interactive, text) {
  var rect = new PIXI.Graphics();
  rect.beginFill(color);
  rect.drawRect(0, 0, width, height);
  rect.endFill();
  rect.pivot.set(width/2, height/2);
  rect.position.set(x, y);
  rect.interactive = interactive;

  if(text) {
    var text = new PIXI.Text(text, {font: '27px Verdana', fill: 0x333333, align: 'left', wordWrap: true, wordWrapWidth: (width-10)});
    text.x = 10;
    text.y = 10;
    rect.addChild(text);
  }

  return rect;
};

PiNote.getCircle = function (x, y, radius, color) {
  var circle = new PIXI.Graphics();
  circle.beginFill(color);
  circle.drawCircle(x, y, radius);
  circle.endFill();

  return circle;
};

PiNote.setDebugPoint = function (container, point, color) {
  var point = PiNote.getCircle(point.x, point.y, 5, color);
  container.addChild(point);
  return point;
};

PiNote.gradients = {
  shadowUp: null,
  shadowDown: null,
  shadowBack: null
};

PiNote.getShadowUpGradient = function () {
  if (PiNote.gradients.shadowUp)
    return PiNote.gradients.shadowUp;

  var canvas = document.createElement('canvas');
  canvas.width = 10;
  canvas.height = 10;

  var ctx = canvas.getContext("2d");
  var gradient = ctx.createLinearGradient(0,0,10,0);
  gradient.addColorStop(0, 'rgba(0,0,0,0.25)');
  gradient.addColorStop(0.2, 'rgba(0,0,0,0.15)');
  gradient.addColorStop(0.4, 'rgba(0,0,0,0.4)');
  gradient.addColorStop(0.75, 'rgba(0,0,0,0.2)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0,0,10,10);
  PiNote.gradients.shadowUp = canvas;
  return canvas;
};

PiNote.getShadowDownGradient = function () {
  if (PiNote.gradients.shadowDown)
    return PiNote.gradients.shadowDown;

  var canvas = document.createElement('canvas');
  canvas.width = 10;
  canvas.height = 10;

  var ctx = canvas.getContext("2d");
  var gradient = ctx.createLinearGradient(0,0,10,0);
  gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
  gradient.addColorStop(0.2, 'rgba(0,0,0,0.45)');
  gradient.addColorStop(0.4, 'rgba(0,0,0,0.35)');
  gradient.addColorStop(0.55, 'rgba(0,0,0,0.20)');
  gradient.addColorStop(0.7, 'rgba(0,0,0,0.1)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0,0,10,10);
  PiNote.gradients.shadowDown = canvas;
  return canvas;
};

PiNote.getShadowBackGradient = function () {
  if (PiNote.gradients.shadowBack)
    return PiNote.gradients.shadowBack;

  var canvas = document.createElement('canvas');
  canvas.width = 10;
  canvas.height = 10;

  var ctx = canvas.getContext("2d");
  var gradient = ctx.createLinearGradient(0,0,10,0);
  gradient.addColorStop(0.3, 'rgba(0,0,0,0.25)');
  gradient.addColorStop(0.6, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0,0,10,10);
  PiNote.gradients.shadowBack = canvas;
  return canvas;
};

PiNote.getShadowUp = function (x, y, width, height) {
  var gradient = PiNote.getShadowUpGradient();
  var texture = PIXI.Texture.fromCanvas(gradient);
  var sprite = new PIXI.Sprite(texture);
  sprite.x = x;
  sprite.y = y;
  sprite.width = width;
  sprite.height = height;
  sprite.anchor.set(0,0.5);
  return sprite;
};

PiNote.getShadowDown = function (x, y, width, height) {
  var gradient = PiNote.getShadowDownGradient();
  var texture = PIXI.Texture.fromCanvas(gradient);
  var sprite = new PIXI.Sprite(texture);
  sprite.x = x;
  sprite.y = y;
  sprite.width = width;
  sprite.height = height;
  sprite.anchor.set(0,0.5);
  return sprite;
};

PiNote.getShadowBack = function (x, y, width, height) {
  var gradient = PiNote.getShadowBackGradient();
  var texture = PIXI.Texture.fromCanvas(gradient);
  var sprite = new PIXI.Sprite(texture);
  sprite.x = x;
  sprite.y = y;
  sprite.width = width;
  sprite.height = height;
  sprite.anchor.set(0,0.5);
  return sprite;
};
