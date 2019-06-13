var PiNote = function (stage, pinboard, p) {
  // Points
  this.ppf = new PIXI.Point(0, 0); // Point pivot front - the pivot computed when the front note is clicked
  this.pmb = new PIXI.Point(0, 0); // Point mirror back - the pivot on the back note computed when the front note is clicked
  // Angles
  this.anf_ppf = 0; // Angle with ppf in a system where the origin is noteFront center, plus 180°
  this.anb_pmb = 0; // Angle with pmb in a system where the origin is noteBack center
  // Distances
  this.diag = Math.sqrt(p.width*p.width + p.height*p.height); // Diagonal
  this.dpmb_nb = 0; // Distance between pmb and the center (origin) of noteBack
  this.dshadow = this.diag; // Distance between the folding line and the parallel line passing through the more exposed angle of the noteBack
  this.ddrag = this.diag + 1;
  this.dswap = 0;

  this.width = p.width;
  this.height = p.height;

  //this.state = ["idle"];
  this.state = "idle";
  this.firstCallFlag = true;
  this.swapFlag = true;

  // Maximum amplitudes for the waves used in the computation of the shadows size and transparency
  var cos45 = Math.cos(Math.PI/4);
  this.A1 = p.height - p.width;
  this.A2 = (p.height*cos45 + p.width*cos45)-(p.width + this.A1*cos45);
  // Computed alpha value of the shadows
  this.shAlpha = 1;

  // Easing points and rotations
  this.mouse_o = new PIXI.Point(0, 0);
  this.pnf_o = new PIXI.Point(p.x, p.y);

  // Dragging physics
  this.accMouse = new PIXI.Point(0, 0); // Mouse acceleration vector
  this.accMouse_o = new PIXI.Point(0, 0); // Mouse acceleration vector - previous frame
  this.accMouseM = 0; // Mouse acceleration magnitude
  this.accRelease = new PIXI.Point(0, 0);
  this.force = new PIXI.Point(0, 0); // Force vector
  this.forceM = 0; // Force magnitude
  this.torque = 0; // Torque - https://en.wikipedia.org/wiki/Torque
  this.inertiaC = 2 * (p.width*p.width + p.height*p.height)/12; // Moment of Inertia for thin rectangular plate with axis of rotation at the center - https://en.wikipedia.org/wiki/List_of_moments_of_inertia
  this.inertia = 0; // Moment of Inertia - https://en.wikipedia.org/wiki/Moment_of_inertia
  this.angAcc = 0; // Angular acceleration - https://en.wikipedia.org/wiki/Moment_of_inertia - https://en.wikipedia.org/wiki/Angular_acceleration
  this.angVel = 0; // Angular velocity - https://en.wikipedia.org/wiki/Angular_acceleration
  this.friction = 0.5; // Friction
  this.sinOmega = 0; // Sin of Omega - Omega is the angle between the force vector and the lever arm vector - https://en.wikipedia.org/wiki/Torque

  // Final points and rotations
  this.pnb = new PIXI.Point(0, 0); // Note back position
  this.anb = 0; // Note back rotation
  this.pnf = new PIXI.Point(p.x, p.y); // Note front position
  this.anf = 0; // Note front rotation
  this.pnm = new PIXI.Point(p.x, p.y); // Note mask position
  this.anm = 0; // Note mask rotation
  this.psh = new PIXI.Point(0, 0); // Shadow up-down-back position
  this.ash = 0; // Shadow up-down-back rotation
  this.mouse = new PIXI.Point(0, 0);

  // Graphic components creation
  this.note = PiNote.getContainer();
  this.noteA = PiNote.getRectangle(p.x, p.y, p.width, p.height, p.color, true, p.textA);
  this.noteB = PiNote.getRectangle(-500, -500, p.width, p.height, p.color, true, p.textB);
  this.noteFront = null;
  this.noteBack = null;
  this.noteMask = PiNote.getRectangle(p.x, p.y, this.diag, this.diag, 0x555555, true);
  this.shadowUp = PiNote.getShadowUp(0, 0, this.diag, this.diag);
  this.shadowDown = PiNote.getShadowDown(0, 0, this.diag, this.diag);
  this.shadowBack = PiNote.getShadowBack(0, 0, this.diag, this.diag);
  this.shadowMaskUp = PiNote.getRectangle(0, 0, p.width, p.height, 0xAA00AA, false);
  this.shadowMaskDown = PiNote.getRectangle(0, 0, p.width, p.height, 0xAA00AA, false);
  this.shadowMaskBack = PiNote.getRectangle(0, 0, p.width, p.height, 0xAA00AA, false);
  this.stage = stage;
  this.pinboard = pinboard;

  this.wrapChilds();
  this.attachEvents();
  this.initialTransformations();
};

PiNote.prototype = {
  constructor: PiNote,

  update: function () {
    var state = this.state;

    this.mouse_o.x += (this.mouse.x - this.mouse_o.x)/4;
    this.mouse_o.y += (this.mouse.y - this.mouse_o.y)/4;

    this.accMouse_o.set(this.accMouse.x, this.accMouse.y);
    this.accMouse.set(this.mouse.x - this.mouse_o.x, this.mouse.y - this.mouse_o.y);
    this.accMouseM = Math.sqrt(this.accMouse.x*this.accMouse.x + this.accMouse.y*this.accMouse.y);

    if(PiNote.isNearZero(this.accMouse.x) && PiNote.isNearZero(this.accMouse.y))
      this.accMouse.set(this.accMouse_o.x, this.accMouse_o.y);

    if(state === "peeling") {
      this.peelingTransformations();
    }

    if(state === "startDragging") {
      this.inertia = this.inertiaC + 2 * this.dpmb_nb * this.dpmb_nb;
      this.turnOffBack();
      this.friction = 0.5;

      this.state = "dragging";
    }

    if(state === "dragging") {
      this.draggingTransformations();
    }

    if(state === "releasePeeling") {
      if(this.dswap < this.diag/2) {
        this.swapFrontBack();
      }
      this.turnOffBack();
      this.state = "idle";
    }

    if(state === "releaseDragging") {
      this.anf += this.angVel;
      this.pnf.x += this.accRelease.x;
      this.pnf.y += this.accRelease.y;

      this.angVel *= 0.9; //this.friction;
      this.accRelease.x *= this.friction;
      this.accRelease.y *= this.friction;

      if (this.pnf.x > this.stage.hitArea.width || this.pnf.x < 0)
        this.accRelease.x = -this.accRelease.x;
      if (this.pnf.y > this.stage.hitArea.height || this.pnf.y < 0)
        this.accRelease.y = -this.accRelease.y;

      if(PiNote.isNearZero(this.angVel) && PiNote.isNearZero(this.accRelease.x) && PiNote.isNearZero(this.accRelease.y)){
        this.state = "idle";
      }
    }

    this.applyTransformations();
  },

  initialTransformations: function () {
    this.pnf.set(this.noteFront.x, this.noteFront.y);
    this.anf = this.noteFront.rotation;

    this.pnb.set(-2*this.noteFront.width, -2*this.noteFront.height);
    this.anb = this.noteBack.rotation;

    this.pnm.set(this.noteFront.x, this.noteFront.y);
    this.anm = this.noteFront.rotation;

    this.psh.set(-2*this.noteFront.width, -2*this.noteFront.height);
  },

  peelingTransformations: function () {
    var alpha = this.anb_pmb - this.anf;
    var beta = PiNote.angleWithOrigin(this.ppf, this.mouse_o);
    this.anm = this.ash = beta;

    if (this.checkDragging(beta)){
      this.state = "startDragging";
    }

    this.pnb.x = this.mouse_o.x - this.dpmb_nb * Math.cos(alpha + beta*2);
    this.pnb.y = this.mouse_o.y - this.dpmb_nb * Math.sin(alpha + beta*2);
    this.anb = 2*beta - this.noteFront.rotation;

    this.psh.x = this.pnb.x + (this.noteFront.x - this.pnb.x)/2;
    this.psh.y = this.pnb.y + (this.noteFront.y - this.pnb.y)/2;
    this.pnm.x = this.psh.x + (this.diag/2) * Math.cos(beta);
    this.pnm.y = this.psh.y + (this.diag/2) * Math.sin(beta);

    var wave1 = Math.abs(Math.sin(beta - this.noteFront.rotation));
    var wave2 = Math.abs(Math.sin(2 * (beta - this.noteFront.rotation)));
    var wave = this.width + this.A1*wave1 + this.A2*wave2;

    var shadowPointX = this.pnb.x + wave/2*Math.cos(beta);
    var shadowPointY = this.pnb.y + wave/2*Math.sin(beta);
    this.dshadow = PiNote.distanceBetweenPoints({x: shadowPointX, y: shadowPointY}, this.psh);
    this.ddrag = wave - PiNote.distanceBetweenPoints(this.pnm, {x: shadowPointX, y: shadowPointY});
    this.dswap = PiNote.distanceBetweenPoints(this.pnb, this.pnm);

    this.shAlpha = (1/(this.diag * 2)) * (wave-this.dshadow) * 2;

    this.ppf.x = this.pnf.x - this.dpmb_nb * Math.cos(this.anf_ppf);
    this.ppf.y = this.pnf.y - this.dpmb_nb * Math.sin(this.anf_ppf);

    var dmouse_ppf = PiNote.distanceBetweenPoints(this.mouse_o, this.ppf);
    if (this.ddrag < this.diag/2 && this.dswap < this.diag/2 && dmouse_ppf > 100) {
      this.swapFrontBack();
      this.turnOffBack();
      this.state = "idle";
    }
  },

  draggingTransformations: function () {
    this.force.set(
      this.accMouse.x,
      this.accMouse.y
    );
    this.forceM = this.accMouseM;

    this.sinOmega = 0;
    if (!PiNote.isNearZero(this.force) && !PiNote.isNearZero(this.dpmb_nb) && !PiNote.isNearZero(this.forceM)) {
      var sinOmega0 = this.force.y/this.forceM;
      var sinOmega1 = (this.mouse_o.x-this.noteFront.x)/this.dpmb_nb;
      var sinOmega2 = this.force.x/this.forceM;
      var sinOmega3 = (this.mouse_o.y-this.noteFront.y)/this.dpmb_nb;
      this.sinOmega = sinOmega0 * sinOmega1 - sinOmega2 * sinOmega3;
    }

    this.torque = this.forceM * this.dpmb_nb * this.sinOmega;
    this.angAcc = this.torque/this.inertia;
    this.angVel += this.angAcc;
    this.anf += this.angVel;

    //this.ppf.x = this.mouse_o.x;
    //this.ppf.y = this.mouse_o.y;
    this.ppf.x += (this.mouse.x - this.ppf.x)/4;
    this.ppf.y += (this.mouse.y - this.ppf.y)/4;
    this.pnf.x += (this.mouse.x - this.ppf.x)/3;
    this.pnf.y += (this.mouse.y - this.ppf.y)/3;

    //this.pnf.x += (this.accMouse.x)/3;
    //this.pnf.y += (this.accMouse.y)/3;
    var alpha = this.angVel;
    var pnfX0 = (this.pnf.x-this.mouse_o.x)*Math.cos(alpha) - (this.pnf.y-this.mouse_o.y)*Math.sin(alpha) + this.mouse_o.x;
    var pnfY0 = (this.pnf.y-this.mouse_o.y)*Math.cos(alpha) + (this.pnf.x-this.mouse_o.x)*Math.sin(alpha) + this.mouse_o.y;
    this.pnf.x = pnfX0;
    this.pnf.y = pnfY0;

    this.angVel *= this.friction;
  },

  applyTransformations: function () {
    this.noteFront.position.set(this.pnf.x, this.pnf.y);
    this.noteFront.rotation = this.anf;

    this.noteBack.position.set(this.pnb.x, this.pnb.y);
    this.noteBack.rotation = this.anb;

    this.noteMask.position.set(this.pnm.x, this.pnm.y);
    this.noteMask.rotation = this.anm;

    this.shadowUp.position.set(this.psh.x, this.psh.y);
    this.shadowUp.rotation = this.anm;
    this.shadowUp.width = this.dshadow;
    this.shadowUp.alpha = this.shAlpha;

    this.shadowDown.position.set(this.psh.x, this.psh.y);
    this.shadowDown.rotation = this.anm;
    this.shadowDown.width = 2 * this.dshadow;
    this.shadowDown.alpha = this.shAlpha;

    this.shadowBack.position.set(this.psh.x, this.psh.y);
    this.shadowBack.rotation = this.anm + Math.PI;
    this.shadowBack.width = this.dshadow/2;
    this.shadowBack.alpha = this.shAlpha;

    this.shadowMaskUp.position.set(this.pnb.x, this.pnb.y);
    this.shadowMaskUp.x = this.pnb.x;
    this.shadowMaskUp.y = this.pnb.y;
    this.shadowMaskUp.rotation = this.anb;

    this.shadowMaskDown.x = this.shadowMaskBack.x = this.noteFront.x;
    this.shadowMaskDown.y = this.shadowMaskBack.y = this.noteFront.y;
    this.shadowMaskDown.rotation = this.shadowMaskBack.rotation = this.noteFront.rotation;
  },

  checkDragging: function(angle) {
    var dmouse_ppf = PiNote.distanceBetweenPoints(this.mouse_o, this.ppf);
    if (!this.noteFront.containsPoint(this.mouse_o) && dmouse_ppf < 100)
      return true;
  },

  turnOnBack: function () {
    this.noteBack.visible = true;
    this.shadowUp.visible = true;
    this.shadowDown.visible = true;
    this.shadowBack.visible = true;
    this.noteMask.visible = true;
    this.noteFront.mask = this.noteMask;
  },

  turnOffBack: function () {
    this.noteBack.visible = false;
    this.shadowUp.visible = false;
    this.shadowDown.visible = false;
    this.shadowBack.visible = false;
    this.noteMask.visible = false;
    this.noteFront.mask = null;
  },

  swapFrontBack: function () {
    this.noteFront = null;
    this.noteBack = null;

    if(this.swapFlag) {
      this.noteFront = this.noteB;
      this.noteBack = this.noteA;
      this.swapFlag = false;
    } else {
      this.noteFront = this.noteA;
      this.noteBack = this.noteB;
      this.swapFlag = true;
    }

    var indexA = this.note.getChildIndex(this.noteA);
    var indexB = this.note.getChildIndex(this.noteB);
    this.note.setChildIndex(this.noteA, indexB);
    this.note.setChildIndex(this.noteB, indexA);

    this.initialTransformations();
    // this.attachEvents();
  },

  wrapChilds: function () {
    this.noteA.pinote = this;
    this.noteB.pinote = this;
    this.shadowDown.pinote = this;
    this.shadowUp.pinote = this;
    this.stage.pinote = null;

    var filter = new PIXI.filters.DropShadowFilter();
    filter.distance = 0;
    filter.blur = 4;
    filter.color = 0x666666;
    this.noteA.filters = [filter];
    this.noteB.filters = [filter];

    this.noteB.mask = this.noteMask;
    this.noteA.mask = this.noteMask;
    this.shadowUp.mask = this.shadowMaskUp;
    this.shadowDown.mask = this.shadowMaskDown;
    this.shadowBack.mask = this.shadowMaskBack;
    this.noteFront = this.noteA;
    this.noteBack = this.noteB;

    var blurFilter = new PIXI.filters.BlurFilter();
    blurFilter.blur = 10;
    this.shadowBack.filters = [blurFilter];

    this.noteMask.isMask = true;
    this.noteMask.position.set(this.noteFront.x, this.noteFront.y);

    this.note.addChild(this.noteMask);
    this.note.addChild(this.shadowMaskBack);
    this.note.addChild(this.shadowMaskDown);
    this.note.addChild(this.shadowMaskUp);
    this.note.addChild(this.shadowBack);
    this.note.addChild(this.noteA);
    this.note.addChild(this.shadowDown);
    this.note.addChild(this.noteB);
    this.note.addChild(this.shadowUp);
  },

  attachEvents: function () {
    this.noteA.on('mousedown', this.mouseDownOnNoteFront);
    this.noteA.on('mousemove', this.mouseMoveRelativeToNoteFront);
    this.noteB.on('mousedown', this.mouseDownOnNoteFront);
    this.noteB.on('mousemove', this.mouseMoveRelativeToNoteFront);
  },

  mouseMoveRelativeToNoteFront: function (e) {
    var self = e.target.pinote;
    if (e.data.global)
      self.mouse.set(e.data.global.x, e.data.global.y);
  },

  mouseDownOnNoteFront: function (e) {
    var self = e.target.pinote;
    self.stage.pinote = self;
    self.pinboard.swapNotes(self);

    self.stage.on('mouseup', self.mouseUpOnStage);
    self.stage.on('mouseout', self.mouseUpOnStage);

    var area = self.setDraggingPivots(e.data.getLocalPosition(self.noteFront));

    if (area === "center-center") {
      self.state = "startDragging";
    } else {
      self.state = "peeling";
      self.turnOnBack();
    }
  },

  mouseUpOnStage: function (e) {
    var self = e.target.pinote;
    self.stage.off('mouseup', self.mouseUpOnStage);
    self.stage.off('mouseout', self.mouseUpOnStage);
    if(self.state === "peeling") {
      self.state = "releasePeeling";
    } else if(self.state === "dragging") {
      self.state = "releaseDragging";
      self.friction = 0.8;
      self.accRelease.set(self.accMouse.x, self.accMouse.y);
    } else {
      self.state = "idle";
    }
  },

  setDraggingPivots: function (mouseLocalPoint) {
    var localOrigin = this.noteFront.position;
    var halfWidth = this.noteFront.width/2;
    var halfHeight = this.noteFront.height/2;
    var gridUnitWidth = this.noteFront.width/4;   // we divide the note in a 4x4 grid
    var gridUnitHeight = this.noteFront.height/4; // we divide the note in a 4x4 grid

    var horizontalArea, // area clicked
        verticalArea;   // area clicked

    var pivotFrontX0,  // desired x in the non rotated local system
        pivotFrontY0,  // desired y in the non rotated local system
        pivotBackX0,  // desired x in the rotated local system
        pivotBackY0;  // desired y in the rotated local system

    if (mouseLocalPoint.x < gridUnitWidth) {
      horizontalArea = "left";
      pivotFrontX0 = - halfWidth;
      pivotBackX0 = halfWidth;
    } else if (mouseLocalPoint.x > (3 * gridUnitWidth)) {
      horizontalArea = "right";
      pivotFrontX0 = mouseLocalPoint.x + (halfWidth - mouseLocalPoint.x);
      pivotBackX0 = - halfWidth;
    } else {
      horizontalArea = "center";
      pivotFrontX0 = mouseLocalPoint.x - halfWidth;
      pivotBackX0 = halfWidth - mouseLocalPoint.x;
    }

    if (mouseLocalPoint.y < gridUnitHeight) {
      verticalArea = "top";
      pivotFrontY0 = pivotBackY0 = 0 - halfHeight;
    } else if (mouseLocalPoint.y > 3 * gridUnitHeight) {
      verticalArea = "bottom";
      pivotFrontY0 = pivotBackY0 = mouseLocalPoint.y + (halfHeight - mouseLocalPoint.y);
    } else {
      verticalArea = "center";
      pivotFrontY0 = pivotBackY0 = mouseLocalPoint.y - halfHeight;
    }

    // Rotation of a Cartesian Coordinate System
    // http://www.mathematics-online.org/inhalt/aussage/aussage444/
    // transform the points to the current rotation
    var alpha = -this.noteFront.rotation;
    var pivotFrontX1 = Math.cos(alpha) * pivotFrontX0 + Math.sin(alpha) * pivotFrontY0;
    var pivotFrontY1 = - Math.sin(alpha) * pivotFrontX0 + Math.cos(alpha) * pivotFrontY0;
    // transform the points from local to global
    var x = this.noteFront.x + pivotFrontX1;
    var y = this.noteFront.y + pivotFrontY1;
    this.ppf.set(x, y);
    this.mouse_o.set(x, y);

    // transform the points to the current rotation
    var alpha = 0;
    var pivotBackX1 = Math.cos(alpha) * pivotBackX0 + Math.sin(alpha) * pivotBackY0;
    var pivotBackY1 = - Math.sin(alpha) * pivotBackX0 + Math.cos(alpha) * pivotBackY0;
    // transform the points from local to global
    var x = this.noteBack.x + pivotBackX1;
    var y = this.noteBack.y + pivotBackY1;
    this.pmb.set(x, y);

    this.dpmb_nb = PiNote.distanceBetweenPoints(this.pmb, this.noteBack.position);
    this.anf_ppf = PiNote.angleWithOrigin(this.noteFront, this.ppf) + Math.PI;
    this.anb_pmb = PiNote.angleWithOrigin(this.noteBack, this.pmb);

    return horizontalArea + "-" + verticalArea;
  },
  /*
  addState: function (state) {
    this.state.push(state);
    this.firstCallFlag = true;
  },

  getState: function () {
      return this.state.length ? this.state[0] : "idle";
  },

  getNextState: function () {
    var state = this.state.shift();
    return state ? state : "idle";
  }
  */
}

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

var PinBoard = function (stage) {
  this.pinotes = [];
  this.pinboard = PiNote.getContainer();
  this.stage = stage;
  this.prevSelected = null;
  this.currSelected = null;
};

PinBoard.prototype = {
  constructor: PinBoard,

  update: function () {
    for (var i=0; i<this.pinotes.length; i++) {
      this.pinotes[i].update();
    }
  },

  add: function (params) {
    params.color = params.color.replace("#", "0x");
    var pinote = new PiNote(this.stage, this, params);
    this.pinboard.addChild(pinote.note);
    this.pinotes.push(pinote);
    this.prevSelected = this.currSelected;
    this.currSelected = pinote;
  },

  clear: function () {
    this.pinboard.removeChildren();
    this.pinotes = [];
  },

  swapNotes: function (current) {
    this.prevSelected = this.currSelected;
    this.currSelected = current;
    this.pinboard.swapChildren(this.prevSelected.note, this.currSelected.note);
  },
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4uanMiLCJncmFwaGljcy5qcyIsIm1hdGguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN0ZUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDNUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBRnBCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6InBpbm90ZS5qcyIsInNvdXJjZXNDb250ZW50IjpbInZhciBQaW5Cb2FyZCA9IGZ1bmN0aW9uIChzdGFnZSkge1xyXG4gIHRoaXMucGlub3RlcyA9IFtdO1xyXG4gIHRoaXMucGluYm9hcmQgPSBQaU5vdGUuZ2V0Q29udGFpbmVyKCk7XHJcbiAgdGhpcy5zdGFnZSA9IHN0YWdlO1xyXG4gIHRoaXMucHJldlNlbGVjdGVkID0gbnVsbDtcclxuICB0aGlzLmN1cnJTZWxlY3RlZCA9IG51bGw7XHJcbn07XHJcblxyXG5QaW5Cb2FyZC5wcm90b3R5cGUgPSB7XHJcbiAgY29uc3RydWN0b3I6IFBpbkJvYXJkLFxyXG5cclxuICB1cGRhdGU6IGZ1bmN0aW9uICgpIHtcclxuICAgIGZvciAodmFyIGk9MDsgaTx0aGlzLnBpbm90ZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgdGhpcy5waW5vdGVzW2ldLnVwZGF0ZSgpO1xyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIGFkZDogZnVuY3Rpb24gKHBhcmFtcykge1xyXG4gICAgcGFyYW1zLmNvbG9yID0gcGFyYW1zLmNvbG9yLnJlcGxhY2UoXCIjXCIsIFwiMHhcIik7XHJcbiAgICB2YXIgcGlub3RlID0gbmV3IFBpTm90ZSh0aGlzLnN0YWdlLCB0aGlzLCBwYXJhbXMpO1xyXG4gICAgdGhpcy5waW5ib2FyZC5hZGRDaGlsZChwaW5vdGUubm90ZSk7XHJcbiAgICB0aGlzLnBpbm90ZXMucHVzaChwaW5vdGUpO1xyXG4gICAgdGhpcy5wcmV2U2VsZWN0ZWQgPSB0aGlzLmN1cnJTZWxlY3RlZDtcclxuICAgIHRoaXMuY3VyclNlbGVjdGVkID0gcGlub3RlO1xyXG4gIH0sXHJcblxyXG4gIGNsZWFyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLnBpbmJvYXJkLnJlbW92ZUNoaWxkcmVuKCk7XHJcbiAgICB0aGlzLnBpbm90ZXMgPSBbXTtcclxuICB9LFxyXG5cclxuICBzd2FwTm90ZXM6IGZ1bmN0aW9uIChjdXJyZW50KSB7XHJcbiAgICB0aGlzLnByZXZTZWxlY3RlZCA9IHRoaXMuY3VyclNlbGVjdGVkO1xyXG4gICAgdGhpcy5jdXJyU2VsZWN0ZWQgPSBjdXJyZW50O1xyXG4gICAgdGhpcy5waW5ib2FyZC5zd2FwQ2hpbGRyZW4odGhpcy5wcmV2U2VsZWN0ZWQubm90ZSwgdGhpcy5jdXJyU2VsZWN0ZWQubm90ZSk7XHJcbiAgfSxcclxufVxyXG4iLCJQaU5vdGUuZ2V0Q29udGFpbmVyID0gZnVuY3Rpb24gKCkge1xyXG4gIHJldHVybiBuZXcgUElYSS5Db250YWluZXIoKTtcclxufTtcclxuXHJcblBpTm90ZS5nZXRSZWN0YW5nbGUgPSBmdW5jdGlvbiAoeCwgeSwgd2lkdGgsIGhlaWdodCwgY29sb3IsIGludGVyYWN0aXZlLCB0ZXh0KSB7XHJcbiAgdmFyIHJlY3QgPSBuZXcgUElYSS5HcmFwaGljcygpO1xyXG4gIHJlY3QuYmVnaW5GaWxsKGNvbG9yKTtcclxuICByZWN0LmRyYXdSZWN0KDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xyXG4gIHJlY3QuZW5kRmlsbCgpO1xyXG4gIHJlY3QucGl2b3Quc2V0KHdpZHRoLzIsIGhlaWdodC8yKTtcclxuICByZWN0LnBvc2l0aW9uLnNldCh4LCB5KTtcclxuICByZWN0LmludGVyYWN0aXZlID0gaW50ZXJhY3RpdmU7XHJcblxyXG4gIGlmKHRleHQpIHtcclxuICAgIHZhciB0ZXh0ID0gbmV3IFBJWEkuVGV4dCh0ZXh0LCB7Zm9udDogJzI3cHggVmVyZGFuYScsIGZpbGw6IDB4MzMzMzMzLCBhbGlnbjogJ2xlZnQnLCB3b3JkV3JhcDogdHJ1ZSwgd29yZFdyYXBXaWR0aDogKHdpZHRoLTEwKX0pO1xyXG4gICAgdGV4dC54ID0gMTA7XHJcbiAgICB0ZXh0LnkgPSAxMDtcclxuICAgIHJlY3QuYWRkQ2hpbGQodGV4dCk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gcmVjdDtcclxufTtcclxuXHJcblBpTm90ZS5nZXRDaXJjbGUgPSBmdW5jdGlvbiAoeCwgeSwgcmFkaXVzLCBjb2xvcikge1xyXG4gIHZhciBjaXJjbGUgPSBuZXcgUElYSS5HcmFwaGljcygpO1xyXG4gIGNpcmNsZS5iZWdpbkZpbGwoY29sb3IpO1xyXG4gIGNpcmNsZS5kcmF3Q2lyY2xlKHgsIHksIHJhZGl1cyk7XHJcbiAgY2lyY2xlLmVuZEZpbGwoKTtcclxuXHJcbiAgcmV0dXJuIGNpcmNsZTtcclxufTtcclxuXHJcblBpTm90ZS5zZXREZWJ1Z1BvaW50ID0gZnVuY3Rpb24gKGNvbnRhaW5lciwgcG9pbnQsIGNvbG9yKSB7XHJcbiAgdmFyIHBvaW50ID0gUGlOb3RlLmdldENpcmNsZShwb2ludC54LCBwb2ludC55LCA1LCBjb2xvcik7XHJcbiAgY29udGFpbmVyLmFkZENoaWxkKHBvaW50KTtcclxuICByZXR1cm4gcG9pbnQ7XHJcbn07XHJcblxyXG5QaU5vdGUuZ3JhZGllbnRzID0ge1xyXG4gIHNoYWRvd1VwOiBudWxsLFxyXG4gIHNoYWRvd0Rvd246IG51bGwsXHJcbiAgc2hhZG93QmFjazogbnVsbFxyXG59O1xyXG5cclxuUGlOb3RlLmdldFNoYWRvd1VwR3JhZGllbnQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgaWYgKFBpTm90ZS5ncmFkaWVudHMuc2hhZG93VXApXHJcbiAgICByZXR1cm4gUGlOb3RlLmdyYWRpZW50cy5zaGFkb3dVcDtcclxuXHJcbiAgdmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xyXG4gIGNhbnZhcy53aWR0aCA9IDEwO1xyXG4gIGNhbnZhcy5oZWlnaHQgPSAxMDtcclxuXHJcbiAgdmFyIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7XHJcbiAgdmFyIGdyYWRpZW50ID0gY3R4LmNyZWF0ZUxpbmVhckdyYWRpZW50KDAsMCwxMCwwKTtcclxuICBncmFkaWVudC5hZGRDb2xvclN0b3AoMCwgJ3JnYmEoMCwwLDAsMC4yNSknKTtcclxuICBncmFkaWVudC5hZGRDb2xvclN0b3AoMC4yLCAncmdiYSgwLDAsMCwwLjE1KScpO1xyXG4gIGdyYWRpZW50LmFkZENvbG9yU3RvcCgwLjQsICdyZ2JhKDAsMCwwLDAuNCknKTtcclxuICBncmFkaWVudC5hZGRDb2xvclN0b3AoMC43NSwgJ3JnYmEoMCwwLDAsMC4yKScpO1xyXG4gIGdyYWRpZW50LmFkZENvbG9yU3RvcCgxLCAncmdiYSgwLDAsMCwwLjEpJyk7XHJcbiAgY3R4LmZpbGxTdHlsZSA9IGdyYWRpZW50O1xyXG4gIGN0eC5maWxsUmVjdCgwLDAsMTAsMTApO1xyXG4gIFBpTm90ZS5ncmFkaWVudHMuc2hhZG93VXAgPSBjYW52YXM7XHJcbiAgcmV0dXJuIGNhbnZhcztcclxufTtcclxuXHJcblBpTm90ZS5nZXRTaGFkb3dEb3duR3JhZGllbnQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgaWYgKFBpTm90ZS5ncmFkaWVudHMuc2hhZG93RG93bilcclxuICAgIHJldHVybiBQaU5vdGUuZ3JhZGllbnRzLnNoYWRvd0Rvd247XHJcblxyXG4gIHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcclxuICBjYW52YXMud2lkdGggPSAxMDtcclxuICBjYW52YXMuaGVpZ2h0ID0gMTA7XHJcblxyXG4gIHZhciBjdHggPSBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpO1xyXG4gIHZhciBncmFkaWVudCA9IGN0eC5jcmVhdGVMaW5lYXJHcmFkaWVudCgwLDAsMTAsMCk7XHJcbiAgZ3JhZGllbnQuYWRkQ29sb3JTdG9wKDAsICdyZ2JhKDAsMCwwLDAuNTUpJyk7XHJcbiAgZ3JhZGllbnQuYWRkQ29sb3JTdG9wKDAuMiwgJ3JnYmEoMCwwLDAsMC40NSknKTtcclxuICBncmFkaWVudC5hZGRDb2xvclN0b3AoMC40LCAncmdiYSgwLDAsMCwwLjM1KScpO1xyXG4gIGdyYWRpZW50LmFkZENvbG9yU3RvcCgwLjU1LCAncmdiYSgwLDAsMCwwLjIwKScpO1xyXG4gIGdyYWRpZW50LmFkZENvbG9yU3RvcCgwLjcsICdyZ2JhKDAsMCwwLDAuMSknKTtcclxuICBncmFkaWVudC5hZGRDb2xvclN0b3AoMSwgJ3JnYmEoMCwwLDAsMCknKTtcclxuICBjdHguZmlsbFN0eWxlID0gZ3JhZGllbnQ7XHJcbiAgY3R4LmZpbGxSZWN0KDAsMCwxMCwxMCk7XHJcbiAgUGlOb3RlLmdyYWRpZW50cy5zaGFkb3dEb3duID0gY2FudmFzO1xyXG4gIHJldHVybiBjYW52YXM7XHJcbn07XHJcblxyXG5QaU5vdGUuZ2V0U2hhZG93QmFja0dyYWRpZW50ID0gZnVuY3Rpb24gKCkge1xyXG4gIGlmIChQaU5vdGUuZ3JhZGllbnRzLnNoYWRvd0JhY2spXHJcbiAgICByZXR1cm4gUGlOb3RlLmdyYWRpZW50cy5zaGFkb3dCYWNrO1xyXG5cclxuICB2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XHJcbiAgY2FudmFzLndpZHRoID0gMTA7XHJcbiAgY2FudmFzLmhlaWdodCA9IDEwO1xyXG5cclxuICB2YXIgY3R4ID0gY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtcclxuICB2YXIgZ3JhZGllbnQgPSBjdHguY3JlYXRlTGluZWFyR3JhZGllbnQoMCwwLDEwLDApO1xyXG4gIGdyYWRpZW50LmFkZENvbG9yU3RvcCgwLjMsICdyZ2JhKDAsMCwwLDAuMjUpJyk7XHJcbiAgZ3JhZGllbnQuYWRkQ29sb3JTdG9wKDAuNiwgJ3JnYmEoMCwwLDAsMCknKTtcclxuICBjdHguZmlsbFN0eWxlID0gZ3JhZGllbnQ7XHJcbiAgY3R4LmZpbGxSZWN0KDAsMCwxMCwxMCk7XHJcbiAgUGlOb3RlLmdyYWRpZW50cy5zaGFkb3dCYWNrID0gY2FudmFzO1xyXG4gIHJldHVybiBjYW52YXM7XHJcbn07XHJcblxyXG5QaU5vdGUuZ2V0U2hhZG93VXAgPSBmdW5jdGlvbiAoeCwgeSwgd2lkdGgsIGhlaWdodCkge1xyXG4gIHZhciBncmFkaWVudCA9IFBpTm90ZS5nZXRTaGFkb3dVcEdyYWRpZW50KCk7XHJcbiAgdmFyIHRleHR1cmUgPSBQSVhJLlRleHR1cmUuZnJvbUNhbnZhcyhncmFkaWVudCk7XHJcbiAgdmFyIHNwcml0ZSA9IG5ldyBQSVhJLlNwcml0ZSh0ZXh0dXJlKTtcclxuICBzcHJpdGUueCA9IHg7XHJcbiAgc3ByaXRlLnkgPSB5O1xyXG4gIHNwcml0ZS53aWR0aCA9IHdpZHRoO1xyXG4gIHNwcml0ZS5oZWlnaHQgPSBoZWlnaHQ7XHJcbiAgc3ByaXRlLmFuY2hvci5zZXQoMCwwLjUpO1xyXG4gIHJldHVybiBzcHJpdGU7XHJcbn07XHJcblxyXG5QaU5vdGUuZ2V0U2hhZG93RG93biA9IGZ1bmN0aW9uICh4LCB5LCB3aWR0aCwgaGVpZ2h0KSB7XHJcbiAgdmFyIGdyYWRpZW50ID0gUGlOb3RlLmdldFNoYWRvd0Rvd25HcmFkaWVudCgpO1xyXG4gIHZhciB0ZXh0dXJlID0gUElYSS5UZXh0dXJlLmZyb21DYW52YXMoZ3JhZGllbnQpO1xyXG4gIHZhciBzcHJpdGUgPSBuZXcgUElYSS5TcHJpdGUodGV4dHVyZSk7XHJcbiAgc3ByaXRlLnggPSB4O1xyXG4gIHNwcml0ZS55ID0geTtcclxuICBzcHJpdGUud2lkdGggPSB3aWR0aDtcclxuICBzcHJpdGUuaGVpZ2h0ID0gaGVpZ2h0O1xyXG4gIHNwcml0ZS5hbmNob3Iuc2V0KDAsMC41KTtcclxuICByZXR1cm4gc3ByaXRlO1xyXG59O1xyXG5cclxuUGlOb3RlLmdldFNoYWRvd0JhY2sgPSBmdW5jdGlvbiAoeCwgeSwgd2lkdGgsIGhlaWdodCkge1xyXG4gIHZhciBncmFkaWVudCA9IFBpTm90ZS5nZXRTaGFkb3dCYWNrR3JhZGllbnQoKTtcclxuICB2YXIgdGV4dHVyZSA9IFBJWEkuVGV4dHVyZS5mcm9tQ2FudmFzKGdyYWRpZW50KTtcclxuICB2YXIgc3ByaXRlID0gbmV3IFBJWEkuU3ByaXRlKHRleHR1cmUpO1xyXG4gIHNwcml0ZS54ID0geDtcclxuICBzcHJpdGUueSA9IHk7XHJcbiAgc3ByaXRlLndpZHRoID0gd2lkdGg7XHJcbiAgc3ByaXRlLmhlaWdodCA9IGhlaWdodDtcclxuICBzcHJpdGUuYW5jaG9yLnNldCgwLDAuNSk7XHJcbiAgcmV0dXJuIHNwcml0ZTtcclxufTtcclxuIiwiUGlOb3RlLlBJID0gTWF0aC5QSSAgLSAwLjA3O1xyXG5cclxuUGlOb3RlLmlzTmVhclplcm8gPSBmdW5jdGlvbiAobiwgZXBzKSB7XHJcbiAgICBlcHMgPSB0eXBlb2YgZXBzICE9PSBcInVuZGVmaW5lZFwiID8gZXBzIDogMWUtMTA7XHJcbiAgICByZXR1cm4gTWF0aC5hYnMobikgPCBlcHM7XHJcbn07XHJcblxyXG5QaU5vdGUuZGlzdGFuY2VCZXR3ZWVuUG9pbnRzID0gZnVuY3Rpb24gKHAxLCBwMikge1xyXG4gIHZhciB4RGlmZiA9IHAyLnggLSBwMS54O1xyXG4gIHZhciB5RGlmZiA9IHAyLnkgLSBwMS55O1xyXG4gIHJldHVybiBNYXRoLnNxcnQoeERpZmYgKiB4RGlmZiArIHlEaWZmICogeURpZmYpO1xyXG59LFxyXG5cclxuUGlOb3RlLmFuZ2xlV2l0aE9yaWdpbiA9IGZ1bmN0aW9uIChvcmlnaW4sIHBvaW50KSB7XHJcbiAgdmFyIHhEaWZmID0gcG9pbnQueCAtIG9yaWdpbi54O1xyXG4gIHZhciB5RGlmZiA9IHBvaW50LnkgLSBvcmlnaW4ueTtcclxuICB2YXIgYW5nbGUgPSBNYXRoLmF0YW4yKHlEaWZmLCB4RGlmZik7XHJcbiAgYW5nbGUgPSBhbmdsZSA8PSAwID8gYW5nbGUgKyAyICogTWF0aC5QSSA6IGFuZ2xlO1xyXG4gIHJldHVybiBhbmdsZTtcclxufTtcclxuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
