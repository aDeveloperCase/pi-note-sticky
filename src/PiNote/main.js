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
